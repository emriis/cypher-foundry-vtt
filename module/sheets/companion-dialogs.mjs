/** Explicit companion circumstances, completed attention and resumable support actions. */
import { configureCompanion, ownsCompanionAbility } from "../applications/companion-power-service.mjs";
import { startAutomatonRepair, finishAutomatonRepair, finishRetainerInterception } from "../applications/companion-support-service.mjs";
import { followerDisplay } from "../applications/follower-service.mjs";
const text = key => game.i18n.localize(`CYPHER.Companion.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const warn = result => { if (!result) ui.notifications.warn(text("unavailable")); };
const check = (name, key, value = false) => `<label><input name="${name}" type="checkbox" ${value ? "checked" : ""}/>${text(key)}</label>`;

/** The player declares geometry and living status; the service checks actual source-qualified actors. */
export async function promptCompanionContext() {
  const previous = this.actor.flags?.cypher?.companionContext;
  const choices = [["", text("none")]];
  for (const follower of await followerDisplay(this.actor)) if (["beast", "mount"].includes(follower.sourceAbility?.family)) choices.push([`follower:${follower.id}`, follower.name]);
  if (ownsCompanionAbility(this.actor, "soothe-the-savage")) {
    const npcs = [...new Map([...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
      .filter(npc => npc?.type === "npc").map(npc => [npc.uuid, npc])).values()];
    for (const npc of npcs) choices.push([`calmed:${npc.uuid}`, `${text("calmed")} — ${npc.name}`]);
  }
  const selected = previous ? previous.calmed ? `calmed:${previous.npcUuid}` : `follower:${previous.followerId}` : "";
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("circumstances") },
    content: `<p>${text("circumstancesHint")}</p><label>${text("companion")}<select name="companion">${choices.map(([id, label]) => `<option value="${escape(id)}" ${id === selected ? "selected" : ""}>${escape(label)}</option>`).join("")}</select></label>`
      + check("immediate", "immediate", previous?.immediate) + check("alive", "alive", previous?.alive ?? true)
      + check("riding", "riding", previous?.riding) + check("friendly", "friendly", previous?.friendly ?? true),
    ok: { callback: (_event, button) => {
      const fields = button.form.elements, value = fields.companion.value;
      return { confirmed: true, ...(value.startsWith("follower:") ? { followerId: value.slice(9) } : value.startsWith("calmed:") ? { calmedNpcUuid: value.slice(7) } : {}),
        immediate: fields.immediate.checked, alive: fields.alive.checked, riding: fields.riding.checked, friendly: fields.friendly.checked };
    } } });
  if (input) warn(await configureCompanion(this.actor, input));
}

/** Attention starts and finishes separately; advancing game time alone does not complete work. */
export async function promptCompanionRepair(_event, target) {
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("repair") },
    content: `<p>${text("repairHint")}</p><label>${text("minutes")}<input name="minutes" type="number" min="1" step="1" value="3" required/></label>`,
    ok: { callback: (_event, button) => ({ confirmed: true, durationSeconds: Number(button.form.elements.minutes.value) * 60 }) } });
  if (input) warn(await startAutomatonRepair(this.actor, target.dataset.followerId, input));
}

export async function finishCompanionRepair(_event, target) {
  const confirmed = await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: text("finishRepair") }, content: `<p>${text("workConfirmed")}</p>` });
  if (confirmed) warn(await finishAutomatonRepair(this.actor, target.dataset.repairId, { workConfirmed: true }));
}
export async function cancelCompanionRepair(_event, target) { warn(await finishAutomatonRepair(this.actor, target.dataset.repairId, { cancel: true })); }
export async function resumeRetainerInterception(_event, target) { warn(await finishRetainerInterception(this.actor, target.dataset.interceptionId)); }
