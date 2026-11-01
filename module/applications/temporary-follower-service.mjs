/** CRD temporary undead, duplicates and recompiled companions: elected-GM settlement with durable receipts. */
import { temporaryFollowerActive, temporaryHealth } from "../rules/temporary-followers.mjs";
import { resolveTaskEffort } from "../rules/task-effort.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { runActorActions } from "./action-guard.mjs";
import { temporaryFollowers, temporaryUses, temporaryAbilityPlan } from "./temporary-follower-read.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { getSuperheroicsRank } from "./task-preparation.mjs";
const allowed = actor => actor?.type === "pc" && actor.isOwner !== false && game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const items = actor => actor?.items?.contents ?? Array.from(actor?.items?.values?.() ?? []);
const now = () => game.time.worldTime;
const ownedNpc = npc => npc?.type === "npc" && npc.isOwner !== false && !npc.flags?.cypher?.followerProgress;

/** Retained acquired sources only; Recompile's offensive branches are intentionally a separate family. */
export function temporaryFollowerChoices(actor) {
  return items(actor).filter(item => temporaryAbilityPlan(item)).map(item => ({ id: item.id, key: item.system.key, name: item.name }));
}

/** Use the shared Superheroics allowance rather than imposing a separate six-level limit on Duplicate. */
export function temporaryEffortMaximum(actor, itemId) {
  const plan = temporaryAbilityPlan(actor.items?.get(itemId));
  return 6 + getSuperheroicsRank(actor, plan?.stat);
}

/**
 * The GM selects actual NPC profiles and declares size/range/corpse eligibility.
 * No universal Health formula or creature attack profile is invented. Payment
 * and the full pending plan share one PC write before any NPC mutation.
 */
export async function summonTemporaryFollowers(actor, itemId, { confirmed = false, inRange = false, eligible = false,
  targets = [], duplicateEffort = 0, levelEffort = null } = {}) {
  if (!allowed(actor) || !confirmed || !inRange || !eligible || !Array.isArray(targets) || !targets.length) return false;
  return Boolean(await runActorActions([actor], "temporarySummon", async context => {
    if (temporaryUses(actor).some(use => use.state === "pending")) return false;
    const item = actor.items.get(itemId), improved = items(actor).some(item => item.type === "ability" && item.system.key === "improved-necromancy");
    const plan = temporaryAbilityPlan(item, { count: targets.length, improved, duplicateEffort, levelEffort });
    if (!plan || plan.family === "machine" || targets.length !== plan.levels.length) return false;
    const resolved = [], records = [], useId = foundry.utils.randomID();
    for (const [index, target] of targets.entries()) {
      const npc = await resolveDocumentReference(target.npcUuid, "npc");
      const prior = npc?.flags?.cypher?.temporaryFollower;
      const history = prior && actor.flags?.cypher?.temporaryFollowers?.[prior.id];
      if (!ownedNpc(npc) || npc.system.level !== plan.levels[index] || resolved.includes(npc)
        || prior && (prior.ownerUuid !== actor.uuid || !history || temporaryFollowerActive(history, actor.flags?.cypher))
        || plan.family === "duplicate" && (items(npc).length || prior)) return false;
      if (history?.state === "killed" && !plan.repairable) return false;
      const health = plan.family === "undead" ? temporaryHealth(history?.state === "killed" ? { ...npc.system.health, value: 0 } : npc.system.health,
        { repairable: plan.repairable, repaired: target.repaired === true }) : npc.system.health?.value;
      if (!(health > 0) || !(npc.system.health?.max > 0) || health > npc.system.health.max) return false;
      resolved.push(npc);
      const id = foundry.utils.randomID();
      records.push({ version: 1, id, useId, key: item.system.key, identity: plan.identity ?? null, sourceItemId: item.id,
        family: plan.family, multiple: plan.multiple ?? false, npcUuid: npc.uuid, level: plan.levels[index], health,
        originalHealth: npc.system.health.value, maximumHealth: npc.system.health.max, previousLink: prior?.id ?? null,
        mode: target.mode ?? "attack", state: "pending",
        recovery: plan.recovery, revision: actor.flags?.cypher?.temporaryRecoveries?.[plan.recovery] ?? 0 });
      if (!["attack", "defense", "independent"].includes(records.at(-1).mode)) return false;
    }
    const stat = actor.system.stats?.[plan.stat], modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items(actor), actor.system);
    // Special Effort is counted in one shared allocation, with Edge applied once.
    const effort = resolveTaskEffort({ effortScore: actor.system.effort, effectEffortLevels: plan.effectEffort,
      activationCost: plan.cost, edge: (stat?.edge ?? 0) + (modifiers.edge[plan.stat] ?? 0), isAttack: true,
      superheroicsRank: getSuperheroicsRank(actor, plan.stat) });
    if (!effort || (stat?.pool?.value ?? 0) < effort.cost || resolveGeneralModifiers(getGeneralEffects(actor)).rejected
      || ["unconscious", "dead", "stunned", "paralyzed"].some(status => actor.statuses?.has(status))) return false;
    const round = roundActionContext(actor, { actionTiming: plan.action });
    if (round && !round.kind) return false;
    const previous = temporaryFollowers(actor).filter(record => temporaryFollowerActive(record, actor.flags?.cypher)
      && record.key === plan.key && record.identity === (plan.identity ?? null) && !plan.multiple);
    const equipment = plan.family === "duplicate" ? items(actor).filter(item => ["attack", "armor", "shield", "equipment"].includes(item.type))
      .map(item => ({ sourceId: item.id, name: item.name, type: item.type, system: structuredClone(item.toObject?.().system ?? item.system) })) : [];
    return Boolean(await runActorActions([actor, ...resolved], "temporaryCommit", async () => {
      if (!allowed(actor) || resolved.some(npc => npc.isOwner === false) || actor.items.get(item.id) !== item) return false;
      if (resolved.some((npc, index) => npc.system.level !== records[index].level || npc.system.health.value !== records[index].originalHealth
        || npc.system.health.max !== records[index].maximumHealth || (npc.flags?.cypher?.temporaryFollower?.id ?? null) !== records[index].previousLink)) return false;
      if (!await consumeRoundAction(round, context, { receiptId: useId })) return false;
      const use = { version: 1, id: useId, itemId, key: item.system.key, state: "pending", records: records.map(record => record.id),
        previous: previous.map(record => record.id), equipment, cost: effort.cost, stat: plan.stat, startedAt: now() };
      await actor.update({ [`flags.cypher.temporaryUses.${useId}`]: use,
        [`system.stats.${plan.stat}.pool.value`]: stat.pool.value - effort.cost,
        ...Object.fromEntries(records.map(record => [`flags.cypher.temporaryFollowers.${record.id}`, record])) });
      return settleSummon(actor, useId, resolved);
    }, context));
  }));
}

/** Resume without paying or recreating acknowledged Item copies, including a lost creation response. */
export async function resumeTemporarySummon(actor, useId) {
  if (!allowed(actor)) return false;
  return Boolean(await runActorActions([actor], "temporaryResume", async context => {
    const use = temporaryUses(actor).find(use => use.id === useId && use.state === "pending");
    if (!use) return false;
    const npcs = [];
    for (const id of use.records) npcs.push(await resolveDocumentReference(actor.flags.cypher.temporaryFollowers[id].npcUuid, "npc"));
    if (npcs.some(npc => !ownedNpc(npc))) return false;
    return Boolean(await runActorActions([actor, ...npcs], "temporaryResumeCommit", () => settleSummon(actor, useId, npcs), context));
  }));
}

/** End a paid partial cast without refunding costs or restoring an earlier body's stale snapshot. */
export async function abandonTemporarySummon(actor, useId) {
  if (!allowed(actor)) return false;
  return Boolean(await runActorActions([actor], "temporaryAbandon", async () => {
    const use = temporaryUses(actor).find(use => use.id === useId && use.state === "pending");
    if (!use) return false;
    await actor.update({ [`flags.cypher.temporaryUses.${useId}.state`]: "abandoned",
      ...Object.fromEntries(use.records.map(id => [`flags.cypher.temporaryFollowers.${id}.state`, "ended"])) });
    return true;
  }));
}

async function settleSummon(actor, useId, npcs) {
  const use = actor.flags.cypher.temporaryUses[useId];
  for (const previous of use.previous) await actor.update({ [`flags.cypher.temporaryFollowers.${previous}.state`]: "ended" });
  for (const [index, id] of use.records.entries()) {
    const record = actor.flags.cypher.temporaryFollowers[id], npc = npcs[index];
    if (!temporaryFollowerActive({ ...record, state: "active", useId: null }, actor.flags?.cypher)) {
      await actor.update({ [`flags.cypher.temporaryFollowers.${id}.state`]: "ended" }); continue;
    }
    const receipt = npc.flags?.cypher?.temporaryFollower;
    if (npc.system.health.max !== record.maximumHealth || npc.system.level !== record.level || receipt?.id === id && npc.system.health.value === 0) return false;
    if (receipt?.id !== id) {
      if (npc.system.health.value !== record.originalHealth || npc.system.health.max !== record.maximumHealth || npc.system.level !== record.level) return false;
      await npc.update({ "system.health.value": record.health, "flags.cypher.temporaryFollower": { version: 1, ownerUuid: actor.uuid, id, family: record.family } });
    }
    for (const copy of use.equipment) {
      const existing = items(npc).filter(item => item.flags?.cypher?.temporaryEquipment?.id === id && item.flags.cypher.temporaryEquipment.sourceId === copy.sourceId);
      if (existing.length > 1) return false;
      if (!existing.length) await npc.createEmbeddedDocuments("Item", [{ name: copy.name, type: copy.type, system: copy.system,
        flags: { cypher: { temporaryEquipment: { ownerUuid: actor.uuid, id, sourceId: copy.sourceId } } } }]);
    }
    await actor.update({ [`flags.cypher.temporaryFollowers.${id}.state`]: "active" });
  }
  await actor.update({ [`flags.cypher.temporaryUses.${useId}.state`]: "complete" }); return true;
}

/** Declared mode is separate from permanent follower advancement and never changes the NPC's ownership. */
export async function configureTemporaryFollower(actor, id, mode) {
  if (!allowed(actor) || !["attack", "defense", "independent"].includes(mode)) return false;
  return Boolean(await runActorActions([actor], "temporaryMode", async () => {
    if (!actor.flags?.cypher?.temporaryFollowers?.[id]) return false;
    await actor.update({ [`flags.cypher.temporaryFollowers.${id}.mode`]: mode }); return true;
  }));
}

/** Dismissal is the source's extra action on the owner's turn, rather than an ordinary primary action. */
export async function dismissTemporaryFollower(actor, id) {
  if (!allowed(actor)) return false;
  return Boolean(await runActorActions([actor], "temporaryDismiss", async context => {
    const record = actor.flags?.cypher?.temporaryFollowers?.[id];
    if (record?.family !== "duplicate" || !temporaryFollowerActive(record, actor.flags?.cypher)) return false;
    const round = roundActionContext(actor, { extraAction: true, extraActionSource: "Duplicate dismissal" });
    const combat = game.combat;
    if (combat?.started && !round && combat.combatant?.actor?.uuid !== actor.uuid) return false;
    if (!await consumeRoundAction(round, context)) return false;
    await actor.update({ [`flags.cypher.temporaryFollowers.${id}.state`]: "ended" }); return true;
  }));
}
