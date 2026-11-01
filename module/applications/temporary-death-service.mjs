/** Attribute temporary-body deaths and Duplicate backlash without maintaining a second Health store. */
import { temporaryNpcLink, temporaryFollowers, temporaryUses } from "./temporary-follower-read.mjs";
import { temporaryFollowerActive } from "../rules/temporary-followers.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveAbilityWoundTrack } from "../rules/ability-modifiers.mjs";
import { computeWoundIncrease, reduceWoundSeverity } from "../rules/wounds.mjs";
import { planDefenseCorrection } from "../rules/defense-correction.mjs";
import { defenseRevision } from "./defense-history.mjs";
import { companionFieldReduction } from "./companion-upgrade-read.mjs";
import { syncWoundStatusEffects } from "./damage-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
const severities = ["minor", "moderate", "major"];
const authority = () => game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);

/** A death nonce accompanies the actual Health write, including native/manual damage. */
export function temporaryDeathPatch(npc, value) {
  const link = temporaryNpcLink(npc);
  if (npc?.type !== "npc" || !(npc.system.health?.value > 0) || value !== 0 || !link?.record
    || !["duplicate", "undead"].includes(link.record.family) || !temporaryFollowerActive(link.record, link.owner.flags?.cypher)) return {};
  return { "flags.cypher.temporaryDeathId": foundry.utils.randomID() };
}
export function stampTemporaryDeath(npc, changes) {
  if (changes["flags.cypher.temporaryDeathId"] || changes.flags?.cypher?.temporaryDeathId) return;
  const value = changes["system.health.value"] ?? changes.system?.health?.value;
  Object.assign(changes, temporaryDeathPatch(npc, value === undefined ? undefined : Number(value)));
}

/** The wound, its attribution receipt and the body's killed state commit atomically on the owner. */
export async function settleTemporaryDeath(npc, context = null) {
  const link = temporaryNpcLink(npc), id = npc?.flags?.cypher?.temporaryDeathId;
  if (!authority() || !link?.owner || !link.record || !id || npc.system.health?.value !== 0 || link.owner.isOwner === false) return false;
  const { owner, record } = link;
  return Boolean(await runActorActions([owner, npc], "temporaryDeath", async () => {
    if (owner.flags?.cypher?.temporaryDeaths?.[id]) return true;
    if (!temporaryFollowerActive(record, owner.flags?.cypher)) return true;
    const counts = Object.fromEntries(severities.map(severity => [severity, 0]));
    const revisions = Object.fromEntries(severities.map(severity => [severity, defenseRevision(owner, `wound_${severity}`)]));
    const updates = {};
    if (record.family === "duplicate") {
      let severity = "moderate";
      for (let step = 0; severity && step < companionFieldReduction(owner); step++) severity = reduceWoundSeverity(severity);
      if (severity) {
        const wounds = resolveAbilityWoundTrack(owner.system.wounds, owner.system.activeAbilityEffects, items(owner), owner.system);
        const increase = computeWoundIncrease(severity, wounds);
        counts[increase.target] = Math.max(0, increase.current - owner.system.wounds[increase.target].current);
        updates[`system.wounds.${increase.target}.current`] = increase.current;
      }
    }
    const receipt = { version: 1, state: "applied", success: false, recordId: record.id, npcUuid: npc.uuid, wounds: counts, revisions };
    await owner.update({ ...updates, [`flags.cypher.temporaryDeaths.${id}`]: receipt,
      [`flags.cypher.temporaryFollowers.${record.id}.state`]: "killed" });
    if (record.family === "duplicate" && typeof owner.toggleStatusEffect === "function") await syncWoundStatusEffects(owner);
    return true;
  }, context));
}

/** Preflight the known contribution before a paid reroll changes any document. Healing requires review. */
export async function temporaryDeathCorrection(npc, deathId) {
  const link = temporaryNpcLink(npc), owner = link?.owner;
  const receipt = owner?.flags?.cypher?.temporaryDeaths?.[deathId];
  if (!deathId) return { owner: null, updates: {} };
  if (!owner || owner.isOwner === false || !receipt || receipt.npcUuid !== npc.uuid || receipt.state !== "applied") return null;
  const revisions = Object.fromEntries(severities.map(severity => [severity, defenseRevision(owner, `wound_${severity}`)]));
  const updates = planDefenseCorrection({ contribution: receipt, wounds: owner.system.wounds, revisions });
  if (!updates) return null;
  const record = owner.flags.cypher.temporaryFollowers[receipt.recordId], original = owner.flags.cypher.temporaryUses?.[record.useId];
  const replaced = !record.multiple && temporaryUses(owner).some(use => use.key === record.key && use.state === "complete"
    && use.id !== record.useId && use.startedAt >= (original?.startedAt ?? 0));
  return { owner, updates: { ...updates, [`flags.cypher.temporaryDeaths.${deathId}.state`]: "corrected",
    [`flags.cypher.temporaryFollowers.${receipt.recordId}.state`]: replaced ? "ended" : "active" } };
}

/** Native updates are acknowledged after the original guarded action releases its owners. */
const pending = new Map();
export function queueTemporaryDeath(npc, changes) {
  const value = changes["system.health.value"] ?? changes.system?.health?.value;
  if (!authority() || Number(value) !== 0 || value === undefined || !npc.flags?.cypher?.temporaryDeathId || pending.has(npc.uuid)) return;
  let attempts = 0;
  const execute = async () => {
    try {
      if (await settleTemporaryDeath(npc) || npc.system.health.value > 0 || ++attempts >= 20) { pending.delete(npc.uuid); return; }
    } catch (error) { console.error("Cypher | Temporary death settlement failed", error); pending.delete(npc.uuid); return; }
    pending.set(npc.uuid, setTimeout(execute, 100));
  };
  pending.set(npc.uuid, setTimeout(execute, 100));
}

/** Explicit retry remains available after a partial native update, without replaying an acknowledged wound. */
export async function reconcileTemporaryDeaths(actor) {
  if (!authority() || actor?.isOwner === false) return false;
  for (const record of temporaryFollowers(actor)) {
    const npc = await resolveDocumentReference(record.npcUuid, "npc");
    if (npc?.system.health?.value === 0 && npc.flags?.cypher?.temporaryDeathId && !await settleTemporaryDeath(npc)) return false;
  }
  return true;
}
