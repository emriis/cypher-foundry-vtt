import { CYPHER } from "../config.mjs";
/** Collect progression choices before the application boundary spends XP or grants Items. */
import { getFocusAbilityChoices } from "../applications/content-service.mjs";
import { getGenreAbilityChoices } from "../applications/advancement-grants.mjs";
import { getAdvancementChoices, getTierAdvancementOptions, purchaseAdvancementSlot, selectAdvancementAbility, clearAdvancementInterruption, canAdvanceOwnedSkill } from "../applications/advancement-service.mjs";
import { promptWeaponAttackCategory } from "./dialogs.mjs";

const label = key => game.i18n.localize(`CYPHER.Advancement.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

/** Paid and free grants share source selection; cancelling either dialog writes nothing. */
async function promptGrant(actor, kind, tier) {
  let genre = actor.system.genre;
  if (kind === "genre" && genre === "custom") {
    genre = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("GenreChoice") },
      content: `<label>${label("GenreChoice")}<select name="genre">${["fantasy", "sciFi", "superhero"].map(value => `<option value="${value}">${game.i18n.localize(`CYPHER.Genre.${value}`)}</option>`).join("")}</select></label>`,
      ok: { callback: (_event, button) => button.form.elements.genre.value } });
    if (!genre) return null;
  }
  const choices = kind === "focus" ? getFocusAbilityChoices(actor).filter(ability => ability.tier <= Math.min(tier, 6))
    : await getGenreAbilityChoices(actor, tier, genre);
  if (!choices.length) { ui.notifications.warn(label("NoChoices")); return null; }
  const id = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label(kind === "focus" ? "FocusChoice" : "GenreChoice") },
    content: `<label>${label("AbilityChoice")}<select name="${kind}Ability">${choices.map(choice => `<option value="${escape(choice.id)}">${escape(choice.name)}</option>`).join("")}</select></label>`,
    ok: { callback: (_event, button) => button.form.elements[`${kind}Ability`].value } });
  const selected = choices.find(choice => choice.id === id);
  if (!selected) return null;
  // Genre source metadata is re-resolved here for the optional weapon category;
  // the application rechecks the complete source again before mutation.
  let needsCategory = selected.chooseWeaponAttackCategory;
  if (kind === "genre") {
    const { resolveDocumentReference } = await import("../applications/reference-resolver.mjs");
    const source = await resolveDocumentReference(selected.uuid, "ability");
    if (!source) return null;
    needsCategory = source.system.chooseWeaponAttackCategory;
  }
  const weaponSkillCategory = needsCategory ? await promptWeaponAttackCategory() : null;
  if (needsCategory && !weaponSkillCategory) return null;
  return { abilityId: selected.id, abilityUuid: selected.uuid, weaponSkillCategory, genre };
}

/** Four-slot purchase action. The actual service revalidates every collected value. */
export async function promptAdvancementPurchase(_event, target) {
  const actor = this.actor, index = Number(target.dataset.slot), slot = actor.system.advancementSlots[index];
  if (!slot || slot.bought) return;
  let extra = {};
  if (slot.type === "other" && ["focus", "genre"].includes(slot.otherType)) {
    extra = await promptGrant(actor, slot.otherType, actor.system.tier);
    if (!extra) return;
  } else if (["capabilities", "perfection", "skill"].includes(slot.type)) {
    let content;
    if (slot.type === "capabilities") content = `<p>${label("CapabilitiesDialogHint")}</p>${["might", "speed", "intellect"].map(stat => `<label>${game.i18n.localize(`CYPHER.Stat.${stat}`)}<input type="number" name="${stat}" min="0" max="4" step="1" value="0" required/></label>`).join("")}`;
    if (slot.type === "perfection") content = `<label>${game.i18n.localize("CYPHER.Stat.Label")}<select name="stat">${["might", "speed", "intellect"].map(stat => `<option value="${stat}">${game.i18n.localize(`CYPHER.Stat.${stat}`)}</option>`).join("")}</select></label>`;
    if (slot.type === "skill") {
      const skills = actor.items.filter(item => item.type === "skill");
      content = `<p>${label("SkillGates")}</p><label>${label("PickExistingSkill")}<select name="skillId"><option value="">—</option>${skills.map(item => `<option value="${escape(item.id)}" ${canAdvanceOwnedSkill(item, actor.system.tier) ? "" : "disabled"}>${escape(item.name)} (${game.i18n.localize(`CYPHER.SkillLevel.${item.system.level}`)})</option>`).join("")}</select></label>
        <label>${label("OrNewSkillName")}<input name="newSkillName" type="text"/></label>
        <label>${label("SkillKind")}<select name="skillKind">${["general", "attack", "defense"].map(kind => `<option value="${kind}">${label(`SkillKind_${kind}`)}</option>`).join("")}</select></label>
        <label>${label("AttackCategory")}<select name="attackCategory"><option value="">${label("NoAttackCategory")}</option>${CYPHER.attackSkillCategories.map(category => `<option value="${category}">${game.i18n.localize(`CYPHER.AttackSkill.${category}`)}</option>`).join("")}</select></label>`;
    }
    extra = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label(slot.type) }, content,
      ok: { label: game.i18n.localize("CYPHER.Confirm.Add"), callback: (_event, button) => {
        const fields = button.form.elements;
        if (slot.type === "capabilities") return { distribution: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, Number(fields[stat].value)])) };
        if (slot.type === "perfection") return { stat: fields.stat.value };
        return { skillId: fields.skillId.value || null, newSkillName: fields.newSkillName.value, skillKind: fields.skillKind.value, attackCategory: fields.attackCategory.value };
      } } });
    if (!extra) return;
  }
  const transition = await getTierAdvancementOptions(actor, index, extra);
  if (transition) {
    extra.tierChoices = {};
    for (const kind of transition.kinds) {
      const choice = await promptGrant(transition.actor, kind, transition.tier);
      if (!choice) return;
      extra.tierChoices[kind] = choice;
    }
  }
  await purchaseAdvancementSlot(actor, index, extra);
}

/** Consume the selected saved entitlement, including an older tier's pending choice. */
export async function promptAdvancementChoice(_event, target) {
  const choice = getAdvancementChoices(this.actor).find(choice => choice.id === target.dataset.choiceId);
  if (!choice) return;
  const options = await promptGrant(this.actor, choice.kind, choice.tier);
  if (options) await selectAdvancementAbility(this.actor, choice.id, options);
}

/** GM confirms reconciliation of already committed state; no automatic refund or rollback. */
export async function promptAdvancementReconciliation() {
  if (!game.user.isGM) return;
  const accepted = await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label("Reconcile") }, content: `<p>${label("ReconcileHint")}</p>` });
  if (accepted) await clearAdvancementInterruption(this.actor, { reconciled: true });
}
