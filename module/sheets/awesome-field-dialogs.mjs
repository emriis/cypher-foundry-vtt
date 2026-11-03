/** Collect declared geometry and observed outcomes; mechanical validation stays in application services. */
import { activateAwesomePersonal, restoreAwesomePersonal } from "../applications/awesome-personal-service.mjs";
import { createAwesomeBarrier, resumeAwesomeBarrier, endAwesomeBarrier, containWithAwesomeBarrier, reconcileAwesomeCapture, releaseAwesomeContainment } from "../applications/awesome-barrier-service.mjs";
import { awesomeBarrierObstructs } from "../applications/awesome-field-read.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";
const text = key => game.i18n.localize(`CYPHER.Awesome.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const warn = result => { if (!result) ui.notifications.warn(text("unavailable")); };
const confirm = key => foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: text(key) }, content: `<p>${text(`${key}Hint`)}</p>` });

/** Called only after the rolled Block, before consequences; closing keeps the residual wound. */
export async function promptFieldShatter({ cost }) {
  return foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: text("shatter") },
    content: `<p data-awesome-shatter>${game.i18n.format("CYPHER.Awesome.shatterHint", { cost })}</p>` });
}
export async function activateAwesomeAction(_event, target) {
  if (await confirm("activate")) warn(await activateAwesomePersonal(this.actor, target.dataset.itemId, { confirmed: true }));
}
export async function restoreAwesomeAction() {
  if (await confirm("restore")) warn(await restoreAwesomePersonal(this.actor, { confirmed: true }));
}
export async function createAwesomeAction(_event, target) {
  const candidates = [...new Map([...(game.actors?.contents ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
    .filter(actor => actor?.type === "npc" && actor.isOwner && actor.system.health.value > 0).map(actor => [actor.uuid, actor])).values()];
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("create") }, position: { width: 560 },
    content: `<p data-awesome-create>${text("barrierHint")}</p><label>${text("shape")}<select name="shape">${["wall", "cube", "sphere", "path"].map(key => `<option value="${key}">${text(key)}</option>`).join("")}</select></label>
      <label>${text("location")}<input name="location" required/></label><label><input name="inRange" type="checkbox"/>${text("inRange")}</label>
      <fieldset><legend>${text("initialTargets")}</legend>${candidates.map((actor, index) => `<label><input name="target${index}" type="checkbox" value="${escape(actor.uuid)}"/>${escape(actor.name)}</label>`).join("")}</fieldset>`,
    ok: { callback: (_event, button) => ({ confirmed: true, inRange: button.form.inRange.checked, shape: button.form.shape.value,
      location: button.form.location.value, targets: candidates.filter((_actor, index) => button.form.elements[`target${index}`].checked).map(actor => actor.uuid) }) } });
  if (input) warn(await createAwesomeBarrier(this.actor, target.dataset.itemId, input));
}
export async function resumeAwesomeAction(_event, target) { warn(await resumeAwesomeBarrier(this.actor, target.dataset.fieldId)); }
export async function endAwesomeAction(_event, target) {
  if (await confirm("end")) warn(await endAwesomeBarrier(this.actor, target.dataset.fieldId));
}
export async function openAwesomeAction(_event, target) {
  const object = await resolveDocumentReference(target.dataset.objectUuid, "object");
  if (object) await object.sheet.render({ force: true });
}
export async function captureAwesomeAction(_event, target) {
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("capture") },
    content: `<p data-awesome-capture>${text("captureHint")}</p><label>${text("effort")}<input name="effort" type="number" min="0" step="1" value="0"/></label>
      <label>${text("assets")}<input name="assets" type="number" min="0" max="2" step="1" value="0"/></label>`,
    ok: { callback: (_event, button) => ({ confirmed: true, effortLevels: Number(button.form.effort.value), assetSteps: Number(button.form.assets.value) }) } });
  if (input) warn(await containWithAwesomeBarrier(this.actor, target.dataset.fieldId, target.dataset.targetId, input));
}
export async function reconcileAwesomeAction(_event, target) {
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("reconcile") },
    content: `<p>${text("reconcileHint")}</p><label>${text("observed")}<select name="success"><option value="false">${text("miss")}</option><option value="true">${text("hit")}</option></select></label>
      <label>${text("note")}<input name="note" required/></label>`,
    ok: { callback: (_event, button) => ({ confirmed: true, success: button.form.success.value === "true", note: button.form.note.value }) } });
  if (input) warn(await reconcileAwesomeCapture(this.actor, target.dataset.fieldId, target.dataset.targetId, input));
}
export async function releaseAwesomeAction(_event, target) {
  if (await confirm("release")) warn(await releaseAwesomeContainment(this.actor, target.dataset.containmentId, { confirmed: true }));
}

/** The GM declares whether this action crosses a field; no collision/adjacency is guessed. */
export function awesomeCrossingField() {
  const barriers = (game.actors?.contents ?? []).filter(awesomeBarrierObstructs);
  return barriers.length ? `<label>${text("crossing")}<select name="awesomeCrossing"><option value="">${text("noCrossing")}</option>${barriers.map(object => `<option value="${escape(object.uuid)}">${escape(object.name)}</option>`).join("")}</select></label><p class="hint">${text("crossingHint")}</p>` : "";
}
