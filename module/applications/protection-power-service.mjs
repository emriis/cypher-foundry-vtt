/** Source-backed protection activation with one paid checkpoint and resumable recipient receipts. */
import { protectionPlan, protectionEnergy, protectionRecoveryUpdates } from "../rules/protection-powers.mjs";
import { resolveTaskEffort } from "../rules/task-effort.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { protectionUses } from "./protection-power-read.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { getSuperheroicsRank } from "./task-preparation.mjs";
const authority = () => game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const owned = actor => ["pc", "npc"].includes(actor?.type) && actor.isOwner !== false && typeof actor.uuid === "string";
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);

/** All selected creatures are declared within immediate range; the caster is always included. */
export async function activateProtection(actor, itemId, { confirmed = false, inRange = false, debris = false, targetUuids = [], energy = "", effort = 0 } = {}) {
  if (!authority() || !owned(actor) || actor.type !== "pc" || confirmed !== true || !Array.isArray(targetUuids)) return false;
  return Boolean(await runActorActions([actor], "protectionActivate", async context => {
    const item = actor.items.get(itemId), plan = item?.type === "ability" && item.isOwner !== false && protectionPlan(item.system.key, effort);
    if (!plan || protectionUses(actor).some(use => use.state === "pending") || resolveGeneralModifiers(getGeneralEffects(actor)).rejected
      || ["dead", "unconscious", "stunned", "paralyzed"].some(status => actor.statuses?.has(status))
      || plan.key === "armoring-debris" && debris !== true || plan.key !== "elemental-protection" && targetUuids.some(uuid => uuid !== actor.uuid)) return false;
    const kind = plan.key === "elemental-protection" ? protectionEnergy(energy) : "";
    if (plan.key === "elemental-protection" && (!kind || inRange !== true)) return false;
    const recipients = [actor];
    for (const uuid of new Set(targetUuids.filter(uuid => uuid !== actor.uuid))) {
      const recipient = await resolveDocumentReference(uuid);
      if (!owned(recipient)) return false;
      recipients.push(recipient);
    }
    return Boolean(await runActorActions(recipients, "protectionCommit", async () => {
      if (recipients.some(recipient => !owned(recipient)) || actor.items.get(itemId) !== item) return false;
      const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items(actor), actor.system);
      // This is dedicated effect allocation, not a damaging attack. The shared
      // allocator's attack-effect lane enforces score/ceiling and applies Edge once.
      const allocation = resolveTaskEffort({ activationCost: plan.cost, effectEffortLevels: effort, isAttack: true,
        effortScore: actor.system.effort ?? 1, edge: actor.system.stats.intellect.edge + (modifiers.edge.intellect ?? 0),
        superheroicsRank: getSuperheroicsRank(actor, "intellect") });
      const pool = actor.system.stats.intellect.pool.value;
      if (!allocation || pool < allocation.cost) return false;
      const id = foundry.utils.randomID(), round = roundActionContext(actor, { actionTiming: "action" });
      if (round && !round.kind || !await consumeRoundAction(round, context, { receiptId: id })) return false;
      const use = { version: 1, ...plan, id, itemId, sourceName: item.name, energy: kind, state: "pending", cost: allocation.cost,
        targets: recipients.map(recipient => ({ uuid: recipient.uuid, revision: recipient.flags?.cypher?.protectionRecoveries?.[plan.recovery] ?? 0 })) };
      await actor.update({ "system.stats.intellect.pool.value": pool - allocation.cost, [`flags.cypher.protectionUses.${id}`]: use });
      return settleProtection(actor, use, recipients);
    }, context));
  }));
}

/** Lost recipient acknowledgements resume without payment, extra actions or changed recovery stamps. */
export async function resumeProtection(actor, id) {
  if (!authority() || !owned(actor)) return false;
  return Boolean(await runActorActions([actor], "protectionResume", async context => {
    const use = protectionUses(actor).find(use => use.id === id && use.state === "pending");
    if (!use) return false;
    const recipients = [];
    for (const target of use.targets) recipients.push(target.uuid === actor.uuid ? actor : await resolveDocumentReference(target.uuid));
    if (recipients.some(recipient => !owned(recipient))) return false;
    return Boolean(await runActorActions(recipients, "protectionResumeCommit", () => settleProtection(actor, use, recipients), context));
  }));
}
async function settleProtection(actor, use, recipients) {
  for (const recipient of recipients) {
    const receipt = recipient.flags?.cypher?.protections?.[use.id], target = use.targets.find(target => target.uuid === recipient.uuid);
    if (receipt && (receipt.ownerUuid !== actor.uuid || receipt.revision !== target.revision)) return false;
    if (!receipt) await recipient.update({ [`flags.cypher.protections.${use.id}`]: { version: 1, id: use.id, ownerUuid: actor.uuid, revision: target.revision, state: "active" } });
  }
  await actor.update({ [`flags.cypher.protectionUses.${use.id}.state`]: "complete" }); return true;
}

/** Explicit cancellation ends paid partial grants without refunding or restoring old target state. */
export async function abandonProtection(actor, id) {
  if (!authority() || !owned(actor)) return false;
  return Boolean(await runActorActions([actor], "protectionAbandon", async () => {
    if (!protectionUses(actor).some(use => use.id === id && use.state === "pending")) return false;
    await actor.update({ [`flags.cypher.protectionUses.${id}.state`]: "ended" }); return true;
  }));
}
/** Ending one recipient never ends other recipients, even when the caster ends their own protection. */
export async function endProtection(actor, id) {
  if (!owned(actor)) return false;
  return Boolean(await runActorActions([actor], "protectionEnd", async () => {
    if (!actor.flags?.cypher?.protections?.[id]) return false;
    await actor.update({ [`flags.cypher.protections.${id}.state`]: "ended" }); return true;
  }));
}
/** NPCs have no PC recovery counters; the GM explicitly confirms their completed rest without inventing Health healing. */
export async function recordNpcProtectionRecovery(actor, { confirmed = false, interval = "hour" } = {}) {
  if (!authority() || !owned(actor) || actor.type !== "npc" || confirmed !== true || !["tenMinutes", "hour", "tenHours"].includes(interval)) return false;
  return Boolean(await runActorActions([actor], "protectionNpcRecovery", async () => {
    await actor.update(protectionRecoveryUpdates(actor.flags?.cypher, interval)); return true;
  }));
}
