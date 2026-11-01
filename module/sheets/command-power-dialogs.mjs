/** Collect explicit fiction and target choices; command services validate and persist the actual rules. */
import { sootheBeast, lightFire, bindTeamUp, inviteTeamUp, maintainCalm, endCalm, resumeCalm,
  finishLighting, finishTeamUpBinding, configureTeamUp, teamUpOrigins } from "../applications/command-power-service.mjs";
import { commandSource } from "../applications/command-power-read.mjs";
const text = key => game.i18n.localize(`CYPHER.Command.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const check = name => `<label><input type="checkbox" name="${name}"/>${text(name)}</label>`;
const select = (name, choices) => `<label>${text(name)}<select name="${name}">${choices.map(([id, name]) => `<option value="${escape(id)}">${escape(name)}</option>`).join("")}</select></label>`;
const input = name => `<label>${text(name)}<input name="${name}" required/></label>`;
const prompt = content => foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("title") }, position: { width: 560 }, content,
  ok: { callback: (_event, button) => Object.fromEntries(Array.from(button.form.elements).filter(field => field.name)
    .map(field => [field.name, field.type === "checkbox" ? field.checked : field.value])) } });
const warn = result => { if (!result) ui.notifications.warn(text("unavailable")); };
const targets = () => [...new Map([...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
  .filter(actor => ["pc", "npc"].includes(actor?.type) && actor.isOwner).map(actor => [actor.uuid, actor])).values()];
const modifiers = actor => `<label>${text("effort")}<input name="effortLevels" type="number" min="0" step="1" value="0"/></label>`
  + `<label>${text("assets")}<input name="assetSteps" type="number" min="0" step="1" value="0" max="2"/></label>`
  + select("skill", [["", text("none")], ...actor.items.filter(item => item.type === "skill").map(item => [item.id, item.name])]);
const taskOptions = fields => ({ effortLevels: Number(fields.effortLevels), assetSteps: Number(fields.assetSteps), skillItemId: fields.skill || null });

/** Source selection is an owned Item; cancellation never invokes a service or spends anything. */
export async function promptCommandPower(_event, target) {
  if (!game.user.isGM) return;
  const item = this.actor.items.get(target.dataset.itemId);
  if (!item) return;
  const key = item.system.key, npcs = targets().filter(actor => actor.type === "npc");
  if (key === "soothe-the-savage") {
    const fields = await prompt(`<p>${text("sootheHint")}</p>` + select("target", npcs.map(actor => [actor.uuid, actor.name]))
      + check("beast") + check("inRange") + check("seesYou") + check("speaking") + modifiers(this.actor));
    if (fields) warn(await sootheBeast(this.actor, item.id, { ...fields, confirmed: true, npcUuid: fields.target, ...taskOptions(fields) }));
  } else if (key === "lighting-a-fire-under-them") {
    const fields = await prompt(`<p>${text("lightingHint")}</p>` + select("target", targets().map(actor => [actor.uuid, actor.name])) + check("ally") + check("inRange"));
    if (fields) warn(await lightFire(this.actor, item.id, { ...fields, confirmed: true, targetUuid: fields.target }));
  } else if (commandSource(this.actor, item.id, "team-up-ally")) {
    const pack = game.packs.get(`cypher.abilities-${game.i18n.lang === "fr" ? "fr" : "en"}`);
    const index = await pack.getIndex({ fields: ["flags.cypherFoundry.crd"] });
    const ids = teamUpOrigins(), origins = index.map(entry => ({ id: entry.flags?.cypherFoundry?.crd?.sourceLogicalId ?? entry.flags?.cypherFoundry?.crd?.logicalId, name: entry.name })).filter(entry => ids.includes(entry.id));
    const fields = await prompt(`<p>${text("teamUpHint")}</p>` + select("target", npcs.map(actor => [actor.uuid, actor.name]))
      + select("origin", origins.map(entry => [entry.id, entry.name])) + `<label>${text("adaptation")}<textarea name="adaptation" required></textarea></label>`
      + `<label>${text("tasks")}<textarea name="tasks"></textarea></label>`);
    if (fields) warn(await bindTeamUp(this.actor, item.id, { confirmed: true, npcUuid: fields.target, originId: fields.origin, adaptation: fields.adaptation,
      taskLevels: fields.tasks.split("\n").filter(line => line.trim()).map(line => {
        const at = line.lastIndexOf("="); return { id: foundry.utils.randomID(), label: line.slice(0, at).trim(), level: at < 0 ? NaN : Number(line.slice(at + 1)) };
      }) }));
  }
}

/** Visible controls resume only checkpointed work or declare a new outing/maintenance action. */
export async function promptCommandAction(_event, target) {
  const id = target.dataset.commandId;
  switch (target.dataset.command) {
    case "resumeCalm": warn(await resumeCalm(this.actor, id)); break;
    case "endCalm": warn(await endCalm(this.actor, id)); break;
    case "resumeLighting": warn(await finishLighting(this.actor)); break;
    case "resumeAlly": warn(await finishTeamUpBinding(this.actor, id)); break;
    case "endOuting": warn(await configureTeamUp(this.actor, id, { endOuting: true })); break;
    case "maintain": {
      const fields = await prompt(`<p>${text("maintainHint")}</p>` + check("inRange") + check("seesYou") + check("speaking"));
      if (fields) warn(await maintainCalm(this.actor, id, { ...fields, confirmed: true })); break;
    }
    case "mode": {
      const fields = await prompt(select("mode", ["attack", "defense", "independent"].map(mode => [mode, game.i18n.localize(`CYPHER.Follower.${mode}`)])));
      if (fields) warn(await configureTeamUp(this.actor, id, { mode: fields.mode })); break;
    }
    case "invite": {
      const fields = await prompt(`<p>${text("outingHint")}</p>` + input("outing") + check("available") + modifiers(this.actor));
      if (fields) warn(await inviteTeamUp(this.actor, id, { confirmed: true, available: fields.available, label: fields.outing, ...taskOptions(fields) })); break;
    }
  }
}
