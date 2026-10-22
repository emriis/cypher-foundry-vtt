/** Foundry dialogs collect player intent only; accepted services own all writes. */
import { getWeaponAbilityKind } from "../applications/weapon-ability-service.mjs";
import { getSuperheroicsRank } from "../applications/task-preparation.mjs";
import { getGeneralEffects } from "../applications/general-effect-service.mjs";

/** Select the declared help that applies to this task, preserving unrelated future help. */
export function helpChoiceFields(actor, isDefense = false) {
  const effects = getGeneralEffects(actor).filter(effect => effect.kind === "help" || isDefense && effect.kind === "defenseHelp");
  return effects.length ? `<label>${game.i18n.localize("CYPHER.General.applicableHelp")}<select name="cooperativeEffectIds" multiple>
    ${effects.map(effect => `<option value="${effect.id}">${foundry.utils.escapeHTML(effect.taskLabel || game.i18n.localize("CYPHER.General.defenseHelp"))} (+${effect.assets})</option>`).join("")}
    </select></label>` : "";
}

/**
 * Shared controls for stat, attack and defense tasks. Ordinary free levels are
 * a caller-confirmed grant, not an automatic interpretation of Ability prose.
 * Keep the source declaration visible so limited grants can be adjudicated.
 */
export function taskModifierFields(actor, { stat, isAttack = false, defenseType = null, abilitySource = null, isInitiative = false } = {}) {
  const label = key => game.i18n.localize(`CYPHER.Roll.${key}`);
  const number = (name, key) => `<div class="form-group"><label>${label(key)}
    <input type="number" name="${name}" min="0" max="${6 + getSuperheroicsRank(actor, stat)}" step="1" value="0"/></label></div>`;
  const shifts = actor.system.powerShifts ?? {};
  const shieldEffect = isAttack && ["throw-shield", "bouncing-shield", "unyielding-shield"]
    .includes(actor.items?.get?.(abilitySource?.itemId)?.system.key);
  const selectable = ["dexterity", "intelligence", "resilience", "strength", "savant", "singleAttack", "power"]
    .filter(key => shifts[key] > 0 && !(key === "dexterity" && defenseType === "dodge")
      && !(key === "resilience" && defenseType === "block")
      && !(key === "singleAttack" && !isAttack) && !(key === "savant" && (isAttack || defenseType))
      && !(key === "power" && !abilitySource)
      && !(isAttack && ["dexterity", "intelligence", "resilience"].includes(key)));
  return `${isAttack ? number("damageEffort", "DamageEffort") : ""}
    ${getGeneralEffects(actor).some(effect => effect.kind === "help" || defenseType && effect.kind === "defenseHelp") ? `
      <div class="form-group"><label>${game.i18n.localize("CYPHER.General.cooperation")}<select name="cooperativeMode">
      <option value="none">${game.i18n.localize("CYPHER.General.none")}</option>
      <option value="help">${game.i18n.localize("CYPHER.General.help")}</option></select></label>${helpChoiceFields(actor, Boolean(defenseType))}</div>` : ""}
    ${shieldEffect ? `<div class="form-group"><label><input type="checkbox" name="effectEffort"/>
      ${game.i18n.localize("CYPHER.ShieldAbility.EffectEffort")}</label></div>` : ""}
    <details><summary>${label("ConditionalModifiers")}</summary>
      ${!isAttack && !defenseType ? `<div class="form-group"><label><input name="minorActivity" type="checkbox"/>${game.i18n.localize("CYPHER.Round.Minor")}</label></div>` : ""}
      ${isAttack ? `<div class="form-group"><label><input name="immediateMovement" type="checkbox"/>${game.i18n.localize("CYPHER.Round.HeavyMovement")}</label></div>` : ""}
      <div class="form-group"><label><input name="noPhysicalMovement" type="checkbox"/>${game.i18n.localize("CYPHER.General.noPhysicalMovement")}</label></div>
      ${isAttack ? `<div class="form-group"><label>${game.i18n.localize("CYPHER.General.attackForm")}<select name="attackForm">
        <option value="">${game.i18n.localize("CYPHER.General.unspecified")}</option>
        <option value="melee">${game.i18n.localize("CYPHER.General.melee")}</option>
        <option value="ranged">${game.i18n.localize("CYPHER.General.ranged")}</option></select></label></div>` : ""}
      ${number("freeEffort", "FreeEffort")}
      ${isAttack ? number("freeDamageEffort", "FreeDamageEffort") : ""}
      <div class="form-group"><label>${label("FreeEffortSource")}
        <input type="text" name="freeEffortSource" value=""/></label></div>
      <p class="hint">${label("FreeEffortHint")}</p>
      ${number("extraEase", "ExtraEase")}${number("extraHinder", "ExtraHinderSteps")}
      <p class="hint">${label("ExtraModifiersHint")}</p>
      ${selectable.length ? `<p class="hint">${label("PowerShiftApplicability")}</p>` : ""}
      ${selectable.map(key => `<div class="form-group"><label><input type="checkbox" name="shift-${key}"/>
        ${game.i18n.localize(`CYPHER.PowerShift.${key}`)} (${shifts[key]})</label></div>`).join("")}
    </details>
    ${getSuperheroicsRank(actor, stat) ? `<div class="form-group"><label><input type="checkbox" name="push"/>
      ${label("SuperheroicsPush")}</label></div>${isAttack ? `<div class="form-group"><label>${label("PushDamageEffort")}
      <input type="number" name="pushDamageEffort" value="0" min="0" max="2" step="1"/></label></div>` : ""}` : ""}
    <div class="form-group" ${isInitiative ? "hidden" : ""}><label><input type="checkbox" name="rollRoutine" checked/>
      ${label("RollRoutine")}</label><p class="hint">${label("RollRoutineHint")}</p></div>`;
}

/** Read optional controls; legacy dialog callers have zero additional modifiers. */
export function readTaskModifiers(form) {
  const value = name => Number(form.elements?.namedItem(name)?.value ?? form[name]?.value ?? 0);
  const checked = name => Boolean(form.elements?.namedItem(name)?.checked ?? form[name]?.checked);
  return { minorActivity: checked("minorActivity"), immediateMovement: checked("immediateMovement"), damageEffortLevels: value("damageEffort"), freeEffortLevels: value("freeEffort"),
    ...(form.cooperativeMode ? { cooperativeMode: form.cooperativeMode.value } : {}),
    ...(form.cooperativeEffectIds ? { cooperativeEffectIds: [...form.cooperativeEffectIds.selectedOptions].map(option => option.value) } : {}),
    ...(checked("noPhysicalMovement") ? { noPhysicalMovement: true } : {}),
    ...(form.attackForm?.value ? { attackForm: form.attackForm.value } : {}),
    ...(form.effectEffort ? { effectEffortLevels: checked("effectEffort") ? 1 : 0 } : {}),
    freeDamageEffortLevels: value("freeDamageEffort"), freeEffortSource: form.freeEffortSource?.value ?? "",
    extraEaseSteps: value("extraEase"), extraHinderSteps: value("extraHinder"), push: checked("push"),
    pushDamageEffortLevels: value("pushDamageEffort"),
    rollRoutine: form.rollRoutine?.checked ?? true,
    powerShiftCategories: ["dexterity", "intelligence", "resilience", "strength", "savant", "singleAttack", "power"]
      .filter(key => checked(`shift-${key}`)) };
}

/** Choose the CRD 19/20 alternative after dice and before attack consequences. */
export async function promptSpecialEffect(options) {
  return foundry.applications.api.DialogV2.prompt({ rejectClose: false,
    window: { title: game.i18n.localize("CYPHER.Roll.SpecialChoice") },
    content: `<div class="form-group"><label>${game.i18n.localize("CYPHER.Roll.SpecialChoice")}
      <select name="specialEffect">${options.map(key => `<option value="${key}">${game.i18n.localize(
        key === "damage" ? "CYPHER.Roll.SpecialDamage" : key === "minor" ? "CYPHER.Roll.MinorEffect" : "CYPHER.Roll.MajorEffect"
      )}</option>`).join("")}</select></label></div>`,
    ok: { label: game.i18n.localize("CYPHER.Roll.ConfirmChoice"), callback: (event, button) => button.form.specialEffect.value }
  });
}

/**
 * Collect task/attack options without spending resources.
 * @param {Actor} actor PC supplying Effort limits and skill choices.
 * @param {object} [options={}] Initial difficulty and weapon/Ability context.
 * @returns {Promise<object|null>} Roll inputs, or null when dismissed.
 */
export async function promptRollOptions(actor, {
  difficulty = 3, isAttack = false, weapon = null, isWeaponAbility = false, fixedDifficulty = false,
  stat = weapon?.system.stat, abilitySource = null, isInitiative = false
} = {}) {
  const maxDifficulty = actor.system.maxDifficulty ?? 10;
  const maxEffort = Math.min(6, actor.system.effort ?? 1) + getSuperheroicsRank(actor, stat);

  const skillOptions = actor.items.filter(i => i.type === "skill")
    .map(i => `<option value="${i.id}">${i.name} (${game.i18n.localize(`CYPHER.SkillLevel.${i.system.level}`)})</option>`).join("");

  const content = `
    ${isInitiative ? `<p>${game.i18n.localize("CYPHER.Initiative.Hint")}</p>` : ""}
    <div class="form-group" ${isWeaponAbility || isInitiative ? 'hidden' : ''}>
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
    ${taskModifierFields(actor, { stat, isAttack, abilitySource, isInitiative })}
    ${isAttack && !isWeaponAbility ? `
    <div class="form-group inline">
      <label><input type="checkbox" name="luckyShot"/> ${game.i18n.localize("CYPHER.XP.LuckyShot")} (${CONFIG.CYPHER.xpCosts.luckyShot} ${game.i18n.localize("CYPHER.XP.Label")}, ${game.i18n.localize("CYPHER.XP.LuckyShotHint")})</label>
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
    window: { title: game.i18n.localize(isInitiative ? "CYPHER.Initiative.Label" : isAttack ? "CYPHER.Roll.Attack" : "CYPHER.Roll.Task") },
    content,
    ok: {
      label: game.i18n.localize("CYPHER.Roll.Roll"),
      callback: (event, button) => {
        const form = button.form;
        return {
          ...readTaskModifiers(form),
          chooseSpecialEffect: promptSpecialEffect,
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

/** Collect Speed task choices from the standard combat tracker, before costs or dice. */
export function promptInitiativeOptions(actor) {
  return promptRollOptions(actor, { stat: "speed", difficulty: 0, fixedDifficulty: true, isInitiative: true });
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
