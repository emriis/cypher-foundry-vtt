import { CYPHER } from "../config.mjs";

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

export async function rollAttack(item, {
  effortLevels = 0, assetSteps = 0, difficulty = 3,
  luckyShot = false, skillItemId = null
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
  const practicedAttackSkill =
    item.system.attackSkillCategory
    && selectedSkill?.type === "skill"
    && selectedSkill.system.attackCategory === item.system.attackSkillCategory
    && selectedSkill.system.level === "practiced";
  const weaponIsFamiliar =
    item.system.freelyUsable
    || actor.system.canFreelyUseAllWeapons
    || freeWeaponCategories.includes(item.system.attackType)
    || freeWeaponFamilies.includes(item.system.weaponFamily)
    || freeWeaponSkillCategories.includes(item.system.attackSkillCategory)
    || practicedAttackSkill;
  const weaponHinder = weaponIsFamiliar ? 0 : 1;
  const weaponEaseSteps = item.system.attackType === "light" ? 1 : 0;
  return actor.rollTask({
    stat: item.system.stat, difficulty, effortLevels, assetSteps, skillItemId,
    isAttack: true, baseDamage, extraHinderSteps: weaponHinder,
    extraEaseSteps: weaponEaseSteps, luckyShot,
    flavor: `${game.i18n.localize("CYPHER.Roll.Attack")}: ${item.name}`
  });
}

export async function rollDepletion(item) {
  if (!["artifact", "equipment"].includes(item.type) || !item.actor) return false;
  const die = item.system.depletionDie;
  if (die === "none") {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: item.actor }),
      content: `<div class="cypher-roll-card"><h3>${item.name}</h3><p>${game.i18n.localize("CYPHER.Depletion.Never")}</p></div>`
    });
    return true;
  }
  const max = CYPHER.depletionDieMax[die];
  const threshold = item.system.depletionThreshold;
  const roll = await new Roll(`1d${max}`).evaluate();
  const depletes = roll.total <= threshold;
  if (depletes) await item.update({ "system.depleted": true });
  const flavor = `<div class="cypher-roll-card">`
    + `<h3>${game.i18n.format("CYPHER.Depletion.Title", { name: item.name })}</h3>`
    + `<p>${game.i18n.format("CYPHER.Depletion.Range", { threshold, die })}</p>`
    + `<p class="cypher-result ${depletes ? "failure" : "success"}">`
    + `${depletes ? game.i18n.localize("CYPHER.Depletion.LastUse") : game.i18n.localize("CYPHER.Depletion.StillWorks")}</p>`
    + "</div>";
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: item.actor }),
    flavor,
    flags: { cypher: {
      rerollable: true, rollType: "depletion", actorId: item.actor.id,
      itemId: item.id, threshold, dieMax: max, originalRoll: roll.total
    } }
  });
  return true;
}
