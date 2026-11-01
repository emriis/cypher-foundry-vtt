/** Explicit temporary-NPC selection and fiction declarations; services own rules and all writes. */
import { temporaryFollowerChoices, summonTemporaryFollowers, resumeTemporarySummon, abandonTemporarySummon, dismissTemporaryFollower, configureTemporaryFollower, temporaryEffortMaximum } from "../applications/temporary-follower-service.mjs";
import { temporaryUses, temporaryFollowers, temporaryEquipmentUsable } from "../applications/temporary-follower-read.mjs";
import { recompileTemporaryFollower, finishTemporaryReboot } from "../applications/temporary-machine-service.mjs";
import { reconcileTemporaryDeaths } from "../applications/temporary-death-service.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";
const text = key => game.i18n.localize(`CYPHER.Temporary.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const check = (name, label) => `<label><input type="checkbox" name="${name}"/>${text(label)}</label>`;
const warn = value => { if (!value) ui.notifications.warn(text("unavailable")); };

/** Read-only sheet metadata; historical records stay available for loot and death reconciliation. */
export function temporaryDisplay(actor) {
  return { choices: temporaryFollowerChoices(actor), pending: temporaryUses(actor).filter(use => use.state === "pending"),
    records: temporaryFollowers(actor).map(record => ({ ...record, name: actor.items.get(record.sourceItemId)?.name ?? record.key,
      duplicate: record.family === "duplicate", rebooting: ["pending", "rebooting"].includes(record.state) && record.family === "machine" })) };
}

/** GM-selected NPC profiles encode Health and attacks; no bestiary or PC-to-NPC conversion is guessed. */
export async function promptTemporaryFollower(_event, target) {
  const item = this.actor.items.get(target.dataset.itemId), machine = item?.system.key === "recompile-machine", duplicate = item?.system.key === "duplicate";
  const maximum = temporaryEffortMaximum(this.actor, item?.id);
  const npcs = [...new Map([...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
    .filter(actor => actor?.type === "npc" && actor.isOwner).map(actor => [actor.uuid, actor])).values()];
  if (!npcs.length) return warn(false);
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: item.name }, position: { width: 600 },
    content: `<p>${text("hint")}</p>${machine ? `<p>${text("machineHint")}</p>` : duplicate ? `<p>${text("duplicateHint")}</p>` : `<p>${text("corpseHint")}</p>`}`
      + npcs.map((npc, index) => `<div class="form-group"><label><input name="npc${index}" type="checkbox"/>${escape(npc.name)} (${npc.system.level})</label>`
        + (duplicate ? `<label>${text("levelEffort")}<input name="level${index}" type="number" min="0" max="${maximum}" step="1" value="0"/></label>` : "") + "</div>").join("")
      + check("range", "range") + check("eligible", machine ? "machine" : duplicate ? "newInstances" : "corpses")
      + (!machine && !duplicate ? check("repaired", "repaired") : "")
      + (duplicate ? `<label>${text("extraEffort")}<input type="number" name="extra" min="0" max="${maximum}" step="1" value="0"/></label>` : "")
      + (machine ? `<label>${text("rebootRounds")}<input type="number" name="rounds" min="1" step="1" required value="3"/></label>`
        + `<label>${text("levelEffort")}<input type="number" name="limitEffort" min="0" max="${maximum}" step="1" value="0"/></label>`
        + `<label>${text("easeEffort")}<input type="number" name="ease" min="0" max="${maximum}" step="1" value="0"/></label>` : ""),
    ok: { callback: (_event, button) => {
      const fields = button.form.elements, selected = npcs.map((npc, index) => ({ npc, index })).filter(({ index }) => fields[`npc${index}`].checked);
      return { confirmed: true, inRange: fields.range.checked, eligible: fields.eligible.checked,
        targets: selected.map(({ npc }) => ({ npcUuid: npc.uuid, repaired: fields.repaired?.checked ?? false })),
        duplicateEffort: Number(fields.extra?.value ?? 0), levelEffort: duplicate ? selected.map(({ index }) => Number(fields[`level${index}`].value)) : null,
        rebootRounds: Number(fields.rounds?.value), effectEffort: Number(fields.limitEffort?.value ?? 0), effortLevels: Number(fields.ease?.value ?? 0) };
    } } });
  if (!input) return;
  if (machine) {
    if (input.targets.length !== 1) return warn(false);
    warn(await recompileTemporaryFollower(this.actor, item.id, { ...input, npcUuid: input.targets[0].npcUuid, machine: input.eligible }));
  } else warn(await summonTemporaryFollowers(this.actor, item.id, input));
}
export async function resumeTemporaryFollower(_event, target) { warn(await resumeTemporarySummon(this.actor, target.dataset.useId)); }
export async function abandonTemporaryFollower(_event, target) {
  const confirmed = await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: text("abandon") }, content: `<p>${text("abandonHint")}</p>` });
  if (confirmed) warn(await abandonTemporarySummon(this.actor, target.dataset.useId));
}
export async function dismissTemporaryInstance(_event, target) { warn(await dismissTemporaryFollower(this.actor, target.dataset.recordId)); }
export async function settleTemporaryDeaths() { warn(await reconcileTemporaryDeaths(this.actor)); }
export async function openTemporaryEquipment(_event, target) { await this.actor.items.get(target.dataset.itemId)?.sheet.render({ force: true }); }
export async function openTemporaryFollower(_event, target) {
  const record = this.actor.flags?.cypher?.temporaryFollowers?.[target.dataset.recordId];
  const npc = record && await resolveDocumentReference(record.npcUuid, "npc");
  await npc?.sheet.render({ force: true });
}
export async function promptTemporaryMode(_event, target) {
  const mode = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("mode") },
    content: `<select name="mode">${["attack", "defense", "independent"].map(mode => `<option value="${mode}">${game.i18n.localize(`CYPHER.Follower.${mode}`)}</option>`).join("")}</select>`,
    ok: { callback: (_event, button) => button.form.elements.mode.value } });
  if (mode) warn(await configureTemporaryFollower(this.actor, target.dataset.recordId, mode));
}
export async function promptTemporaryReboot(_event, target) {
  const rounds = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("finishReboot") },
    content: `<p>${text("rebootHint")}</p><input name="rounds" type="number" min="0" step="1" required value="3"/>`,
    ok: { callback: (_event, button) => Number(button.form.elements.rounds.value) } });
  if (rounds !== null) warn(await finishTemporaryReboot(this.actor, target.dataset.recordId, { confirmed: true, elapsedRounds: rounds }));
}

/** Actor/recovery changes refresh disappearance and retained loot; this never mutates documents. */
export function refreshTemporaryPresentation() {
  for (const token of globalThis.canvas?.ready ? canvas.tokens.placeables : []) if (token.actor?.flags?.cypher?.temporaryFollower) {
    token.renderFlags.set({ refreshVisibility: true }); token.initializeVisionSource();
  }
  const actors = new Set([...(game.actors?.contents ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)]);
  for (const actor of actors) {
    const copies = (actor?.items?.contents ?? []).some(item => item.flags?.cypher?.temporaryEquipment);
    // A copied suit can be on a different Actor. Refresh its derived armor
    // against the controller's current flags without writing either document.
    if (copies) actor.reset();
    if (copies || actor?.flags?.cypher?.temporaryFollowers || actor?.flags?.cypher?.temporaryFollower) {
      for (const app of Object.values(actor.apps ?? {})) if (app.rendered) app.render().catch(error => console.error("Cypher | Temporary companion refresh failed", error));
    }
  }
}

/** Combat rounds can complete the declared reboot automatically; narrative rounds use the explicit control. */
export async function advanceTemporaryReboots(combat) {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
  const actors = new Set([...(game.actors?.contents ?? []), ...(combat.combatants?.contents ?? []).map(entry => entry.actor)]);
  for (const actor of actors) for (const record of temporaryFollowers(actor)) {
    if (record.state === "rebooting" && record.combatId === combat.id && combat.round >= record.readyRound) {
      try { await finishTemporaryReboot(actor, record.id, { confirmed: true }); }
      catch (error) { console.error("Cypher | Temporary reboot completion failed", error); }
    }
  }
}

/** NPC inventories expose actual acquired loot while hiding inactive source-created equipment. */
export function temporaryNpcInventory(actor) {
  if (!actor.flags?.cypher?.temporaryFollower) return null;
  return (actor.items?.contents ?? []).filter(temporaryEquipmentUsable).map(item => ({ id: item.id, name: item.name }));
}
