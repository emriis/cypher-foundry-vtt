/** Timed automaton attention and Retainer interception, with durable per-NPC receipts. */
import { followerDisplay, followerRecords } from "./follower-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { retainerHealthDamage } from "../rules/companion-powers.mjs";
import { companionNpcProtection } from "./companion-upgrade-read.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { expireWeaponEffectsAfterAction } from "./weapon-effect-service.mjs";
const owned = actor => actor?.type === "pc" && actor.isOwner !== false && typeof actor.uuid === "string";
const electedGM = () => game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
const has = (actor, key) => items(actor).some(item => item.type === "ability" && item.system?.key === key);
const now = () => game.time.worldTime;
const work = actor => Object.values(actor.flags?.cypher?.companionRepairs ?? {}).filter(record => record?.version === 1);
const interceptions = actor => Object.values(actor.flags?.cypher?.retainerInterceptions ?? {}).filter(record => record?.version === 1);

/** Resolve a synchronized actual slot without trusting a caller-supplied NPC or world template. */
async function target(actor, id, family) {
  const follower = (await followerDisplay(actor)).find(follower => follower.id === id && !follower.pending && follower.sourceAbility?.family === family);
  if (!follower) return null;
  const npc = await resolveDocumentReference(follower.npcUuid, "npc");
  return npc && npc.isOwner !== false ? { follower, npc } : null;
}
function repairAllowed(actor, follower, npc, { allowFull = false } = {}) {
  return follower.available && ["automaton-assistant", "expert-automaton"].includes(follower.sourceAbility?.key)
    && has(actor, follower.sourceAbility.key) && npc.system.health.value > 0 && (allowFull || npc.system.health.value < npc.system.health.max);
}

/** Start explicitly declared uninterrupted attention, in game seconds; no Health or resource point is spent. */
export async function startAutomatonRepair(actor, id, options = {}) {
  if (!owned(actor)) return false;
  return Boolean(await runActorActions([actor], "automatonAttention", context => executeStartRepair(actor, id, options, context)));
}

async function executeStartRepair(actor, id, { durationSeconds, confirmed = false } = {}, actionContext) {
  if (!owned(actor) || confirmed !== true || !Number.isSafeInteger(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(now())) return false;
  const resolved = await target(actor, id, "automaton");
  if (!resolved || !repairAllowed(actor, resolved.follower, resolved.npc)
    || work(actor).some(record => ["working", "pending"].includes(record.state))) return false;
  return Boolean(await runActorActions([actor, resolved.npc], "automatonRepairStart", async () => {
    if (!owned(actor) || !repairAllowed(actor, resolved.follower, resolved.npc)
      || work(actor).some(record => ["working", "pending"].includes(record.state))) return false;
    const record = { version: 1, id: foundry.utils.randomID(), slotId: id, npcUuid: resolved.npc.uuid,
      startedAt: now(), durationSeconds, state: "working" };
    await actor.update({ [`flags.cypher.companionRepairs.${record.id}`]: record }); return true;
  }, actionContext));
}

/** Apply the source's two Health once. A committed NPC receipt survives later damage and lost responses. */
export async function finishAutomatonRepair(actor, id, options = {}) {
  if (!owned(actor)) return false;
  return Boolean(await runActorActions([actor], "automatonRepairRequest", context => executeFinishRepair(actor, id, options, context)));
}

/** Keep cancellation and completion mutually exclusive from their first asynchronous read. */
async function executeFinishRepair(actor, id, { workConfirmed = false, cancel = false } = {}, actionContext) {
  if (!owned(actor)) return false;
  const record = work(actor).find(record => record.id === id);
  if (!record || !["working", "pending"].includes(record.state)) return false;
  if (cancel) {
    if (record.state !== "working") return false;
    return Boolean(await runActorActions([actor], "automatonRepairCancel", async () => {
      await actor.update({ [`flags.cypher.companionRepairs.${id}.state`]: "cancelled" }); return true;
    }, actionContext));
  }
  if (workConfirmed !== true || !Number.isFinite(now()) || now() < record.startedAt + record.durationSeconds) return false;
  const resolved = await target(actor, record.slotId, "automaton");
  if (!resolved || resolved.npc.uuid !== record.npcUuid) return false;
  const { npc, follower } = resolved;
  return Boolean(await runActorActions([actor, npc], "automatonRepairFinish", async () => {
    let receipt = npc.flags?.cypher?.companionRepairs?.[id];
    // Completed attention still finishes after unrelated healing, with zero
    // restoration. This releases its pending checkpoint without undoing that heal.
    if (!receipt && !repairAllowed(actor, follower, npc, { allowFull: true })) return false;
    if (record.state === "working") await actor.update({ [`flags.cypher.companionRepairs.${id}.state`]: "pending" });
    if (!receipt) {
      const restored = Math.max(0, Math.min(2, npc.system.health.max - npc.system.health.value));
      receipt = { version: 1, ownerUuid: actor.uuid, restored };
      await npc.update({ "system.health.value": npc.system.health.value + restored, [`flags.cypher.companionRepairs.${id}`]: receipt });
    }
    if (receipt.ownerUuid !== actor.uuid) return false;
    await actor.update({ [`flags.cypher.companionRepairs.${id}.state`]: "complete" }); return true;
  }, actionContext));
}

/** Display pending work without ticking clocks or mutating Actor documents during preparation. */
export function companionSupportDisplay(actor) {
  return { repairs: work(actor).filter(record => ["working", "pending"].includes(record.state)).map(record => ({ ...record,
    remaining: Math.max(0, Math.ceil(record.startedAt + record.durationSeconds - now())), working: record.state === "working" })),
  interceptions: interceptions(actor).filter(record => record.state === "pending") };
}

/** Source-specific repair controls; Fleet does not acquire an unstated quick-repair clause. */
export async function companionRepairChoices(actor) {
  return (await followerDisplay(actor)).filter(follower => !follower.pending && repairAllowed(actor, follower, { system: { health: follower.health } }));
}

/** Actual eligible retainer choices for the incoming-attack dialog; availability is rechecked on acceptance. */
export async function retainerChoices(actor) {
  return (await followerDisplay(actor)).filter(follower => follower.sourceAbility?.family === "retainer" && !follower.pending
    && follower.available && follower.health.value > 0 && !follower.unavailable && has(actor, "retainer"));
}

/**
 * Replace the PC's defense before any defense die, shield use or consequences.
 * The elected GM confirms a hit and numeric NPC damage; PC wounds/Pool damage
 * are never converted. Edge discounts the two Intellect once. A single PC
 * update checkpoints payment before the atomic NPC Health/receipt write.
 */
export async function interceptRetainer(actor, id, options = {}, context = null) {
  if (!owned(actor) || !electedGM()) return false;
  return Boolean(await runActorActions([actor, options.attacker], "retainerRequest", parent => executeRetainerInterception(actor, id, options, parent), context));
}

async function executeRetainerInterception(actor, id, { attacker, amount, ignoresArmor = 0, confirmed = false, actionTiming = null } = {}, context) {
  if (!owned(actor) || !electedGM() || confirmed !== true || attacker?.type !== "npc" || attacker.isOwner === false
    || ["unconscious", "dead"].some(status => actor.statuses?.has(status))
    || resolveGeneralModifiers(getGeneralEffects(actor), [], { isDefense: true, noPhysicalMovement: true }).rejected
    || interceptions(actor).some(record => record.state === "pending")) return false;
  const resolved = await target(actor, id, "retainer");
  if (!resolved || !(await retainerChoices(actor)).some(choice => choice.id === id)) return false;
  const { npc } = resolved;
  const baseDamage = retainerHealthDamage(amount, npc.system.armor ?? 0, ignoresArmor);
  const damage = baseDamage === null ? null : Math.max(0, baseDamage - companionNpcProtection(npc));
  const stat = actor.system.stats?.intellect;
  const edge = stat?.edge ?? 0;
  const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items(actor), actor.system);
  const cost = Math.max(0, 2 - edge - (modifiers.edge.intellect ?? 0));
  if (damage === null || !stat || !Number.isSafeInteger(cost) || stat.pool.value < cost) return false;
  const round = roundActionContext(attacker, { isAttack: true, actionTiming });
  if (round && !round.kind) return false;
  return Boolean(await runActorActions([actor, npc, attacker], "retainerInterception", async parent => {
    if (!owned(actor) || !electedGM() || npc.isOwner === false || attacker.isOwner === false || !has(actor, "retainer")
      || !(await retainerChoices(actor)).some(choice => choice.id === id)
      || interceptions(actor).some(record => record.state === "pending") || actor.system.stats.intellect.pool.value < cost) return false;
    if (!await consumeRoundAction(round, parent)) return false;
    const record = { version: 1, id: foundry.utils.randomID(), slotId: id, npcUuid: npc.uuid, attackerUuid: attacker.uuid,
      attackerActionRevision: attacker.flags?.cypher?.weaponActionRevision ?? 0, damage, cost, state: "pending" };
    await actor.update({ "system.stats.intellect.pool.value": actor.system.stats.intellect.pool.value - cost,
      [`flags.cypher.retainerInterceptions.${record.id}`]: record });
    return finishRetainerInterception(actor, record.id, parent);
  }, context));
}

/** Resume an accepted, paid interception even if the acquired source was removed meanwhile. */
export async function finishRetainerInterception(actor, id, context = null) {
  if (!owned(actor) || !electedGM()) return false;
  return Boolean(await runActorActions([actor], "retainerFinishRequest", parent => executeFinishInterception(actor, id, parent), context));
}

async function executeFinishInterception(actor, id, context) {
  if (!owned(actor) || !electedGM()) return false;
  const record = interceptions(actor).find(record => record.id === id);
  if (!record) return false;
  if (record.state === "complete") return true;
  if (record.state !== "pending") return false;
  const npc = await resolveDocumentReference(record.npcUuid, "npc");
  const attacker = await resolveDocumentReference(record.attackerUuid, "npc");
  const follower = followerRecords(actor).find(follower => follower.id === record.slotId && follower.npcUuid === record.npcUuid);
  if (!npc || npc.isOwner === false || !attacker || attacker.isOwner === false || !follower) return false;
  return Boolean(await runActorActions([actor, npc, attacker], "retainerInterceptionFinish", async () => {
    let receipt = npc.flags?.cypher?.retainerInterceptions?.[id];
    if (!receipt) {
      const value = Math.max(0, npc.system.health.value - record.damage);
      const effects = getGeneralEffects(npc);
      receipt = { version: 1, ownerUuid: actor.uuid, damage: npc.system.health.value - value };
      await npc.update({ "system.health.value": value, [`flags.cypher.retainerInterceptions.${id}`]: receipt,
        ...(value === 0 ? { "flags.cypher.generalEffects": [...effects, { id, kind: "unconscious", source: "retainer" }] } : {}) });
    }
    if (receipt.ownerUuid !== actor.uuid) return false;
    // The original NPC action also finishes after a resumed interception. Its
    // monotonic revision prevents replay if that cleanup committed uncertainly,
    // or if a later NPC action has already consumed the interval.
    if ((attacker.flags?.cypher?.weaponActionRevision ?? 0) === record.attackerActionRevision) await expireWeaponEffectsAfterAction(attacker);
    if (npc.system.health.value === 0) await actor.update({ [`flags.cypher.followers.${follower.id}.available`]: false });
    await actor.update({ [`flags.cypher.retainerInterceptions.${id}.state`]: "complete" });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${game.i18n.localize("CYPHER.Companion.intercepted")} — ${foundry.utils.escapeHTML(npc.name ?? "")} (${receipt.damage})</p>`,
      flags: { cypher: { rerollable: false, retainerInterception: { id, ownerUuid: actor.uuid, npcUuid: npc.uuid, attackerUuid: record.attackerUuid, damage: receipt.damage, cost: record.cost } } } });
    return true;
  }, context));
}
