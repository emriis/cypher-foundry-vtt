/** Cached personal-field, barrier and declared containment state; never mutate during preparation. */
import { objectState } from "../rules/objects.mjs";
import { resolveCachedDocumentReference } from "./reference-resolver.mjs";
export const awesomeBarriers = actor => Object.values(actor?.flags?.cypher?.awesomeBarriers ?? {}).filter(field => field?.version === 1);
/** Recovery revision, not wall-clock time: a longer recovery also advances this epoch. */
export const awesomeEpoch = actor => actor?.flags?.cypher?.protectionRecoveries?.tenMinutes ?? 0;

/** A changed/missing combat requires explicit narrative completion, not an invented turn deadline. */
export function awesomeSuspended(actor) {
  const until = actor?.flags?.cypher?.awesomePersonal?.shatteredUntil;
  if (!until) return false;
  const combat = globalThis.game?.combat;
  return !until.combatId || combat?.id !== until.combatId
    || (combat.flags?.cypher?.turnRevisions?.[until.combatantId] ?? 0) < until.turnRevision;
}
/** Source-bound activation survives Item removal, but never survives its recovery epoch. */
export function awesomePersonalActive(actor) {
  const field = actor?.flags?.cypher?.awesomePersonal;
  return field?.version === 1 && field.state === "active" && field.epoch === awesomeEpoch(actor) && !awesomeSuspended(actor);
}

/** Expired/pending fields remain historical Object Actors but cannot obstruct or receive fresh attacks. */
export function awesomeBarrierActive(object) {
  const link = object?.flags?.cypher?.awesomeBarrier;
  if (!link) return null;
  const owner = resolveCachedDocumentReference(link.ownerUuid), field = owner?.flags?.cypher?.awesomeBarriers?.[link.id];
  return Boolean(field?.version === 1 && field.state === "active" && field.objectUuid === object.uuid && field.epoch === awesomeEpoch(owner));
}
export const awesomeBarrierObstructs = object => awesomeBarrierActive(object) === true && objectState(object.system)?.status === "functional";
/** Only an explicitly declared crossing is rejected; token coordinates never establish line of effect. */
export function awesomeCrossingBlocked(uuid) {
  if (uuid === null || uuid === undefined || uuid === "") return false;
  const object = typeof uuid === "string" && resolveCachedDocumentReference(uuid);
  return !object || !object.flags?.cypher?.awesomeBarrier || awesomeBarrierObstructs(object);
}
/** Only acknowledged successful captures in intact fields constrain the actual NPC. */
export function awesomeContainments(actor) {
  return Object.values(actor?.flags?.cypher?.awesomeContainments ?? {}).flatMap(link => {
    if (link?.version !== 1 || link.released) return [];
    const owner = resolveCachedDocumentReference(link.ownerUuid), field = owner?.flags?.cypher?.awesomeBarriers?.[link.fieldId];
    const target = field?.targets?.find(target => target.id === link.id && target.uuid === actor.uuid);
    const object = field && resolveCachedDocumentReference(field.objectUuid);
    return target?.state === "complete" && target.success && object && awesomeBarrierObstructs(object)
      ? [{ ...link, objectUuid: object.uuid, name: object.name }] : [];
  });
}
/** Pure projection of cached documents; keep uncertain paid work visible after reload. */
export function awesomeDisplay(actor) {
  const personal = actor?.flags?.cypher?.awesomePersonal;
  const current = personal?.version === 1 && personal.epoch === awesomeEpoch(actor);
  return { personal: current && personal.state === "active" ? { ...personal, suspended: awesomeSuspended(actor) } : null,
    choices: (actor.items?.contents ?? Array.from(actor.items?.values?.() ?? [])).filter(item => item.type === "ability" && item.system.key === "awesome-force-field").map(item => ({ id: item.id, name: item.name })),
    barriers: awesomeBarriers(actor).map(field => ({ ...field, pending: field.state === "pending", active: field.state === "active" && field.epoch === awesomeEpoch(actor),
      canEnd: field.state !== "ended", displayState: field.epoch !== awesomeEpoch(actor) ? "expired" : field.state,
      targets: field.targets.map(target => ({ ...target, name: resolveCachedDocumentReference(target.uuid)?.name ?? target.uuid,
        displayState: target.state === "complete" ? target.success ? "hit" : "miss" : target.state,
        awaiting: field.state === "active" && field.epoch === awesomeEpoch(actor) && target.state === "awaiting", manual: target.state === "rolling" })) })), containment: awesomeContainments(actor) };
}
