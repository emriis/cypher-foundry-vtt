/** GM-adjudicated beast calming, one-use initiative commands and fixed-level superhero allies. */
import { commandSource, commandRecords, teamUpRecords, commandClock } from "./command-power-read.mjs";
import { calmActive } from "../rules/command-powers.mjs";
import { GENRE_ABILITIES } from "../rules/genre-ability-catalogue.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { rollTask } from "./task-service.mjs";
import { applyCommandEffect } from "./command-effect-service.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { promotePendingCommand } from "./command-round-service.mjs";
const allowed = actor => actor?.type === "pc" && actor.isOwner !== false && game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const ready = actor => actor?.isOwner !== false && !resolveGeneralModifiers(getGeneralEffects(actor)).rejected
  && !["dead", "unconscious", "stunned", "paralyzed"].some(status => actor?.statuses?.has(status));
export const teamUpOrigins = () => GENRE_ABILITIES.filter(entry => entry.tier === 1 && entry.genres.includes("superhero") && entry.id !== "ability.team-up-ally").map(entry => entry.id);

/** Cost, range, sight, speech and beast classification are validated before entering the common attack pipeline. */
export async function sootheBeast(actor, itemId, { npcUuid, confirmed = false, beast = false, inRange = false,
  seesYou = false, speaking = false, effortLevels = 0, assetSteps = 0, skillItemId = null } = {}) {
  if (!allowed(actor) || !confirmed || !beast || !inRange || !seesYou || !speaking) return null;
  return runActorActions([actor], "soothe", async context => {
    const item = commandSource(actor, itemId, "soothe-the-savage"), npc = await resolveDocumentReference(npcUuid, "npc");
    if (!item || !npc || !ready(actor) || npc.isOwner === false || !(npc.system.health?.value > 0)) return null;
    const id = foundry.utils.randomID(), record = { version: 1, id, itemId, npcUuid: npc.uuid, mode: "rest", state: "awaiting",
      revision: actor.flags?.cypher?.commandRecoveryRevision ?? 0 };
    return rollTask(actor, { [ACTION_CONTEXT]: context, stat: "intellect", difficulty: npc.system.level, isAttack: true,
      targetActor: npc, baseDamage: 0, activationCost: 2, effortLevels, assetSteps, skillItemId, abilitySource: { itemId }, actionTiming: "action",
      ruleEffect: { targetUuid: npc.uuid, effect: { kind: "calmed", id, sourceUuid: actor.uuid, itemId, record } } });
  });
}

/** Continue through the next source-turn boundary without repaying activation; missed turns require a new attack. */
export async function maintainCalm(actor, id, { confirmed = false, speaking = false, inRange = false, seesYou = false } = {}) {
  if (!allowed(actor) || !confirmed || !speaking || !inRange || !seesYou || !ready(actor)) return false;
  return Boolean(await runActorActions([actor], "maintainCalm", async context => {
    const record = commandRecords(actor).find(record => record.id === id), clock = commandClock();
    const current = record?.until && clock.revisions[record.until.combatantId];
    const consecutive = record?.mode === "maintain" && record.until?.combatId === clock.id && current === record.until.revision;
    if (!record || !calmActive(record, actor.flags?.cypher?.commandRecoveryRevision ?? 0, clock) && !consecutive) return false;
    const npc = await resolveDocumentReference(record.npcUuid, "npc");
    if (!npc || npc.isOwner === false || !(npc.system.health?.value > 0) || !commandSource(actor, record.itemId, "soothe-the-savage")) return false;
    const round = roundActionContext(actor, { actionTiming: "action" });
    if (round && !round.kind) return false;
    const combat = game.combat, member = combat?.started && combat.combatants?.contents?.find(member => member.actor === actor);
    // Narrative maintenance is explicitly ended by the GM; no seconds-per-round conversion is invented.
    const until = member ? { combatId: combat.id, combatantId: member.id, revision: (clock.revisions[member.id] ?? 0) + 1 } : null;
    if (!await consumeRoundAction(round, context)) return false;
    await actor.update({ [`flags.cypher.commandCalms.${id}.mode`]: "maintain", [`flags.cypher.commandCalms.${id}.until`]: until });
    return true;
  }));
}

/** Resume only a successful partially applied calm, never an awaiting failed attack. */
export async function resumeCalm(actor, id) {
  const record = commandRecords(actor).find(record => record.id === id);
  if (!allowed(actor) || record?.state !== "pending") return false;
  return applyCommandEffect(await resolveDocumentReference(record.npcUuid, "npc"), { kind: "calmed", sourceUuid: actor.uuid, id });
}
export async function endCalm(actor, id) {
  if (!allowed(actor) || !commandRecords(actor).some(record => record.id === id)) return false;
  return Boolean(await runActorActions([actor], "endCalm", async () => { await actor.update({ [`flags.cypher.commandCalms.${id}.state`]: "ended" }); return true; }));
}

/** A pending free command is checkpointed before target writes; resumption never consumes a second action/use. */
export async function lightFire(actor, itemId, { targetUuid, confirmed = false, ally = false, inRange = false } = {}) {
  if (!allowed(actor) || !confirmed || !ally || !inRange || !ready(actor)) return false;
  return Boolean(await runActorActions([actor], "lighting", async context => {
    const target = await resolveDocumentReference(targetUuid), flags = actor.flags?.cypher ?? {};
    if (!commandSource(actor, itemId, "lighting-a-fire-under-them") || !["pc", "npc"].includes(target?.type) || target.isOwner === false
      || flags.lightingUse?.state === "pending" || flags.lightingUse?.revision === (flags.commandRecoveryRevision ?? 0)
      || target.flags?.cypher?.commandBoost?.state === "active") return false;
    return Boolean(await runActorActions([actor, target], "lightingCommit", async () => {
      const id = foundry.utils.randomID(), round = roundActionContext(actor, { actionTiming: "lastAction" });
      if (round && !round.kind || !await consumeRoundAction(round, context)) return false;
      await actor.update({ "flags.cypher.lightingUse": { version: 1, id, itemId, targetUuid: target.uuid, state: "pending", revision: flags.commandRecoveryRevision ?? 0 } });
      return finishLighting(actor, context);
    }, context));
  }));
}

/** Existing target receipt proves a lost response was already applied; a later distinct command is never overwritten. */
export async function finishLighting(actor, context = null) {
  if (!allowed(actor)) return false;
  const use = actor.flags?.cypher?.lightingUse, target = use && await resolveDocumentReference(use.targetUuid);
  if (use?.state !== "pending" || !target || target.isOwner === false) return false;
  return Boolean(await runActorActions([actor, target], "lightingResume", async () => {
    // Resolution awaited before acquiring these guards. A second resume may
    // now refer to an older completed use, or even to a later renewed command.
    if (actor.flags?.cypher?.lightingUse?.id !== use.id || actor.flags.cypher.lightingUse.state !== "pending") return false;
    const boost = target.flags?.cypher?.commandBoost;
    if (boost && boost.id !== use.id && boost.state === "active") return false;
    if (boost?.id !== use.id) await target.update({ "flags.cypher.commandBoost": { version: 1, id: use.id, state: "active", sourceUuid: actor.uuid } });
    if (!await promotePendingCommand(target, context)) return false;
    await actor.update({ "flags.cypher.lightingUse.state": "complete" }); return true;
  }, context));
}

/** Bind an actual level-four NPC and a GM-authored adaptation of one allowed Origin power, once per acquired Item. */
export async function bindTeamUp(actor, itemId, { npcUuid, originId, adaptation = "", taskLevels = [], confirmed = false } = {}) {
  if (!allowed(actor) || !confirmed || !teamUpOrigins().includes(originId) || typeof adaptation !== "string" || !adaptation.trim()
    || !Array.isArray(taskLevels) || taskLevels.some(task => !/^[A-Za-z0-9]+$/.test(task.id ?? "") || typeof task.label !== "string" || !task.label.trim()
      || !Number.isSafeInteger(task.level) || task.level < 0) || new Set(taskLevels.map(task => task.id)).size !== taskLevels.length) return false;
  return Boolean(await runActorActions([actor], "teamUpBind", async context => {
    const item = commandSource(actor, itemId, "team-up-ally"), npc = await resolveDocumentReference(npcUuid, "npc");
    if (!item || !npc || npc.system.level !== 4 || npc.isOwner === false || !(npc.system.health?.max > 0) || !(npc.system.health?.value > 0)
      || npc.flags?.cypher?.followerProgress || npc.flags?.cypher?.temporaryFollower || npc.flags?.cypher?.teamUpAlly
      || teamUpRecords(actor).length) return false;
    return Boolean(await runActorActions([actor, npc], "teamUpBindCommit", async () => {
      const id = foundry.utils.randomID();
      await actor.update({ [`flags.cypher.teamUpAllies.${id}`]: { version: 1, id, itemId, npcUuid, originId, adaptation: adaptation.trim(),
        taskLevels: structuredClone(taskLevels), state: "pending", mode: "attack", outing: null } });
      return finishTeamUpBinding(actor, id, context);
    }, context));
  }));
}

/** Finish a lost binding response without duplicating the ally or importing PC mechanics onto its NPC. */
export async function finishTeamUpBinding(actor, id, context = null) {
  if (!allowed(actor)) return false;
  const record = teamUpRecords(actor).find(record => record.id === id), npc = record && await resolveDocumentReference(record.npcUuid, "npc");
  if (record?.state !== "pending" || !npc || npc.isOwner === false || npc.system.level !== 4) return false;
  return Boolean(await runActorActions([actor, npc], "teamUpBindResume", async () => {
    const link = npc.flags?.cypher?.teamUpAlly;
    if (link && (link.id !== id || link.ownerUuid !== actor.uuid) || npc.flags?.cypher?.followerProgress || npc.flags?.cypher?.temporaryFollower) return false;
    if (!link) await npc.update({ "flags.cypher.teamUpAlly": { version: 1, id, ownerUuid: actor.uuid, originId: record.originId, adaptation: record.adaptation } });
    await actor.update({ [`flags.cypher.teamUpAllies.${id}.state`]: "active" }); return true;
  }, context));
}

/** Each outing has a fresh GM availability declaration and difficulty-two charm task, including paid rerolls. */
export async function inviteTeamUp(actor, id, { confirmed = false, available = false, label = "", effortLevels = 0, assetSteps = 0, skillItemId = null } = {}) {
  if (!allowed(actor) || !confirmed || !available || typeof label !== "string" || !label.trim()) return null;
  return runActorActions([actor], "teamUpInvite", async context => {
    const ally = teamUpRecords(actor).find(record => record.id === id), npc = ally && await resolveDocumentReference(ally.npcUuid, "npc");
    if (ally?.state !== "active" || ally.outing?.state === "active" || !npc || npc.system.level !== 4 || npc.isOwner === false
      || !(npc.system.health?.value > 0) || npc.flags?.cypher?.teamUpAlly?.injured || !commandSource(actor, ally.itemId, "team-up-ally")) return null;
    const outingId = foundry.utils.randomID(), record = { id: outingId, state: "awaiting", label: label.trim() };
    return rollTask(actor, { [ACTION_CONTEXT]: context, stat: "intellect", difficulty: 2, targetActor: npc, effortLevels, assetSteps, skillItemId,
      abilitySource: { itemId: ally.itemId }, actionTiming: "action", followerChoices: [],
      ruleEffect: { targetUuid: npc.uuid, effect: { kind: "teamUp", id: outingId, sourceUuid: actor.uuid, itemId: ally.itemId, allyId: id, record } } });
  });
}

/** Ending an outing invalidates the old charm card; ordinary owner configuration cannot bypass the roll. */
export async function configureTeamUp(actor, id, { mode = null, endOuting = false } = {}) {
  if (!allowed(actor) || mode !== null && !["attack", "defense", "independent"].includes(mode)) return false;
  return Boolean(await runActorActions([actor], "teamUpConfigure", async () => {
    if (!teamUpRecords(actor).some(record => record.id === id)) return false;
    await actor.update({ ...(mode ? { [`flags.cypher.teamUpAllies.${id}.mode`]: mode } : {}),
      ...(endOuting ? { [`flags.cypher.teamUpAllies.${id}.outing.state`]: "ended" } : {}) }); return true;
  }));
}
