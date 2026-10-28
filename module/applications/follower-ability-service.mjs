/** Source-backed permanent grants. One PC checkpoint precedes every NPC write;
 * shared follower receipts resume a partial batch without repeating improvements.
 * The elected GM owns these multi-document actions; guards are client-local.
 */
import { followerAbilityPlan, followerUpgradeDelta } from "../rules/follower-abilities.mjs";
import { followerRecords, followerDisplay, synchronizeFollower } from "./follower-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions } from "./action-guard.mjs";
const allowed = actor => game.user?.isGM && game.users?.activeGM?.id === game.user.id && actor?.type === "pc" && actor.isOwner !== false;
const entries = actor => Object.values(actor.flags?.cypher?.followerAbilityUses ?? {}).filter(use => use?.version === 1);
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const tasksValid = tasks => Array.isArray(tasks) && tasks.every(task => task?.gainedAt === undefined && typeof task?.id === "string" && /^[A-Za-z0-9]+$/.test(task.id)
  && typeof task.label === "string" && task.label.trim() && natural(task.level)) && new Set(tasks.map(task => task.id)).size === tasks.length;
const writableNPC = npc => npc?.type === "npc" && npc.isOwner !== false && typeof npc.uuid === "string"
  && Number.isSafeInteger(npc.system.level) && npc.system.level > 0
  && Number.isSafeInteger(npc.system.health?.max) && npc.system.health.max > 0
  && natural(npc.system.health.value) && npc.system.health.value <= npc.system.health.max;
const synchronizedNPC = (actor, record, npc) => {
  const receipt = npc.flags?.cypher?.followerProgress;
  return receipt?.version === 1 && receipt.ownerUuid === actor.uuid && receipt.slotId === record.id && receipt.revision === record.revision
    && receipt.level === npc.system.level && receipt.healthMax === npc.system.health.max;
};
const snapshot = npc => JSON.stringify([npc.system.level, npc.system.health.max, npc.system.health.value, npc.flags?.cypher?.followerProgress]);

/** Pending batches remain resumable after the original Ability is removed. */
export function followerAbilityUses(actor) { return entries(actor); }

/** Actual owned Items only. A localized name never establishes an entitlement. */
export function followerAbilityChoices(actor) {
  return items(actor).filter(item => item.type === "ability" && followerAbilityPlan(item.system?.key))
    .map(item => ({ id: item.id, name: item.name, key: item.system.key,
      used: entries(actor).some(use => use.itemId === item.id), alternative: Boolean(followerAbilityPlan(item.system.key, "upgrade")) }));
}

/** Read-only source choices for dialogs; the write boundary repeats every eligibility check. */
export async function followerAbilityDetails(actor, itemId, variant = "new") {
  const item = items(actor).find(item => item.id === itemId && item.type === "ability");
  const plan = item && followerAbilityPlan(item.system?.key, variant);
  if (!plan) return null;
  const followers = await followerDisplay(actor);
  return { plan, followers, eligible: plan.upgrade ? followers.filter(follower => !follower.pending
    && Number.isSafeInteger(followerUpgradeDelta(plan.upgrade, follower.sourceAbility?.family, follower.level))) : [] };
}

/**
 * Apply one acquired copy, not one activation per click. GM confirmation covers
 * creature appearance/size, acquisition tier and declared Health growth. New
 * NPCs must already exist; no bestiary or special creature powers are invented.
 * @param {object} actor Actual PC owner.
 * @param {string} itemId Owned Ability identity.
 * @param {object} options Explicit choice of complete source alternative.
 * @returns {Promise<boolean>} False on rejection, true after all receipts settle.
 */
export async function applyFollowerAbility(actor, itemId, { confirmed = false, acquiredTier = actor?.system?.tier,
  variant = "new", followers = [], upgrades = [] } = {}) {
  if (!allowed(actor) || confirmed !== true || !Number.isSafeInteger(acquiredTier) || acquiredTier < 1 || acquiredTier > actor.system.tier
    || !Array.isArray(followers) || !Array.isArray(upgrades)) return false;
  const item = items(actor).find(item => item.id === itemId && item.type === "ability" && item.isOwner !== false);
  const plan = item && followerAbilityPlan(item.system?.key, variant);
  if (!plan || Number.isSafeInteger(item.system.tier) && acquiredTier < item.system.tier || entries(actor).some(use => use.itemId === itemId)
    || entries(actor).filter(use => use.key === item.system.key).length >= (plan.limit ?? (item.system.repeatable ? Infinity : 1))
    || plan.oncePerTier && entries(actor).some(use => use.key === item.system.key && use.acquiredTier === acquiredTier)
    || followers.length !== plan.grants.reduce((sum, grant) => sum + grant.count, 0)
    || upgrades.length !== (plan.upgrade?.count ?? 0) || new Set(upgrades.map(entry => entry?.id)).size !== upgrades.length) return false;
  // Resolve every actual owner and reject the complete batch before checkpointing.
  const itemSnapshot = JSON.stringify([item.system.key, item.system.tier, item.system.repeatable]);
  const pcSnapshot = JSON.stringify([actor.system.tier, actor.flags?.cypher?.followers, actor.flags?.cypher?.followerAbilityUses]);
  const display = await followerDisplay(actor), slots = followerRecords(actor), newRecords = [], changedRecords = [], owners = [actor], npcSnapshots = new Map();
  const useId = foundry.utils.randomID(), source = item.name, key = item.system.key;
  for (const choice of upgrades) {
    const record = slots.find(record => record.id === choice?.id), shown = display.find(entry => entry.id === choice?.id);
    const delta = shown && !shown.pending && followerUpgradeDelta(plan.upgrade, record.sourceAbility?.family, shown.level);
    const npc = record && await resolveDocumentReference(record.npcUuid, "npc");
    if (!Number.isSafeInteger(delta) || delta < 0 || delta === 0 && !plan.upgrade.family
      || !writableNPC(npc) || !synchronizedNPC(actor, record, npc)) return false;
    npcSnapshots.set(npc, snapshot(npc));
    let taskLevels = structuredClone(record.taskLevels);
    if (plan.upgrade.newTask) {
      // Accepted adjudication: initial acquisition level + 1, without retroactive
      // improvements. The offset lets later gains improve the new task normally.
      const task = { id: choice.newTask?.id, label: choice.newTask?.label, level: record.baseLevel + 1 };
      if (!tasksValid([task]) || taskLevels.some(existing => existing.id === task.id)) return false;
      taskLevels.push({ ...task, gainedAt: record.earned + record.extraLevels + delta - (record.taskLevelExclusions ?? 0) });
    }
    changedRecords.push({ ...record, extraLevels: record.extraLevels + delta, taskLevels,
      taskLevelExclusions: (record.taskLevelExclusions ?? 0) + (plan.upgrade.modifiesTasks ? 0 : delta),
      sourceAbility: { ...record.sourceAbility, family: plan.upgrade.family ?? record.sourceAbility.family },
      state: "pending", revision: record.revision + 1 });
    owners.push(npc);
  }
  let position = 0;
  for (const grant of plan.grants) for (let count = 0; count < grant.count; count++) {
    const choice = followers[position++], existing = choice?.slotId && slots.find(record => record.id === choice.slotId);
    const shown = existing && display.find(record => record.id === existing.id);
    const npc = choice && await resolveDocumentReference(existing?.npcUuid ?? choice.npcUuid, "npc");
    const taskLevels = existing?.taskLevels ?? choice?.taskLevels ?? [];
    if (!writableNPC(npc) || owners.includes(npc)
      || existing && (shown.pending || existing.sourceAbility || existing.baseLevel !== grant.level || existing.acquiredTier !== acquiredTier || !synchronizedNPC(actor, existing, npc))
      || !existing && (choice?.slotId || npc.flags?.cypher?.followerProgress || npc.system.level !== grant.level
        || !natural(choice.healthPerLevel) || !tasksValid(taskLevels) || slots.some(record => record.npcUuid === npc.uuid))
      || grant.tasks !== undefined && (taskLevels.length !== grant.tasks || taskLevels.some(task => task.level !== grant.taskLevel))
      || grant.charm && !taskLevels.some(task => task.id === "charm")) return false;
    npcSnapshots.set(npc, snapshot(npc));
    const record = { ...(existing ?? { version: 1, id: foundry.utils.randomID(), npcUuid: npc.uuid, source, acquiredTier,
      baseLevel: grant.level, baseHealth: npc.system.health.max, healthPerLevel: choice.healthPerLevel, taskLevels,
      earned: 0, extraLevels: 0, revision: 1, available: true, mode: "attack", previous: [] }), state: "pending",
      sourceAbility: { version: 1, key, itemId, useId, family: grant.family } };
    newRecords.push(record); owners.push(npc);
  }
  const plannedRecords = [...changedRecords, ...newRecords];
  if (plannedRecords.some(record => {
    const gains = record.earned + record.extraLevels;
    return !Number.isSafeInteger(record.baseLevel + gains) || !Number.isSafeInteger(record.baseHealth + gains * record.healthPerLevel)
      || record.taskLevels.some(task => !natural(task.level + gains - (record.taskLevelExclusions ?? 0) - (task.gainedAt ?? 0)));
  })) return false;
  return Boolean(await runActorActions(owners, "followerAbility", async context => {
    // A single PC update records all entitlements and affected slots. An uncertain
    // response leaves this checkpoint inspectable rather than granting twice.
    if (!allowed(actor) || items(actor).find(candidate => candidate.id === itemId) !== item || item.isOwner === false
      || itemSnapshot !== JSON.stringify([item.system.key, item.system.tier, item.system.repeatable])
      || pcSnapshot !== JSON.stringify([actor.system.tier, actor.flags?.cypher?.followers, actor.flags?.cypher?.followerAbilityUses])
      || owners.slice(1).some(npc => !writableNPC(npc) || npcSnapshots.get(npc) !== snapshot(npc))) return false;
    const records = plannedRecords;
    const use = { version: 1, id: useId, itemId, key, source, acquiredTier, variant, state: "pending", slots: records.map(record => record.id) };
    await actor.update(Object.fromEntries([[`flags.cypher.followerAbilityUses.${useId}`, use],
      ...records.map(record => [`flags.cypher.followers.${record.id}`, record])]));
    return synchronizeFollowerAbility(actor, useId, context);
  }));
}

/** Resume pending slots using the shared atomic NPC receipts; never recompute an acquired improvement. */
export async function synchronizeFollowerAbility(actor, id, context = null) {
  if (!allowed(actor)) return false;
  const use = entries(actor).find(use => use.id === id);
  if (!use || !Array.isArray(use.slots)) return false;
  return Boolean(await runActorActions([actor], "followerAbilityResume", async parent => {
    for (const slot of use.slots) if (!await synchronizeFollower(actor, slot, parent)) return false;
    if (use.state !== "complete") await actor.update({ [`flags.cypher.followerAbilityUses.${id}.state`]: "complete" });
    return true;
  }, context));
}
