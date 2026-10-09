import { CYPHER } from "../config.mjs";
import {
  resolveWeaponRangeAdjudication,
  resolveWeaponTargetEffects
} from "../rules/weapon-mechanics.mjs";
import { resolveWeaponSkillModifier } from "../rules/weapon-skills.mjs";

/**
 * Foundry-aware Item use cases.
 *
 * Item documents expose compatibility methods, while this module owns the
 * reusable orchestration for item actions.
 */

export async function useCypher(item) {
  if (item.type !== "cypher") return false;
  await item.update({ "system.depleted": true });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content: `<h3>${item.name}</h3><p>${game.i18n.localize("CYPHER.Cypher.Used")}</p>`
  });
  return true;
}

/**
 * Roll a structured result table on a Cypher and consume the one-use item.
 *
 * Invalid table IDs and invalid formulas leave the Cypher untouched.
 *
 * @param {Item} item Cypher Item.
 * @param {string} tableId Structured table identifier.
 * @returns {Promise<boolean>} Whether a table result was rolled.
 */

/**
 * Roll a Cypher's structured power variants on a d100 and consume it.
 *
 * @param {Item} item Cypher Item.
 * @returns {Promise<boolean>} Whether a variant was resolved.
 */
export async function rollCypherVariant(item) {
  if (!item || item.type !== "cypher" || !item.actor || item.system.depleted) {
    return false;
  }

  const variants = item.system.variants ?? [];
  if (!variants.length) return false;

  let roll;
  try {
    roll = await new Roll("1d100").evaluate();
  } catch (error) {
    ui.notifications.error(
      `${game.i18n.localize("CYPHER.Ability.InvalidRollTable")}: ${error.message}`
    );
    return false;
  }

  const variant = variants.find(candidate =>
    roll.total >= candidate.rollMin && roll.total <= candidate.rollMax
  );
  if (!variant) {
    ui.notifications.error(
      game.i18n.localize("CYPHER.Ability.NoRollTableResult")
    );
    return false;
  }

  await item.update({ "system.depleted": true });
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    flavor: `<strong>${item.name}</strong> — ${variant.name} (${variant.powerLevel})`,
    flags: { cypher: {
      rerollable: true,
      rollType: "cypherVariant",
      actorId: item.actor.id,
      itemId: item.id,
      variantName: variant.name,
      powerLevel: variant.powerLevel,
      originalRoll: roll.total
    } }
  });
  return true;
}

export async function rollCypherTable(item, tableId) {
  if (!item || item.type !== "cypher" || !item.actor || item.system.depleted) {
    return false;
  }

  const table = (item.system.rollTables ?? [])
    .find(candidate => candidate.id === tableId);
  if (!table) return false;

  let roll;
  try {
    roll = await new Roll(table.formula).evaluate();
  } catch (error) {
    ui.notifications.error(
      `${game.i18n.localize("CYPHER.Ability.InvalidRollTable")}: ${error.message}`
    );
    return false;
  }

  const result = (table.results ?? []).find(
    candidate => roll.total >= candidate.min && roll.total <= candidate.max
  );
  const description = result
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        result.description ?? "",
        { relativeTo: item }
      )
    : `<p>${game.i18n.localize("CYPHER.Ability.NoRollTableResult")}</p>`;

  await item.update({ "system.depleted": true });
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    flavor: `<strong>${item.name}</strong> — ${table.name}<br>${description}`,
    flags: { cypher: {
      rerollable: true,
      rollType: "cypherTable",
      actorId: item.actor.id,
      itemId: item.id,
      tableId,
      originalRoll: roll.total
    } }
  });
  return true;
}

export async function rollAttack(item, {
  effortLevels = 0, assetSteps = 0, difficulty = 3,
  luckyShot = false, skillItemId = null, target = null, oneHanded = false,
  atExtremeRange = false
} = {}) {
  if (item.type !== "attack" || !item.actor) return null;
  const actor = item.actor;
  const baseDamage =
    item.system.damage || CYPHER.weaponDamage[item.system.attackType] || 2;
  const freeWeaponCategories =
    actor.system.freeWeaponCategories ?? CYPHER.coreFreeWeaponCategories;
  const freeWeaponFamilies = actor.system.freeWeaponFamilies ?? [];
  const freeWeaponSkillCategories = actor.system.freeWeaponSkillCategories ?? [];
  const selectedSkill = skillItemId ? actor.items.get(skillItemId) : null;
  const matchingAttackSkill =
    item.system.attackSkillCategory
    && selectedSkill?.type === "skill"
    && selectedSkill.system.attackCategory === item.system.attackSkillCategory
    ? selectedSkill
    : null;
  const weaponIsFamiliar =
    item.system.freelyUsable
    || actor.system.canFreelyUseAllWeapons
    || freeWeaponCategories.includes(item.system.attackType)
    || freeWeaponFamilies.includes(item.system.weaponFamily)
    || freeWeaponSkillCategories.includes(item.system.attackSkillCategory);
  const weaponSkillModifier = resolveWeaponSkillModifier({
    familiar: weaponIsFamiliar,
    skillLevel: matchingAttackSkill?.system.level ?? null
  });
  const weaponHinder = weaponSkillModifier < 0 ? Math.abs(weaponSkillModifier) : 0;
  const oneHandHinder = oneHanded
    && item.system.mechanics?.hinderedWhenUsedOneHanded ? 1 : 0;
  const weaponRangeAdjudication = resolveWeaponRangeAdjudication({
    range: item.system.range,
    extremeRange: item.system.extremeRange,
    atExtremeRange
  });
  const weaponEase = weaponSkillModifier > 0 ? weaponSkillModifier : 0;
  const selectedTarget = target
    ?? (game.user?.targets?.size === 1
      ? [...game.user.targets][0]?.actor
      : null);
  const targetLevel = selectedTarget?.type === "npc"
    ? selectedTarget.system.level
    : null;
  const weaponTargetEffects = resolveWeaponTargetEffects(
    item.system.mechanics?.targetEffects,
    targetLevel
  );
  const weaponEaseSteps = item.system.attackType === "light" ? 1 : 0;
  return actor.rollTask({
    stat: item.system.stat, difficulty, effortLevels, assetSteps, skillItemId,
    isAttack: true, baseDamage,
    extraHinderSteps: weaponHinder + oneHandHinder
      + weaponRangeAdjudication.hinderSteps,
    extraEaseSteps: weaponEaseSteps + weaponEase, luckyShot, weaponTargetEffects,
    targetActor: selectedTarget, weaponRangeAdjudication,
    weaponSource: { itemId: item.id, itemName: item.name },
    armorBypass: item.system.mechanics?.ignoresPhysicalArmor ?? 0,
    flavor: `${game.i18n.localize("CYPHER.Roll.Attack")}: ${item.name}`
  });
}

export async function rollDepletion(item) {
  if (!["artifact", "equipment", "armor"].includes(item.type) || !item.actor) return false;
  const die = item.system.depletionDie;
  if (die === "none") {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      content: `<div class="cypher-roll-card"><h3>${item.name}</h3><p>${game.i18n.localize("CYPHER.Depletion.Never")}</p></div>`
    });
    return true;
  }
  const max = CYPHER.depletionDieMax[die];
  const min = item.system.depletionMin ?? item.system.depletionThreshold ?? 1;
  const maxThreshold = item.system.depletionMax ?? item.system.depletionThreshold ?? min;
  const roll = await new Roll(`1d${max}`).evaluate();
  const depletes = roll.total >= min && roll.total <= maxThreshold;
  if (depletes) await item.update({ "system.depleted": true });
  const flavor = `<div class="cypher-roll-card">`
    + `<h3>${game.i18n.format("CYPHER.Depletion.Title", { name: item.name })}</h3>`
    + `<p>${game.i18n.format("CYPHER.Depletion.Range", { threshold: min === maxThreshold ? min : `${min}–${maxThreshold}`, die })}</p>`
    + `<p class="cypher-result ${depletes ? "failure" : "success"}">`
    + `${depletes ? game.i18n.localize("CYPHER.Depletion.LastUse") : game.i18n.localize("CYPHER.Depletion.StillWorks")}</p>`
    + "</div>";
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    flavor,
    flags: { cypher: {
      rerollable: true, rollType: "depletion", actorId: item.actor.id,
      itemId: item.id, depletionMin: min, depletionMax: maxThreshold, dieMax: max, originalRoll: roll.total
    } }
  });
  return true;
}
