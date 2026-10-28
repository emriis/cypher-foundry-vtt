/** Collect a complete permanent follower grant before calling the write boundary. */
import { applyFollowerAbility, followerAbilityChoices, followerAbilityDetails, synchronizeFollowerAbility } from "../applications/follower-ability-service.mjs";
const label = key => game.i18n.localize(`CYPHER.FollowerAbility.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const select = (name, title, choices) => `<label>${escape(title)}<select name="${name}">${choices.map(([id, text]) => `<option value="${escape(id)}">${escape(text)}</option>`).join("")}</select></label>`;
const prompt = (content, read) => foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("apply") }, content,
  ok: { callback: (_event, button) => read(button.form.elements) } });
const number = (name, title, value, min = 0, max = null) => `<label>${escape(title)}<input name="${name}" type="number" step="1" min="${min}" ${max === null ? "" : `max="${max}"`} value="${value}" required/></label>`;
const warning = () => ui.notifications.warn(label("unavailable"));

/** No writes while choosing or cancelling. Creature details remain an explicit GM declaration. */
export async function promptFollowerAbility() {
  if (!game.user.isGM) return;
  const choices = followerAbilityChoices(this.actor).filter(choice => !choice.used);
  if (!choices.length) { warning(); return; }
  const selection = await prompt(select("ability", label("ability"), choices.map(choice => [choice.id, choice.name]))
    + `<label><input type="checkbox" name="existing"/>${label("existing")}</label>`, fields => ({ itemId: fields.ability.value, existing: fields.existing.checked }));
  if (!selection) return;
  const { itemId, existing } = selection;
  const choice = choices.find(choice => choice.id === itemId);
  const variant = choice.alternative ? await prompt(select("variant", label("alternative"), [["new", label("new")], ["upgrade", label("upgrade")]]), fields => fields.variant.value) : "new";
  if (!variant) return;
  const details = await followerAbilityDetails(this.actor, itemId, variant);
  if (!details) { warning(); return; }
  const { plan, followers, eligible } = details;
  const npcs = [...new Map([...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)]
    .filter(npc => npc?.type === "npc" && npc.isOwner && !npc.flags?.cypher?.followerProgress).map(npc => [npc.uuid, npc])).values()];
  let content = `<p>${label("hint")}</p>` + number("tier", label("tier"), this.actor.system.tier, 1, this.actor.system.tier);
  const grants = plan.grants.flatMap(grant => Array.from({ length: grant.count }, () => grant));
  const legacy = followers.filter(follower => !follower.sourceAbility && !follower.pending);
  if (existing && plan.upgrade || grants.some(grant => existing ? !legacy.some(follower => follower.baseLevel === grant.level) : !npcs.some(npc => npc.system.level === grant.level))) { warning(); return; }
  for (const [index, grant] of grants.entries()) {
    if (existing) {
      content += select(`slot${index}`, `${label("newFollower")} ${index + 1}`, legacy.filter(follower => follower.baseLevel === grant.level).map(follower => [follower.id, follower.name]));
      continue;
    }
    content += `<fieldset><legend>${label("newFollower")} ${index + 1} · ${label("level")} ${grant.level}</legend>`
      + select(`npc${index}`, label("npc"), npcs.filter(npc => npc.system.level === grant.level).map(npc => [npc.uuid, npc.name]))
      + number(`health${index}`, label("health"), 3);
    if (grant.tasks !== undefined) {
      content += `<p>${game.i18n.format("CYPHER.FollowerAbility.taskProfile", { count: grant.tasks, level: grant.taskLevel })}</p>`;
      for (let task = 0; task < grant.tasks; task++) content += `<label>${grant.charm && task === 0 ? label("charm") : `${label("task")} ${task + 1}`}<input name="task${index}x${task}" required ${grant.charm && task === 0 ? `value="${escape(label("charm"))}"` : ""}/></label>`;
    } else content += `<label>${label("tasks")}<textarea name="tasks${index}"></textarea></label>`;
    content += "</fieldset>";
  }
  if (plan.upgrade) {
    if (eligible.length < plan.upgrade.count) { warning(); return; }
    for (let index = 0; index < plan.upgrade.count; index++) {
      content += select(`upgrade${index}`, `${label("upgradeFollower")} ${index + 1}`, eligible.map(follower => [follower.id, `${follower.name} (${follower.level})`]));
      if (plan.upgrade.newTask) content += `<p>${label("newTaskHint")}</p><label>${label("newTask")}<input name="newTask${index}" required/></label>`;
    }
  }
  const input = await prompt(content, fields => ({ confirmed: true, acquiredTier: Number(fields.tier.value), variant,
    followers: grants.map((grant, index) => existing ? { slotId: fields[`slot${index}`].value } : ({ npcUuid: fields[`npc${index}`].value, healthPerLevel: Number(fields[`health${index}`].value),
      taskLevels: grant.tasks !== undefined ? Array.from({ length: grant.tasks }, (_unused, task) => ({ id: grant.charm && task === 0 ? "charm" : foundry.utils.randomID(),
        label: fields[`task${index}x${task}`].value.trim(), level: grant.taskLevel })) : fields[`tasks${index}`].value.split("\n").filter(line => line.trim()).map(line => {
        const separator = line.lastIndexOf("="); return { id: foundry.utils.randomID(), label: line.slice(0, separator).trim(), level: separator < 0 ? NaN : Number(line.slice(separator + 1)) };
      }) })),
    upgrades: Array.from({ length: plan.upgrade?.count ?? 0 }, (_unused, index) => ({ id: fields[`upgrade${index}`].value,
      ...(plan.upgrade.newTask ? { newTask: { id: foundry.utils.randomID(), label: fields[`newTask${index}`].value.trim() } } : {}) })) }));
  if (input && !await applyFollowerAbility(this.actor, itemId, input)) warning();
}

/** Pending receipts remain visible even if the acquired Ability was removed meanwhile. */
export async function resumeFollowerAbility(_event, target) {
  if (!await synchronizeFollowerAbility(this.actor, target.dataset.useId)) warning();
}
