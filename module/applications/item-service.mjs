import { roundActionContext } from "./round-action-service.mjs";
import { companionEquipmentUsable } from "./companion-upgrade-read.mjs";
import { runCypherActivation } from "./cypher-inventory-service.mjs";
import { equipmentAttackProblem, equipmentGrip } from "./equipment-hands-service.mjs";
import { minimumWeaponHands } from "../rules/equipment-hands.mjs";
import { runActorAction } from "./action-guard.mjs";
import { CYPHER } from "../config.mjs";
import {
  resolveWeaponConfiguration,
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

/**
 * Mark a Cypher as used, then announce its use in chat.
 * This action only consumes the Item; its descriptive power needs adjudication.
 *
 * @param {Item} item Cypher to consume.
 * @returns {Promise<boolean>} True after depletion and chat; false for invalid, depleted, unauthorized or busy Items.
 */
export async function useCypher(item) {
  if (!item || item.isOwner === false) return false;
  return runCypherActivation(item, () => useCypherAccepted(item));
}

/** Plain names enter HTML chat output; descriptive HTML is enriched separately. */
const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

async function useCypherAccepted(item) {
  if (item.type !== "cypher" || item.system.depleted) return false;
  await item.update({ "system.depleted": true });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content: `<h3>${escape(item.name)}</h3><p>${game.i18n.localize("CYPHER.Cypher.Used")}</p><p>${game.i18n.localize("CYPHER.CypherLife.effectsDeferred")}</p>`
  });
  return true;
}

/**
 * Roll a Cypher's structured power variants on a d100 and consume it.
 *
 * @param {Item} item Cypher Item.
 * @returns {Promise<boolean>} Whether a variant was resolved.
 */
export async function rollCypherVariant(item) {
  if (!item || item.isOwner === false) return false;
  return runCypherActivation(item, () => rollCypherVariantAccepted(item), () => Boolean(item.system.variants?.length));
}

async function rollCypherVariantAccepted(item) {
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
    flavor: `<strong>${escape(item.name)}</strong> — ${escape(variant.name)} (${escape(game.i18n.localize(`CYPHER.CypherLife.${variant.powerLevel}`))})`,
    flags: { cypher: {
      rerollable: true,
      rollType: "cypherVariant",
      actorId: item.actor.id,
      actorUuid: item.actor.uuid,
      itemId: item.id,
      variantName: variant.name,
      powerLevel: variant.powerLevel,
      rollFormula: "1d100",
      originalRoll: roll.total
    } }
  });
  return true;
}

/**
 * Roll an inline result table and consume the one-use Cypher.
 * Invalid table IDs or formulas return false before depletion. A valid roll
 * consumes the Item even if no range matches; chat then reports the missing result.
 *
 * @param {Item} item Actor-owned, unspent Cypher.
 * @param {string} tableId Identifier within system.rollTables, not a world RollTable UUID.
 * @returns {Promise<boolean>} Whether a valid table roll was completed.
 */
export async function rollCypherTable(item, tableId) {
  if (!item || item.isOwner === false) return false;
  return runCypherActivation(item, () => rollCypherTableAccepted(item, tableId), () => {
    const table = item.system.rollTables?.find(table => table.id === tableId);
    if (!table) return false;
    try { new Roll(table.formula); return true; } catch { return false; }
  });
}

async function rollCypherTableAccepted(item, tableId) {
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
    flavor: `<strong>${escape(item.name)}</strong> — ${escape(table.name)}<br>${description}`,
    flags: { cypher: {
      rerollable: true,
      rollType: "cypherTable",
      actorId: item.actor.id,
      actorUuid: item.actor.uuid,
      itemId: item.id,
      tableId,
      rollFormula: table.formula,
      originalRoll: roll.total
    } }
  });
  return true;
}

/**
 * Translate a weapon and player choices into the shared task-roll contract.
 * Familiarity, range, and weapon category alter difficulty; the task service
 * spends Effort, rolls the d20, and applies successful target consequences.
 *
 * @param {Item} item Attack embedded in the acting character.
 * @param {object} [options={}] Roll choices and optional Ability context.
 * @param {Actor|null} [options.target=null] Explicit target, including a token's synthetic Actor.
 * @param {number} [options.difficulty=3] Difficulty before ease/hindrance steps.
 * @param {number} [options.spentAbilityEdge=0] Edge already used by this action's Ability cost.
 * @returns {Promise<object|null>} Task result, or null when the attack is rejected.
 */
export async function rollAttack(item, options = {}) {
  const task = prepareAttackOptions(item, options);
  return task ? item.actor.rollTask(task) : null;
}

/**
 * Read-only weapon translation, reused before each action of a multi-attack
 * Ability. This returns levels/steps and the actual target Actor; it neither
 * pays costs nor rolls dice. A rejected Item yields null.
 * @param {Item} item Actor-owned attack.
 * @param {object} options Player choices and source context.
 * @returns {object|null} Shared task-service inputs.
 */
export function prepareAttackOptions(item, {
  effortLevels = 0, assetSteps = 0, difficulty = 3,
  luckyShot = false, skillItemId = null, target = null, oneHanded = false,
  atExtremeRange = false, extraHinderSteps = 0, damageAdjustment = 0,
  abilitySource = null, spentAbilityEdge = 0, immediateMovement = false, ...taskOptions
} = {}) {
  if (item.type !== "attack" || !item.actor) return null;
  if (!companionEquipmentUsable(item)) return null;
  const actor = item.actor;
  const equipmentProblem = equipmentAttackProblem(item, { abilitySource, equipmentFlightId: taskOptions.equipmentFlightId });
  if (equipmentProblem) {
    ui.notifications.warn(game.i18n.localize(`CYPHER.EquipmentHands.${equipmentProblem}`));
    return null;
  }
  const actualGrip = equipmentGrip(actor.items?.get?.(item.id) ?? item);
  if (oneHanded && actualGrip?.hands !== 1) return null;
  const weaponConfiguration = resolveWeaponConfiguration(item.system);
  const attackType = weaponConfiguration.attackType;
  const baseDamage = weaponConfiguration.baseDamage;
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
    || freeWeaponCategories.includes(attackType)
    || freeWeaponFamilies.includes(item.system.weaponFamily)
    || freeWeaponSkillCategories.includes(item.system.attackSkillCategory);
  const weaponSkillModifier = resolveWeaponSkillModifier({
    familiar: weaponIsFamiliar,
    skillLevel: matchingAttackSkill?.system.level ?? null
  });
  const weaponHinder = weaponSkillModifier < 0 ? Math.abs(weaponSkillModifier) : 0;
  const oneHandHinder = actualGrip?.hands === 1
    && item.system.mechanics?.hinderedWhenUsedOneHanded ? 1 : 0;
  const weaponRangeAdjudication = resolveWeaponRangeAdjudication({
    range: item.system.range,
    extremeRange: item.system.extremeRange,
    atExtremeRange
  });
  const weaponEase = weaponSkillModifier > 0 ? weaponSkillModifier : 0;
  // Keep the supplied Actor object: resolving it again by world ID would lose
  // token-specific state for an unlinked (synthetic) Actor.
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
  const weaponEaseSteps = attackType === "light" ? 1 : 0;
  const task = {
    ...taskOptions,
    // Matching attack training is already part of weaponSkillModifier. Passing
    // it again into the generic skill slot would ease the attack twice.
    stat: item.system.stat, difficulty, effortLevels, assetSteps,
    skillItemId: matchingAttackSkill ? null : skillItemId,
    isAttack: true, baseDamage: Math.max(0, baseDamage + damageAdjustment),
    extraHinderSteps: extraHinderSteps + weaponHinder + oneHandHinder
      + weaponRangeAdjudication.hinderSteps + (immediateMovement && attackType === "heavy" ? 1 : 0),
    extraEaseSteps: weaponEaseSteps + weaponEase + (item.flags?.cypher?.companionEquipment?.kind === "turret" ? 1 : 0), luckyShot, weaponTargetEffects,
    targetActor: selectedTarget, weaponRangeAdjudication, abilitySource, spentAbilityEdge,
    weaponSource: {
      itemId: item.id,
      itemName: item.name,
      skillItemId,
      configuration: weaponConfiguration.configuration,
      attackType,
      actionTiming: weaponConfiguration.actionTiming,
      equipmentFlightId: taskOptions.equipmentFlightId ?? null
    },
    armorBypass: item.system.mechanics?.ignoresPhysicalArmor ?? 0,
    flavor: `${game.i18n.localize("CYPHER.Roll.Attack")}: ${item.name}`
  };
  const context = roundActionContext(actor, task);
  return context && !context.kind ? null : task;
}

/**
 * Check whether an Artifact, equipment Item, or armor exhausts its final use.
 * Depletion uses an inclusive range; a "none" die produces chat without a roll.
 *
 * @param {Item} item Supported Item embedded in an Actor.
 * @returns {Promise<boolean>} Whether a supported depletion check was handled.
 */
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


/** Switch a weapon between its CRD-defined primary and alternate configurations. */
export async function toggleAttackConfiguration(item) {
  if (!item || item.isOwner === false || item.actor?.isOwner === false) return false;
  return (await runActorAction(item.actor ?? item, "weaponConfiguration", () => toggleWeaponConfiguration(item))) ?? false;
}

/** Configuration changes share the equipment owner's local reservation with attacks and grip changes. */
async function toggleWeaponConfiguration(item) {
  if (item?.type !== "attack" || !item.system.mechanics?.alternateConfiguration?.enabled) {
    return false;
  }
  const current = item.system.mechanics.activeConfiguration === "alternate"
    ? "alternate" : "primary";
  const next = current === "primary" ? "alternate" : "primary";
  const grip = equipmentGrip(item);
  const nextSystem = { ...item.system, mechanics: { ...item.system.mechanics, activeConfiguration: next } };
  if (item.isOwner === false || item.actor?.isOwner === false
    || grip?.held && grip.hands < minimumWeaponHands(nextSystem)) return false;
  await item.update({ "system.mechanics.activeConfiguration": next });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    content: "<p>" + game.i18n.format("CYPHER.Attack.ConfigurationChanged", {
      name: item.name,
      configuration: game.i18n.localize("CYPHER.Attack.Configuration." + next),
      action: game.i18n.localize("CYPHER.Attack.ConfigurationAction")
    }) + "</p>",
    flags: { cypher: {
      rollType: "weaponConfiguration",
      actorId: item.actor?.id ?? null,
      itemId: item.id,
      configuration: next,
      actionCost: "action"
    } }
  });
  return next;
}


/** Return the active weapon configuration for sheet presentation. */
export function getWeaponConfiguration(item) {
  if (item?.type !== "attack") return null;
  return resolveWeaponConfiguration(item.system);
}
