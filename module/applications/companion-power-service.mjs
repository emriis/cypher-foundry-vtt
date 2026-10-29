/** Source-backed declarations of proximity and mounted movement; no geometry or names are interpreted. */
import { companionBonuses } from "../rules/companion-powers.mjs";
import { followerDisplay } from "./follower-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { runActorActions } from "./action-guard.mjs";
const items = actor => actor?.items?.contents ?? Array.from(actor?.items?.values?.() ?? []);
export const ownsCompanionAbility = (actor, key) => items(actor).some(item => item.type === "ability" && item.system?.key === key);
const pcOwner = actor => actor?.type === "pc" && typeof actor.uuid === "string" && actor.isOwner !== false;

/** Resolve the actual paired NPC; replacement invalidates a stale proximity declaration. */
export async function companionContext(actor) {
  const context = actor?.flags?.cypher?.companionContext;
  if (context?.version !== 1 || context.state !== "active") return null;
  const npc = await resolveDocumentReference(context.npcUuid, "npc");
  if (!npc || npc.flags?.cypher?.companionLinks?.[context.id]?.ownerUuid !== actor.uuid) return null;
  let family = null, available = true;
  if (context.calmed) {
    if (!context.friendly || !ownsCompanionAbility(actor, "soothe-the-savage")) return null;
  } else {
    const follower = (await followerDisplay(actor)).find(follower => follower.id === context.followerId && follower.npcUuid === npc.uuid);
    if (!follower || follower.pending || !["beast", "mount"].includes(follower.sourceAbility?.family)) return null;
    family = follower.sourceAbility.family;
    available = follower.available;
  }
  const incapacitating = ["unconscious", "stunned", "paralyzed"];
  const disabled = getGeneralEffects(npc).some(effect => incapacitating.includes(effect.kind)) || incapacitating.some(kind => npc.statuses?.has(kind));
  const alive = context.alive === true && !npc.statuses?.has("dead");
  return { ...context, npc, family, alive, ready: alive && available && npc.system.health?.value > 0 && !disabled };
}

/**
 * Confirm source-qualified presence and circumstances. The first/replaced link
 * checkpoints both actual owners; later circumstance edits write only the PC.
 * An inactive pending link can be retried with the same choices after reload.
 */
export async function configureCompanion(actor, options = {}) {
  if (!pcOwner(actor)) return false;
  return Boolean(await runActorActions([actor], "companionDeclaration", context => executeCompanionDeclaration(actor, options, context)));
}

/** Hold the PC from the first asynchronous source read through the final link acknowledgement. */
async function executeCompanionDeclaration(actor, { followerId = null, calmedNpcUuid = null, confirmed = false,
  immediate = false, riding = false, friendly = true, alive = true } = {}, actionContext) {
  if (!pcOwner(actor) || confirmed !== true || ![immediate, riding, friendly, alive].every(value => typeof value === "boolean") || followerId && calmedNpcUuid) return false;
  if (!followerId && !calmedNpcUuid) {
    return Boolean(await runActorActions([actor], "companionContext", async () => {
      await actor.update({ "flags.cypher.companionContext": null }); return true;
    }, actionContext));
  }
  const follower = followerId && (await followerDisplay(actor)).find(follower => follower.id === followerId && !follower.pending
    && ["beast", "mount"].includes(follower.sourceAbility?.family));
  if (followerId && !follower || calmedNpcUuid && !ownsCompanionAbility(actor, "soothe-the-savage")) return false;
  if (riding && (calmedNpcUuid || follower.sourceAbility.family !== "mount" || !ownsCompanionAbility(actor, "mount"))) return false;
  const npc = await resolveDocumentReference(follower?.npcUuid ?? calmedNpcUuid, "npc");
  if (!npc || typeof npc.uuid !== "string") return false;
  const previous = actor.flags?.cypher?.companionContext;
  const same = previous?.npcUuid === npc.uuid && previous.followerId === followerId && previous.calmed === Boolean(calmedNpcUuid);
  const id = same ? previous.id : foundry.utils.randomID();
  const linked = npc.flags?.cypher?.companionLinks?.[id]?.ownerUuid === actor.uuid;
  if (!linked && npc.isOwner === false) return false;
  return Boolean(await runActorActions([actor, npc], "companionContext", async () => {
    if (!pcOwner(actor) || !linked && npc.isOwner === false) return false;
    const context = { version: 1, id, npcUuid: npc.uuid, followerId, calmed: Boolean(calmedNpcUuid), friendly, alive, immediate, riding, state: linked ? "active" : "pending" };
    await actor.update({ "flags.cypher.companionContext": context });
    if (!linked) {
      await npc.update({ [`flags.cypher.companionLinks.${id}`]: { version: 1, ownerUuid: actor.uuid } });
      await actor.update({ "flags.cypher.companionContext.state": "active" });
    }
    return true;
  }, actionContext));
}

/** Flat benefits are resolved before the task cap and saved in the existing reroll snapshot. */
export async function companionTaskPlan(actor, { isAttack = false, defenseType = null } = {}) {
  const context = await companionContext(actor);
  const result = companionBonuses(context ? { ...context, stronger: ownsCompanionAbility(actor, "stronger-together"),
    betterment: ownsCompanionAbility(actor, "beast-betterment"), mount: ownsCompanionAbility(actor, "mount") } : {}, { isAttack, isDefense: Boolean(defenseType) });
  return { ...result, ...(context ? { contextId: context.id, npcUuid: context.npc.uuid, followerId: context.followerId } : {}) };
}

/** CRD 7569–7570: an NPC defense asset hinders the attacking PC, rather than rolling NPC dice. */
export async function companionTargetDefense(npc) {
  if (npc?.type !== "npc") return 0;
  for (const [id, link] of Object.entries(npc.flags?.cypher?.companionLinks ?? {})) {
    const owner = await resolveDocumentReference(link.ownerUuid, "pc");
    if (!owner || owner.flags?.cypher?.companionContext?.id !== id) continue;
    const plan = await companionTaskPlan(owner, { defenseType: "dodge" });
    if (plan.npcUuid === npc.uuid && plan.assets > 0) return 1;
  }
  return 0;
}
