/** Foundry dialogs collect player intent only; accepted services own all writes. */
import { getWeaponAbilityKind } from "../applications/weapon-ability-service.mjs";

/**
 * Collect task/attack options without spending resources.
 * @param {Actor} actor PC supplying Effort limits and skill choices.
 * @param {object} [options={}] Initial difficulty and weapon/Ability context.
 * @returns {Promise<object|null>} Roll inputs, or null when dismissed.
 */
export async function promptRollOptions(actor, {
  difficulty = 3, isAttack = false, weapon = null, isWeaponAbility = false, fixedDifficulty = false
} = {}) {
  const maxDifficulty = actor.system.maxDifficulty ?? 10;
  const maxEffort = actor.system.effort ?? 1;

  const skillOptions = actor.items.filter(i => i.type === "skill")
    .map(i => `<option value="${i.id}">${i.name} (${game.i18n.localize(`CYPHER.SkillLevel.${i.system.level}`)})</option>`).join("");

  const content = `
    <div class="form-group" ${isWeaponAbility ? 'hidden' : ''}>
      <label>${game.i18n.localize("CYPHER.Roll.Difficulty")}</label>
      <input type="number" name="difficulty" value="${difficulty}" min="0" max="${maxDifficulty}" ${fixedDifficulty ? "readonly" : ""}/>
    </div>
    <div class="form-group">
      <label>${game.i18n.localize("CYPHER.Roll.LinkedSkill")}</label>
      <select name="skillItemId">
        <option value="">${game.i18n.localize("CYPHER.Roll.NoSkill")}</option>
        ${skillOptions}
      </select>
    </div>
    <div class="form-group">
      <label>${game.i18n.localize("CYPHER.Roll.EffortLevels")} (${game.i18n.format("CYPHER.Roll.MaxEffortHint", { max: maxEffort })})</label>
      <input type="number" name="effort" value="0" min="0" max="${maxEffort}"/>
    </div>
    <div class="form-group">
      <label>${game.i18n.localize("CYPHER.Roll.AssetSteps")}</label>
      <input type="number" name="assets" value="0" min="0" max="2"/>
    </div>
    ${isAttack && !isWeaponAbility ? `
    <div class="form-group inline">
      <label><input type="checkbox" name="luckyShot"/> ${game.i18n.localize("CYPHER.XP.LuckyShot")} (${CONFIG.CYPHER.xpCosts.luckyShot} PX, ${game.i18n.localize("CYPHER.XP.LuckyShotHint")})</label>
    </div>` : ""}
    ${isAttack && weapon?.system?.mechanics?.hinderedWhenUsedOneHanded ? `
    <div class="form-group inline">
      <label><input type="checkbox" name="oneHanded"/> ${game.i18n.localize("CYPHER.Attack.OneHanded")}</label>
      <p class="hint">${game.i18n.localize("CYPHER.Attack.OneHandedHint")}</p>
    </div>` : ""}
    ${isAttack ? `
    <div class="form-group inline">
      <label><input type="checkbox" name="atExtremeRange"/> ${game.i18n.localize("CYPHER.Attack.ExtremeRange")}</label>
      <p class="hint">${game.i18n.localize("CYPHER.Attack.ExtremeRangeHint")}</p>
    </div>` : ""}`;

  return foundry.applications.api.DialogV2.prompt({
    rejectClose: false,
    window: { title: isAttack ? game.i18n.localize("CYPHER.Roll.Attack") : game.i18n.localize("CYPHER.Roll.Task") },
    content,
    ok: {
      label: game.i18n.localize("CYPHER.Roll.Roll"),
      callback: (event, button) => {
        const form = button.form;
        return {
          difficulty: Number(form.difficulty.value),
          effortLevels: Number(form.effort.value),
          assetSteps: Number(form.assets.value),
          skillItemId: form.skillItemId.value || null,
          luckyShot: isAttack ? !!form.luckyShot?.checked : false,
          oneHanded: isAttack ? !!form.oneHanded?.checked : false,
          atExtremeRange: isAttack ? !!form.atExtremeRange?.checked : false
        };
      }
    }
  });
}

/**
 * Collect a weapon training category without applying it to the Actor.
 * @returns {Promise<string|null>} Category key, or null when dismissed.
 */
export async function promptWeaponAttackCategory() {
  return foundry.applications.api.DialogV2.prompt({
    rejectClose: false,
    window: { title: game.i18n.localize("CYPHER.FocusSelection.ChooseWeaponCategoryTitle") },
    content: `<div class="form-group">
      <label>${game.i18n.localize("CYPHER.FocusSelection.ChooseWeaponCategory")}</label>
      <select name="weaponCategory">${CONFIG.CYPHER.attackSkillCategories.map(category =>
        `<option value="${category}">${game.i18n.localize(`CYPHER.AttackSkill.${category}`)}</option>`
      ).join("")}</select>
    </div>`,
    ok: {
      label: game.i18n.localize("CYPHER.Confirm.Add"),
      callback: (event, button) => button.form.weaponCategory.value
    }
  });
}

/**
 * Select explicit targets and adjacency/reach declarations for a weapon Ability.
 * Preserve selected token Actors instead of replacing them with world Actors.
 * @param {Actor} actor PC choosing its weapon.
 * @param {Item} item Actor-owned Spray/Arc Spray Ability.
 * @returns {Promise<object|null>} Service inputs or null on cancellation.
 */
export async function promptWeaponAbility(actor, item) {
  const kind = getWeaponAbilityKind(item);
  if (!kind) return null;
  const escape = value => foundry.utils.escapeHTML(String(value));
  const weapons = actor.items.filter(candidate => candidate.type === "attack");
  const npcChoices = new Map(game.actors.filter(candidate => candidate.type === "npc")
    .map(actor => [actor.id, actor]));
  const selected = [...(game.user.targets ?? [])].map(token => {
    if (token.actor?.type !== "npc") return null;
    // Preserve synthetic Actors: targeting an unlinked token must not damage
    // its world Actor or another token derived from the same Actor.
    const key = token.actor.isToken ? token.document.uuid : token.actor.id;
    npcChoices.set(key, token.actor);
    return key;
  });
  const targetCount = kind === "arc-spray" ? 3 : 1;
  const selection = await foundry.applications.api.DialogV2.prompt({
    rejectClose: false,
    window: { title: item.name },
    content: `<div class="form-group"><label>${game.i18n.localize("CYPHER.WeaponAbility.Weapon")}</label>
      <select name="weaponId">${weapons.map(weapon => `<option value="${weapon.id}">${escape(weapon.name)}</option>`).join("")}</select></div>
      ${Array.from({ length: targetCount }, (_, index) => `<div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.Target")} ${index + 1}</label>
        <select name="target${index}">${[...npcChoices].map(([key, npc]) => `<option value="${key}" ${selected[index] === key ? "selected" : ""}>${escape(npc.name)} (${npc.system.level})</option>`).join("")}</select></div>`).join("")}
      <p>${game.i18n.localize("CYPHER.WeaponAbility.TargetDifficulty")}</p>
      <label><input type="checkbox" name="confirmed"/> ${game.i18n.localize(kind === "arc-spray"
        ? "CYPHER.WeaponAbility.Adjacent" : "CYPHER.WeaponAbility.ThrownInReach")}</label>`,
    ok: {
      label: game.i18n.localize("CYPHER.Roll.Attack"),
      callback: (event, button) => ({
        weaponId: button.form.weaponId.value,
        targetIds: Array.from({ length: targetCount }, (_, index) => button.form[`target${index}`].value),
        confirmed: button.form.confirmed.checked
      })
    }
  });
  // The caller collects roll options next, before invoking the spending service.
  // Cancelling this selection leaves the character's resources untouched.
  if (!selection) return null;
  return { weaponId: selection.weaponId,
    targets: selection.targetIds.map(id => npcChoices.get(id)),
    allAdjacent: kind === "arc-spray" && selection.confirmed,
    thrownWeaponsInReach: kind === "spray" && selection.confirmed };
}
