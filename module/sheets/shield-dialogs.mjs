/** Collect shield Ability intent; services validate and persist the actual documents. */
import { getDesignatedShield, getShieldAbilityKind } from "../applications/shield-lifecycle-service.mjs";
import { getAvailableShields } from "../applications/equipment-service.mjs";
import { shieldAttackProfile } from "../applications/shield-attack-service.mjs";
import { promptRollOptions } from "./dialogs.mjs";

const label = key => game.i18n.localize(`CYPHER.ShieldAbility.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value));

/** Choose the physical shield, operation and ordered targets; closing writes nothing. */
export async function promptShieldAbility(ability) {
  const actor = ability.actor, kind = getShieldAbilityKind(ability);
  const designated = getDesignatedShield(ability);
  const special = ["hidden-shield", "unyielding-shield"].includes(kind);
  const shields = special ? designated ? [designated] : actor.items.filter(item => item.type === "shield" && !item.system.abilityItemId)
    : getAvailableShields(actor);
  const operations = special && !designated ? ["create", "bind"]
    : kind === "hidden-shield" ? ["melee", "paired", "startWork", "finishWork", "retrieve"]
      : kind === "unyielding-shield" ? ["melee", "throw", "startWork", "finishWork", "retrieve"] : ["throw"];
  const targeted = [...(game.user?.targets ?? [])].map(token => token.actor).filter(actor => actor?.type === "npc");
  const candidates = targeted.length ? targeted : game.actors.filter(actor => actor.type === "npc" && actor.isOwner);
  const option = (value, name) => `<option value="${escape(value)}">${escape(name)}</option>`;
  const targetField = index => `<div class="form-group"><label>${label("Target")} ${index + 1}
    <select name="target${index}">${candidates.map((actor, i) => option(i, actor.name)).join("")}</select></label></div>`;
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false,
    window: { title: ability.name },
    content: `<div class="form-group"><label>${label("Operation")}<select name="operation">${operations.map(key => option(key, label(key))).join("")}</select></label></div>
      <div class="form-group"><label>${game.i18n.localize("CYPHER.Shield.Title")}<select name="shieldId">${shields.map(shield => option(shield.id, shield.name)).join("")}</select></label></div>
      ${special && !designated ? "" : `${targetField(0)}${kind === "bouncing-shield" ? targetField(1) + targetField(2) : kind === "hidden-shield" ? targetField(1) : ""}
      <div class="form-group"><label>${label("MeleeStat")}<select name="stat">${["might", "speed"].map(stat => option(stat, game.i18n.localize(`CYPHER.Stat.${stat}`))).join("")}</select></label></div>
      ${kind === "hidden-shield" ? `<div class="form-group"><label>${label("MainAttack")}<select name="mainAttackId">${actor.items.filter(item => item.type === "attack").map(item => option(item.id, item.name)).join("")}</select></label></div>` : ""}
      <p>${label("RangeHint")}</p><label><input type="checkbox" name="rangeConfirmed"/> ${label("RangeConfirmed")}</label>`}`,
    ok: { label: label("Continue"), callback: (event, button) => {
      const form = button.form, mode = form.operation.value;
      const count = mode === "paired" ? 2 : kind === "bouncing-shield" ? 3 : 1;
      return { operation: mode, shieldId: form.shieldId?.value || null, stat: form.stat?.value ?? "might",
        mainAttackId: form.mainAttackId?.value || null, rangeConfirmed: form.rangeConfirmed?.checked === true,
        targets: Array.from({ length: count }, (_, i) => candidates[Number(form[`target${i}`]?.value)]) };
    } }
  });
  if (!result || !["throw", "melee", "paired"].includes(result.operation)) return result;
  if (!result.rangeConfirmed || result.targets.some(target => !target)) return null;
  const shield = actor.items.get(result.shieldId);
  if (!shield) return null;
  const chooseAttackOptions = async ({ index }) => {
    const weapon = result.operation === "paired" && index === 0 ? actor.items.get(result.mainAttackId)
      : shieldAttackProfile(shield, { thrown: result.operation === "throw", stat: result.stat });
    if (!weapon) return null;
    const options = await promptRollOptions(actor, { difficulty: result.targets[index].system.level,
      fixedDifficulty: true, isAttack: true, isWeaponAbility: true, weapon, abilitySource: { itemId: ability.id } });
    return options ? { ...options, stat: result.stat } : null;
  };
  const rollOptions = await chooseAttackOptions({ index: 0 });
  if (!rollOptions) return null;
  return { ...result, mode: result.operation, rollOptions, chooseAttackOptions,
    chooseCatchOptions: () => promptRollOptions(actor, { difficulty: 2, fixedDifficulty: true, stat: "speed" }) };
}

/** Confirm resources/qualification or completed sustained work; cancellation writes nothing. */
export async function confirmShieldWork(completed = false) {
  return foundry.applications.api.DialogV2.confirm({ rejectClose: false,
    window: { title: label(completed ? "finishWork" : "startWork") },
    content: `<p>${label(completed ? "WorkCompletedConfirm" : "ResourcesConfirm")}</p>` });
}
