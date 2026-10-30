import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { automatonMode, automatonFlight } from "./companion-upgrade-read.mjs";
/** CRD Followers: explicit links, progression, help and replacement; no Ability prose or token geometry is interpreted. */
import { followerProgression, followerHelpAssets, followerReplacementLevel } from "../rules/followers.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions } from "./action-guard.mjs";
const ownedPC = actor => actor?.type === "pc" && typeof actor.uuid === "string" && actor.isOwner !== false;
const ownedNPC = actor => actor?.type === "npc" && actor.isOwner !== false && Number.isSafeInteger(actor.system.level)
  && actor.system.level > 0 && Number.isSafeInteger(actor.system.health?.max) && actor.system.health.max > 0
  && Number.isSafeInteger(actor.system.health.value) && actor.system.health.value >= 0 && actor.system.health.value <= actor.system.health.max;
const natural = value => Number.isSafeInteger(value) && value >= 0;
const path = id => `flags.cypher.followers.${id}`;
const records = actor => Object.values(actor.flags?.cypher?.followers ?? {}).filter(record => record?.version === 1 && typeof record.id === "string" && /^[A-Za-z0-9]+$/.test(record.id) && typeof record.npcUuid === "string"
  && ["active", "pending", "manual"].includes(record.state) && ["attack", "defense", "independent"].includes(record.mode) && typeof record.available === "boolean"
  && Number.isSafeInteger(record.acquiredTier) && record.acquiredTier > 0 && natural(record.earned) && natural(record.extraLevels)
  && Number.isSafeInteger(record.baseLevel) && record.baseLevel > 0 && Number.isSafeInteger(record.baseHealth) && record.baseHealth > 0 && natural(record.healthPerLevel)
  && Number.isSafeInteger(record.revision) && record.revision > 0 && validTasks(record.taskLevels)
  && natural(record.taskLevelExclusions ?? 0) && (record.taskLevelExclusions ?? 0) <= record.extraLevels
  && record.taskLevels.every(task => (task.gainedAt ?? 0) <= record.earned + record.extraLevels - (record.taskLevelExclusions ?? 0)) && Array.isArray(record.previous));
/** Valid persisted slots for source-backed family actions; callers still validate permissions before writes. */
export const followerRecords = actor => records(actor);
const get = (actor, id) => records(actor).find(record => record.id === id);
const write = (actor, record) => actor.update({ [path(record.id)]: record });
const modes = ["attack", "defense", "independent"];
const validTasks = tasks => Array.isArray(tasks) && tasks.every(task => task && typeof task.id === "string" && /^[A-Za-z0-9]+$/.test(task.id) && typeof task.label === "string" && task.label.trim() && natural(task.level) && (task.gainedAt === undefined || natural(task.gainedAt)))
  && new Set(tasks.map(task => task.id)).size === tasks.length;

/** Register an actual NPC with an explicitly confirmed grant and numeric profile. No new creature is invented. */
export async function registerFollower(actor, npc, { confirmed = false, source = "", acquiredTier = actor?.system?.tier,
  healthPerLevel = 3, taskLevels = [], mode = "attack" } = {}) {
  if (!game.user?.isGM || !ownedPC(actor) || !ownedNPC(npc) || confirmed !== true || typeof source !== "string" || !source.trim() || !natural(healthPerLevel)
    || !Number.isSafeInteger(acquiredTier) || acquiredTier < 1 || acquiredTier > actor.system.tier || !validTasks(taskLevels)
    || taskLevels.some(task => task.gainedAt !== undefined)
    || !modes.includes(mode) || !npc.uuid || npc.flags?.cypher?.followerProgress || records(actor).some(record => record.npcUuid === npc.uuid)) return false;
  return Boolean(await runActorActions([actor, npc], "followerRegister", async context => {
    const record = { version: 1, id: foundry.utils.randomID(), npcUuid: npc.uuid, source: source.trim(), acquiredTier,
      baseLevel: npc.system.level, baseHealth: npc.system.health.max, healthPerLevel, taskLevels: structuredClone(taskLevels),
      earned: 0, extraLevels: 0, revision: 1, state: "pending", available: true, mode, previous: [] };
    await write(actor, record);
    return synchronizeFollower(actor, record.id, context);
  }));
}

/**
 * Progress in durable phases. The NPC's level, Health and receipt share one write;
 * a retry after an uncertain response never reapplies that Health increase.
 * An unexpected manual level/maximum edit requires explicit reconciliation.
 */
export async function synchronizeFollower(actor, id, context = null) {
  const record = get(actor, id);
  if (!ownedPC(actor) || !record) return false;
  const npc = await resolveDocumentReference(record.npcUuid, "npc");
  if (!ownedNPC(npc)) return false;
  return Boolean(await runActorActions([actor, npc], "followerSync", async () => {
    let current = get(actor, id);
    if (!current || current.state === "manual") return false;
    const progress = followerProgression(current.acquiredTier, actor.system.tier, current.earned);
    if (!progress) return false;
    const receipt = npc.flags?.cypher?.followerProgress;
    if (receipt && (receipt.ownerUuid !== actor.uuid || receipt.slotId !== id)) return false;
    if (receipt && (npc.system.level !== receipt.level || npc.system.health.max !== receipt.healthMax)) {
      await write(actor, { ...current, state: "manual" }); return false;
    }
    if (progress.pending) {
      current = { ...current, earned: progress.earned, revision: current.revision + 1, state: "pending" };
      await write(actor, current);
    }
    if (receipt?.revision !== current.revision) {
      const level = followerReplacementLevel(current.baseLevel, current.earned, current.extraLevels);
      const healthMax = current.baseHealth + (current.earned + current.extraLevels) * current.healthPerLevel;
      if (!level || !Number.isSafeInteger(healthMax) || healthMax < 1) return false;
      // Accepted adjudication: preserve absolute damage while increasing both
      // maximum and current Health by the same gain. Zero Health is not death;
      // availability is an explicit declaration, not an inferred resurrection.
      const value = Math.max(0, Math.min(healthMax, npc.system.health.value + healthMax - npc.system.health.max));
      await npc.update({ "system.level": level, "system.health.max": healthMax, "system.health.value": value,
        "flags.cypher.followerProgress": { version: 1, ownerUuid: actor.uuid, slotId: id, revision: current.revision, level, healthMax } });
    }
    if (current.state !== "active") await write(actor, { ...current, state: "active" });
    return true;
  }, context));
}

/** Await every writable following after advancement; inaccessible owners remain explicitly pending. */
export async function synchronizeFollowers(actor, context = null) {
  if (!ownedPC(actor)) return false;
  let complete = true;
  for (const record of records(actor)) if (!await synchronizeFollower(actor, record.id, context)) complete = false;
  return complete;
}

/** Source-specific extra improvements are declared by the GM; ordinary help mode/availability belongs to the owner. */
export async function configureFollower(actor, id, { mode, available, extraLevels } = {}) {
  const record = get(actor, id);
  if (!ownedPC(actor) || !record || mode !== undefined && !modes.includes(mode) || available !== undefined && typeof available !== "boolean"
    || extraLevels !== undefined && (!game.user?.isGM || !natural(extraLevels) || extraLevels < record.extraLevels)) return false;
  return Boolean(await runActorActions([actor], "followerConfigure", async context => {
    const improved = extraLevels !== undefined && extraLevels !== record.extraLevels;
    await write(actor, { ...record, ...(mode ? { mode } : {}), ...(available !== undefined ? { available } : {}),
      ...(improved ? { extraLevels, state: "pending", revision: record.revision + 1 } : {}) });
    return !improved || synchronizeFollower(actor, id, context);
  }));
}

/** Replace one slot with a fresh actual NPC, retaining original acquisition tier and every recorded improvement. */
export async function replaceFollower(actor, id, npc, { confirmed = false } = {}) {
  const record = get(actor, id);
  if (!game.user?.isGM || !ownedPC(actor) || !record || !ownedNPC(npc) || confirmed !== true || !npc.uuid
    || npc.flags?.cypher?.followerProgress || records(actor).some(entry => entry.npcUuid === npc.uuid)) return false;
  return Boolean(await runActorActions([actor, npc], "followerReplace", async context => {
    await write(actor, { ...record, npcUuid: npc.uuid, state: "pending", available: true, revision: record.revision + 1,
      previous: [...record.previous, record.npcUuid] });
    return synchronizeFollower(actor, id, context);
  }));
}

/** GM acknowledgement adopts explicitly corrected numeric state without undoing recorded improvements. */
export async function reconcileFollower(actor, id, { confirmed = false, note = "" } = {}) {
  const record = get(actor, id), npc = record && await resolveDocumentReference(record.npcUuid, "npc");
  if (!game.user?.isGM || !ownedPC(actor) || !ownedNPC(npc) || record.state !== "manual" || confirmed !== true || !note.trim()) return false;
  return Boolean(await runActorActions([actor, npc], "followerReconcile", async context => {
    const gains = record.earned + record.extraLevels, baseLevel = npc.system.level - gains, baseHealth = npc.system.health.max - gains * record.healthPerLevel;
    if (baseLevel < 1 || baseHealth < 1) return false;
    await write(actor, { ...record, baseLevel, baseHealth, state: "pending", reconciliation: note });
    // Replace only the numeric receipt after inspection; current Health stays intact.
    await npc.update({ "flags.cypher.followerProgress": { version: 1, ownerUuid: actor.uuid, slotId: id,
      revision: record.revision, level: npc.system.level, healthMax: npc.system.health.max } });
    return synchronizeFollower(actor, id, context);
  }));
}

/** No writes during presentation; manual stat edits and missing token documents stay visibly pending. */
function present(actor, record, npc) {
  const progress = followerProgression(record.acquiredTier, actor.system.tier, record.earned), receipt = npc?.flags?.cypher?.followerProgress;
  const pending = record.state !== "active" || !npc || progress?.pending > 0 || receipt?.revision !== record.revision || receipt?.ownerUuid !== actor.uuid || receipt?.slotId !== record.id
    || receipt.level !== npc.system.level || receipt.healthMax !== npc.system.health.max;
  const blocked = Boolean(npc && (resolveGeneralModifiers(getGeneralEffects(npc)).rejected
    || ["unconscious", "stunned", "paralyzed", "dead"].some(status => npc.statuses?.has(status))));
  return { ...record, unavailable: !record.available || blocked, name: npc?.name ?? record.npcUuid, level: npc?.system.level, health: npc?.system.health, pending,
    modeLabel: `CYPHER.Follower.${record.mode}`, stateLabel: `CYPHER.Follower.${pending ? record.state === "manual" ? "manual" : "pending" : "active"}`,
    canHelp: !pending && !blocked && automatonMode(npc) === "normal" && record.available && npc.system.health.value > 0 && record.mode !== "independent",
    physicalMode: automatonMode(npc), flight: automatonFlight(npc),
    turretPending: Object.values(npc?.flags?.cypher?.turretRounds ?? {}).some(shot => shot.state === "pending"),
    tasks: record.taskLevels.map(task => ({ ...task, level: task.level + record.earned + record.extraLevels - (record.taskLevelExclusions ?? 0) - (task.gainedAt ?? 0) })) };
}

/** Resolve actual token UUIDs for sheets and authoritative action preflight. */
export async function followerDisplay(actor) {
  return Promise.all(records(actor).map(async record => present(actor, record, await resolveDocumentReference(record.npcUuid, "npc"))));
}

/** Dialog rendering uses only already loaded documents; acceptance revalidates asynchronously. */
export function followerDisplaySync(actor) {
  return records(actor).map(record => present(actor, record, globalThis.fromUuidSync?.(record.npcUuid)));
}

/** A follower's assets are independent of PC cooperation; the task engine applies the shared final cap. */
export async function followerTaskPlan(actor, choices = null, { isAttack = false, defenseType = null, excludedIds = [] } = {}) {
  const followers = await followerDisplay(actor), selected = [];
  if (choices === null) choices = followers.filter(entry => entry.canHelp && (!isAttack || entry.mode === "attack") && (!defenseType || entry.mode === "defense")).map(entry => ({ id: entry.id }));
  if (!Array.isArray(choices) || new Set(choices.map(choice => choice?.id)).size !== choices.length) return null;
  if (!choices.length) return { assets: 0, sources: [] };
  for (const choice of choices) {
    // Mounted movement grants its own one-asset exception; the same mount
    // cannot simultaneously supply ordinary follower help to this attack.
    if (excludedIds.includes(choice?.id)) continue;
    const follower = followers.find(entry => entry.id === choice?.id);
    if (!follower?.canHelp || isAttack && follower.mode !== "attack" || defenseType && follower.mode !== "defense") return null;
    const task = choice.taskId ? follower.tasks.find(task => task.id === choice.taskId) : null;
    if (choice.taskId && !task) return null;
    selected.push({ id: follower.id, npcUuid: follower.npcUuid, assets: followerHelpAssets(follower.level, task?.level ?? null) });
  }
  return { assets: Math.min(2, selected.reduce((sum, source) => sum + source.assets, 0)), sources: selected };
}

/** A linked following must be explicitly acting independently before an NPC attack can replace its help. */
export async function followerCanAct(npc) {
  if (automatonMode(npc) !== "normal") return false;
  const link = npc.flags?.cypher?.followerProgress;
  if (!link) return true;
  const owner = await resolveDocumentReference(link.ownerUuid, "pc"), record = owner && get(owner, link.slotId);
  if (!record || record.npcUuid !== npc.uuid) return true;
  return Boolean(record.available && record.mode === "independent");
}

/** Remote GM handles a player's tier update; same-client advancement also awaits sync with its guard context. */
export async function onFollowerTierUpdate(actor, changes) {
  if (!Object.hasOwn(changes, "system.tier") && changes.system?.tier === undefined || !game.user?.isGM || game.users?.activeGM?.id !== game.user.id) return;
  try { await synchronizeFollowers(actor); }
  catch { ui.notifications.warn(game.i18n.localize("CYPHER.Follower.pending")); }
}

/** Restore Follower returns the linked slot to normal availability after its concrete NPC has been restored. */
export async function restoreFollowerAvailability(actor, npcUuid, context = null) {
  const record = records(actor).find(record => record.npcUuid === npcUuid);
  if (!record) return true;
  if (!ownedPC(actor)) return false;
  const npc = await resolveDocumentReference(npcUuid, "npc");
  const effects = npc?.flags?.cypher?.generalEffects ?? [];
  const clearRetainer = npc?.system.health.value > 0 && effects.some(effect => effect.kind === "unconscious" && effect.source === "retainer");
  if (clearRetainer && npc.isOwner === false) return false;
  if (record.available && !clearRetainer) return true;
  return Boolean(await runActorActions([actor, npc], "followerRestore", async () => {
    if (clearRetainer && npc.system.health.value > 0) await npc.update({ "flags.cypher.generalEffects": (npc.flags?.cypher?.generalEffects ?? [])
      .filter(effect => !(effect.kind === "unconscious" && effect.source === "retainer")) });
    if (!record.available) await write(actor, { ...record, available: true }); return true;
  }, context));
}

/** Show the same authoritative task levels on the follower's NPC sheet without rewriting generic NPC modification prose. */
export async function followerNPCDisplay(npc) {
  const link = npc.flags?.cypher?.followerProgress;
  if (link?.version !== 1) return null;
  const owner = await resolveDocumentReference(link.ownerUuid, "pc"), record = owner && get(owner, link.slotId);
  return record?.npcUuid === npc.uuid ? { ...present(owner, record, npc), ownerName: owner.name } : null;
}

/** Known links must belong to the paying host and be synchronized; old unlinked followers retain explicit GM confirmation. */
export function followerRestorationAllowed(actor, npc) {
  const link = npc.flags?.cypher?.followerProgress;
  if (!link) return true;
  const record = link.version === 1 && link.ownerUuid === actor.uuid ? get(actor, link.slotId) : null;
  return Boolean(record?.npcUuid === npc.uuid && !present(actor, record, npc).pending);
}
