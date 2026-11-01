/** Paid, non-damaging Intellect attacks to convert actual machines into temporary companions. */
import { temporaryAbilityPlan } from "./temporary-follower-read.mjs";
import { temporaryFollowerActive } from "../rules/temporary-followers.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { rollTask } from "./task-service.mjs";
import { applyRecompileEffect } from "./temporary-machine-effect.mjs";
const allowed = actor => actor?.type === "pc" && actor.isOwner !== false && game.user?.isGM && game.users?.activeGM?.id === game.user.id;

/** Fiction, actual NPC and reboot duration are declared before the shared cost/dice engine executes. */
export async function recompileTemporaryFollower(actor, itemId, { npcUuid, confirmed = false, machine = false, inRange = false,
  rebootRounds, effectEffort = 0, effortLevels = 0, mode = "attack", ...rollOptions } = {}) {
  if (!allowed(actor) || !confirmed || !machine || !inRange || !Number.isSafeInteger(rebootRounds) || rebootRounds < 1
    || !["attack", "defense", "independent"].includes(mode)) return null;
  return runActorActions([actor], "temporaryMachineRequest", async context => {
    const item = actor.items.get(itemId), plan = temporaryAbilityPlan(item, { levelEffort: [effectEffort] });
    const npc = await resolveDocumentReference(npcUuid, "npc");
    const previousLink = npc?.flags?.cypher?.temporaryFollower;
    const previous = previousLink?.ownerUuid === actor.uuid && actor.flags?.cypher?.temporaryFollowers?.[previousLink.id];
    if (plan?.family !== "machine" || !npc || npc.isOwner === false || !(npc.system.health?.value > 0)
      || npc.system.level > plan.maximumLevel || npc.flags?.cypher?.followerProgress || previousLink && previous?.family !== "machine") return null;
    return runActorActions([actor, npc], "temporaryMachinePlan", async () => {
      const id = foundry.utils.randomID();
      const combat = game.combat;
      const record = { version: 1, id, key: "recompile-machine", family: "machine", sourceItemId: item.id, npcUuid: npc.uuid,
        level: npc.system.level, maximumLevel: plan.maximumLevel, mode, state: "awaiting", rebootRounds, recovery: "tenHours", previousId: previous?.id ?? null,
        combatId: combat?.started ? combat.id : null, readyRound: combat?.started ? combat.round + rebootRounds : null,
        revision: actor.flags?.cypher?.temporaryRecoveries?.tenHours ?? 0 };
      const result = await rollTask(actor, { ...rollOptions, [ACTION_CONTEXT]: context, stat: "intellect", difficulty: npc.system.level,
        targetActor: npc, isAttack: true, baseDamage: 0, effortLevels, effectEffortLevels: effectEffort,
        activationCost: 8, abilitySource: { itemId }, actionTiming: "lastAction",
        ruleEffect: { targetUuid: npc.uuid, effect: { id: foundry.utils.randomID(), kind: "recompiled", sourceUuid: actor.uuid, sourceItemId: itemId, recordId: id, record } } });
      return result;
    }, context);
  });
}

/** Confirm completed reboot rounds; narrative time is declared rather than converted to invented seconds. */
export async function finishTemporaryReboot(actor, id, { confirmed = false, elapsedRounds = 0 } = {}) {
  if (!allowed(actor) || !confirmed) return false;
  return Boolean(await runActorActions([actor], "temporaryReboot", async context => {
    let record = actor.flags?.cypher?.temporaryFollowers?.[id];
    const npc = record && await resolveDocumentReference(record.npcUuid, "npc");
    if (!record || !npc || npc.isOwner === false) return false;
    if (record.state === "pending") {
      if (!await applyRecompileEffect(npc, { sourceUuid: actor.uuid, recordId: id }, context)) return false;
      record = actor.flags.cypher.temporaryFollowers[id];
    }
    if (record.state !== "rebooting" || !temporaryFollowerActive({ ...record, state: "active" }, actor.flags?.cypher)) return false;
    if (record.combatId && game.combat?.id === record.combatId ? game.combat.round < record.readyRound
      : !Number.isSafeInteger(elapsedRounds) || elapsedRounds < record.rebootRounds) return false;
    await actor.update({ [`flags.cypher.temporaryFollowers.${id}.state`]: "active" }); return true;
  }));
}
