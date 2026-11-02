/** Explicit protective source and energy declarations; services own costs and mechanical validation. */
import { activateProtection, resumeProtection, abandonProtection, endProtection, recordNpcProtectionRecovery } from "../applications/protection-power-service.mjs";
import { protectionBlockPlan, protectionEnergyChoices } from "../applications/protection-power-read.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";
const text = key => game.i18n.localize(`CYPHER.Protection.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const warn = result => { if (!result) ui.notifications.warn(text("unavailable")); };

/** Dedicated energy data, never a guessed property of an Item's name or prose. */
export function protectionEnergyField() {
  return `<label>${text("energy")}<input name="incomingEnergy" list="cypher-protection-energies" placeholder="${escape(text("untyped"))}"/></label>
    <datalist id="cypher-protection-energies">${protectionEnergyChoices().map(energy => `<option value="${escape(energy)}">${escape(["fire", "cold", "electricity"].includes(energy) ? text(energy) : energy)}</option>`).join("")}</datalist>`;
}
export function protectionDefenseFields(actor, { block = true } = {}) {
  return protectionEnergyField() + (block && protectionBlockPlan(actor)?.mageAvailable
    ? `<label><input name="mageArmor" type="checkbox"/>${text("mageBlock")}</label>` : "");
}

/** Collect every recipient and confirm fiction before invoking the paid service. */
export async function promptProtection(_event, target) {
  const item = this.actor.items.get(target.dataset.itemId);
  if (!item || !game.user.isGM) return;
  const elemental = item.system.key === "elemental-protection";
  const candidates = [...new Map([...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
    .filter(actor => ["pc", "npc"].includes(actor?.type) && actor.isOwner && actor.uuid !== this.actor.uuid).map(actor => [actor.uuid, actor])).values()];
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: item.name }, position: { width: 560 },
    content: `<p data-protection-dialog>${text("activationHint")}</p>` + (elemental ? `<p>${text("elementalHint")}</p>${protectionEnergyField()}
      <label>${text("effectEffort")}<input name="effectEffort" type="number" min="0" max="2" step="1" value="0" required/></label>
      ${candidates.map((actor, index) => `<label><input type="checkbox" name="target${index}"/>${escape(actor.name)}</label>`).join("")}
      <label><input name="inRange" type="checkbox"/>${text("inRange")}</label>` : "")
      + (item.system.key === "armoring-debris" ? `<label><input name="debris" type="checkbox"/>${text("debris")}</label>` : ""),
    ok: { callback: (_event, button) => {
      const fields = button.form.elements;
      return { confirmed: true, inRange: fields.inRange?.checked ?? false, debris: fields.debris?.checked ?? false,
        energy: fields.incomingEnergy?.value ?? "", effort: Number(fields.effectEffort?.value ?? 0),
        targetUuids: candidates.filter((_actor, index) => fields[`target${index}`]?.checked).map(actor => actor.uuid) };
    } } });
  if (input) warn(await activateProtection(this.actor, item.id, input));
}
export async function resumeProtectionAction(_event, target) { warn(await resumeProtection(this.actor, target.dataset.protectionId)); }
export async function abandonProtectionAction(_event, target) {
  if (await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: text("abandon") }, content: `<p>${text("abandonHint")}</p>` })) {
    warn(await abandonProtection(this.actor, target.dataset.protectionId));
  }
}
export async function endProtectionAction(_event, target) { warn(await endProtection(this.actor, target.dataset.protectionId)); }
export async function npcProtectionRest(_event, target) {
  const npc = await resolveDocumentReference(target.dataset.recipientUuid, "npc");
  if (await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: text("npcRest") }, content: `<p>${text("npcRestHint")}</p>` })) {
    warn(await recordNpcProtectionRecovery(npc, { confirmed: true, interval: "hour" }));
  }
}

/** A caster's final acknowledgement changes recipient displays without another write to their Actors. */
export function refreshProtectionSheets() {
  const actors = new Set([...(game.actors?.contents ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)]);
  for (const actor of actors) if (actor?.flags?.cypher?.protections || actor?.flags?.cypher?.protectionUses) {
    for (const sheet of Object.values(actor.apps ?? {})) if (sheet.rendered) sheet.render().catch(error => console.error("Cypher | Protection display refresh failed", error));
  }
}
