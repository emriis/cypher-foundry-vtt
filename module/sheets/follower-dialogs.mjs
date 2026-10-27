/** Follower dialogs declare source, task levels and availability without inferring creatures or adjacency. */
import { registerFollower, configureFollower, replaceFollower, synchronizeFollower, reconcileFollower } from "../applications/follower-service.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";
const label = key => game.i18n.localize(`CYPHER.Follower.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const select = (name, key, choices, selected = null) => `<label>${label(key)}<select name="${name}">${choices.map(([id, text]) => `<option value="${escape(id)}" ${id === selected ? "selected" : ""}>${escape(text)}</option>`).join("")}</select></label>`;
const prompt = (key, content, read) => foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label(key) }, content,
  ok: { callback: (_event, button) => read(button.form.elements) } });
const candidates = () => [...new Map([...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
  .filter(actor => actor?.type === "npc" && actor.isOwner).map(actor => [actor.uuid, actor])).values()];
const warn = result => { if (!result) ui.notifications.warn(label("unavailable")); };

/** Actual NPCs come from the world or selected synthetic tokens; the GM explicitly confirms their grant. */
export async function promptFollower() {
  if (!game.user.isGM) return;
  const npcs = candidates(); if (!npcs.length) { warn(false); return; }
  const input = await prompt("register", `<p>${label("registerHint")}</p>` + select("npc", "npc", npcs.map(npc => [npc.uuid, npc.name]))
    + `<label>${label("source")}<input name="source" required/></label><label>${label("acquiredTier")}<input name="tier" type="number" min="1" max="${this.actor.system.tier}" value="${this.actor.system.tier}" required/></label>
    <label>${label("healthPerLevel")}<input name="health" type="number" min="0" step="1" value="3" required/></label><p>${label("healthHint")}</p>
    <label>${label("tasks")}<textarea name="tasks" placeholder="${escape(label("taskExample"))}"></textarea></label>`,
  fields => ({ npcUuid: fields.npc.value, source: fields.source.value.trim(), acquiredTier: Number(fields.tier.value), healthPerLevel: Number(fields.health.value),
    taskLevels: fields.tasks.value.split("\n").filter(line => line.trim()).map(line => {
      const separator = line.lastIndexOf("="); return { id: foundry.utils.randomID(), label: line.slice(0, separator).trim(), level: separator < 0 ? NaN : Number(line.slice(separator + 1)) };
    }) }));
  if (!input) return;
  warn(await registerFollower(this.actor, npcs.find(npc => npc.uuid === input.npcUuid), { ...input, confirmed: true }));
}

/** One source slot retains history across lost followers, replacements and explicit corrections. */
export async function promptFollowerAction(_event, target) {
  const id = target.dataset.followerId, record = this.actor.flags?.cypher?.followers?.[id];
  if (!record) return;
  switch (target.dataset.action) {
    case "openFollower": { const npc = await resolveDocumentReference(record.npcUuid, "npc"); if (npc?.isOwner) await npc.sheet.render({ force: true }); break; }
    case "syncFollower": warn(await synchronizeFollower(this.actor, id)); break;
    case "configureFollower": {
      const input = await prompt("configure", select("mode", "mode", ["attack", "defense", "independent"].map(key => [key, label(key)]), record.mode)
        + `<label><input name="available" type="checkbox" ${record.available ? "checked" : ""}/>${label("available")}</label>`
        + (game.user.isGM ? `<label>${label("extraLevels")}<input name="extra" type="number" min="${record.extraLevels}" step="1" value="${record.extraLevels}" required/></label>` : ""),
      fields => ({ mode: fields.mode.value, available: fields.available.checked, ...(fields.extra ? { extraLevels: Number(fields.extra.value) } : {}) }));
      if (input) warn(await configureFollower(this.actor, id, input)); break;
    }
    case "replaceFollower": {
      if (!game.user.isGM) return;
      const npcs = candidates().filter(npc => !npc.flags?.cypher?.followerProgress);
      if (!npcs.length) { warn(false); return; }
      const uuid = await prompt("replace", `<p>${label("replaceHint")}</p>` + select("npc", "npc", npcs.map(npc => [npc.uuid, npc.name])), fields => fields.npc.value);
      if (uuid) warn(await replaceFollower(this.actor, id, npcs.find(npc => npc.uuid === uuid), { confirmed: true })); break;
    }
    case "reconcileFollower": {
      if (!game.user.isGM) return;
      const note = await prompt("reconcile", `<p>${label("reconcileHint")}</p><label>${label("note")}<input name="note" required/></label>`, fields => fields.note.value.trim());
      if (note) warn(await reconcileFollower(this.actor, id, { confirmed: true, note })); break;
    }
  }
}

/** NPC Health, conditions and receipts affect the owner's dashboard even when the PC document did not change. */
export async function refreshFollowerOwnerSheet(npc) {
  const ownerUuid = npc.type === "npc" && npc.flags?.cypher?.followerProgress?.ownerUuid;
  if (!ownerUuid) return;
  const owner = await resolveDocumentReference(ownerUuid, "pc");
  if (owner?.sheet?.rendered) await owner.sheet.render();
}
