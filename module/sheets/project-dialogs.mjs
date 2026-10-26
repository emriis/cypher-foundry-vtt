/** Downtime dialogs collect explicit fiction, skill, time and contribution declarations; services own writes. */
import { createProject, approveProject, cancelProject, completeProject, resumeProject, reconcileProject,
  adjustResourcePoints, setBefriendPenalty, projectReview, projectVariantChoices } from "../applications/project-service.mjs";
const label = key => game.i18n.localize(`CYPHER.Project.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const kinds = ["craftObject", "repairObject", "craftCypher", "craftArtifact", "contact", "investment", "research", "restoreFollower", "befriend", "rest", "carouse", "custom"];
const warn = () => ui.notifications.warn(label("invalid"));
const confirm = key => foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label("title") }, content: `<p>${label(key)}</p>` });

/** Two steps keep irrelevant activity fields out of the form and preserve actual selected token UUIDs. */
export async function promptProject() {
  const actor = this.actor;
  const kind = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("new") },
    content: `<label>${label("activity")}<select name="kind">${kinds.map(kind => `<option value="${kind}">${label(kind)}</option>`).join("")}</select></label>`,
    ok: { callback: (_event, button) => button.form.kind.value } });
  if (!kinds.includes(kind)) return;
  const crafting = ["craftObject", "repairObject", "craftCypher", "craftArtifact"].includes(kind);
  const candidates = [...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)].filter(Boolean);
  const targets = [...new Map(candidates.map(actor => [actor.uuid, actor])).values()]
    .filter(actor => actor.type === (kind === "repairObject" ? "object" : "npc"));
  const others = (game.actors?.contents ?? []).filter(other => other.type === "pc" && other.uuid !== actor.uuid);
  const sourceTypes = { craftCypher: ["cypher"], craftArtifact: ["artifact"], craftObject: ["equipment", "attack", "armor", "shield"] }[kind] ?? [];
  const sources = [...(game.items?.contents ?? []), ...(actor.items?.contents ?? [])].filter(item => sourceTypes.includes(item.type));
  const select = (name, key, choices, blank = true) => `<label>${label(key)}<select name="${name}">${blank ? '<option value=""></option>' : ""}${choices.map(([value, text]) => `<option value="${escape(value)}">${escape(text)}</option>`).join("")}</select></label>`;
  const check = (name, key) => `<label><input type="checkbox" name="${name}"/>${label(key)}</label>`;
  const number = (name, key, value, min = 0) => `<label>${label(key)}<input name="${name}" type="number" min="${min}" step="1" value="${value}"/></label>`;
  const content = `<p>${label("deferred")}</p>
    <label>${label("name")}<input name="label" required/></label>
    ${number("hours", "hours", kind === "restoreFollower" ? 168 : 24)}
    ${["craftObject", "craftArtifact", "research", "befriend"].includes(kind) ? number("level", "level", 1, 1) : ""}
    ${kind === "contact" ? select("level", "level", [3, 5, 7].map(value => [value, value]), false) : ""}
    ${kind === "craftCypher" ? select("power", "power", ["low", "medium", "advanced"].map(value => [value, label(value)]), false) : ""}
    ${["repairObject", "restoreFollower"].includes(kind) ? select("targetUuid", "target", targets.map(target => [target.uuid, target.name])) : ""}
    ${kind === "restoreFollower" ? `${check("followerConfirmed", "followerConfirmed")}<label>${label("durationSource")}<input name="durationSource"/></label>` : ""}
    ${kind === "investment" ? check("investmentConfirmed", "investmentConfirmed") : ""}
    ${crafting ? `${check("genreConfirmed", "genreConfirmed")}${check("skillAppropriate", "skillAppropriate")}
      ${select("skillItemId", "skill", actor.items.filter(item => item.type === "skill").map(item => [item.id, item.name]))}
      ${select("workerUuid", "worker", candidates.filter(actor => actor.type === "npc").map(actor => [actor.uuid, actor.name]))}
      ${select("workerTraining", "workerTraining", [[1, label("trained")], [2, label("specialized")], [3, label("expert")]], false)}` : ""}
    ${sourceTypes.length ? `<p>${label("sourceHint")}</p>${select("sourceUuid", "source", sources.map(item => [item.uuid, item.name]))}` : ""}
    ${kind === "craftObject" ? `${check("advancedTechnology", "advancedTechnology")}<label>${label("material")}<input name="material"/></label>` : ""}
    ${["custom", "craftObject", "craftArtifact"].includes(kind) ? number("customCost", "customCost", kind === "craftArtifact" ? 5 : "", 1) : ""}
    <label>${label("benefits")}<textarea name="benefits"></textarea></label>
    <details><summary>${label("collaboration")}</summary><p>${label("collaborationHint")}</p>
      ${others.map((other, index) => `<label>${escape(other.name)}<input name="contribution${index}" type="number" min="0" step="1" value="0"/></label>`).join("")}</details>`;
  const proposal = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label(kind) }, content,
    ok: { label: label("propose"), callback: (_event, button) => {
      const form = button.form, value = name => form.elements.namedItem(name)?.value ?? "";
      const result = { kind, label: value("label").trim(), durationSeconds: Number(value("hours")) * 3600,
        benefits: value("benefits"), contributions: others.map((other, index) => ({ actorUuid: other.uuid,
          amount: Number(value(`contribution${index}`)) })).filter(entry => entry.amount !== 0) };
      for (const key of ["power", "targetUuid", "skillItemId", "workerUuid", "sourceUuid", "material", "durationSource"]) if (value(key)) result[key] = value(key);
      for (const key of ["level", "workerTraining", "customCost"]) if (value(key)) result[key] = Number(value(key));
      for (const key of ["genreConfirmed", "skillAppropriate", "followerConfirmed", "advancedTechnology", "investmentConfirmed"]) result[key] = form.elements.namedItem(key)?.checked ?? false;
      return result;
    } } });
  if (!proposal) return;
  if (kind === "craftCypher") {
    const variants = await projectVariantChoices(proposal.sourceUuid, proposal.power);
    if (variants.length === 1) proposal.variantName = variants[0];
    else if (variants.length > 1) {
      proposal.variantName = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("effect") },
        content: select("variantName", "effect", variants.map(name => [name, name]), false),
        ok: { callback: (_event, button) => button.form.variantName.value } });
      if (!proposal.variantName) return;
    }
  }
  if (!await createProject(actor, proposal)) warn();
}

/** Services recheck authorization and persisted state after every dialog. */
export async function promptProjectAction(_event, target) {
  const id = target.dataset.projectId;
  let result;
  switch (target.dataset.action) {
    case "approveProject": {
      const review = await projectReview(this.actor, id);
      if (!review) { warn(); return; }
      const accepted = await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label("approve") },
        content: `<p>${label("approveConfirm")}</p><p>${label("customCost")}: ${review.cost} · ${label("hours")}: ${review.hours}</p>
          <p>${escape(review.target)} ${escape(review.source)} ${escape(review.worker)} ${escape(review.skill)}</p>
          <ul>${review.contributors.map(entry => `<li>${escape(entry.name)}: ${entry.amount}</li>`).join("")}</ul>` });
      if (!accepted) return;
      result = await approveProject(this.actor, id, { confirmed: true, expectedReview: review }); break;
    }
    case "completeProject": if (!await confirm("completeConfirm")) return; result = await completeProject(this.actor, id, { workConfirmed: true }); break;
    case "cancelProject": if (!await confirm("cancelConfirm")) return; result = await cancelProject(this.actor, id); break;
    case "resumeProject": result = await resumeProject(this.actor, id); break;
    case "reconcileProject": {
      const note = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("reconcile") },
        content: `<p>${label("reconcileHint")}</p><label>${label("note")}<input name="note" required/></label>`,
        ok: { callback: (_event, button) => button.form.note.value.trim() } });
      if (!note) return; result = await reconcileProject(this.actor, id, { confirmed: true, note }); break;
    }
    default: return;
  }
  if (!result) warn();
}

/** A distinct request ID makes retrying this particular accepted award idempotent. */
export async function promptResourceAward() {
  const id = foundry.utils.randomID();
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("award") },
    content: `<label>${label("delta")}<input name="delta" type="number" step="1" value="1" required/></label>
      <label>${label("note")}<input name="note" required/></label>`,
    ok: { callback: (_event, button) => ({ delta: Number(button.form.delta.value), note: button.form.note.value.trim() }) } });
  if (input && !await adjustResourcePoints(this.actor, input.delta, { id, note: input.note })) warn();
}

export async function promptBefriendPenalty() {
  if (await confirm("befriendHarmConfirm")) await setBefriendPenalty(this.actor, { confirmed: true });
}

/** Time changes refresh visible project controls without advancing or settling any project. */
export function refreshProjectSheets() {
  const actors = new Set([...(game.actors?.contents ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)]);
  for (const actor of actors) {
    if (!actor?.flags?.cypher?.projects) continue;
    for (const sheet of Object.values(actor.apps ?? {})) {
      if (sheet.rendered) sheet.render().catch(error => console.error("Cypher | Project display refresh failed", error));
    }
  }
}
