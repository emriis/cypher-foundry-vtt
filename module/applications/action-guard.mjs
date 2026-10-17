/** Client-local ownership prevents read/await/write races across action categories. */
const pending = new WeakMap();
export const ACTION_CONTEXT = Symbol("cypherActionContext");

/**
 * Reserve all actual document identities before executing. Nested services must
 * explicitly carry their parent's context; unrelated categories cannot borrow
 * a busy actor. Synchronous reservations avoid waiting/multi-target deadlocks.
 * This is neither cross-client synchronization nor rollback of committed writes.
 * @template T
 * @param {object[]} actors Actual owners, including synthetic Actor identities.
 * @param {string} kind Category; recursive activation of the same kind is rejected.
 * @param {(context: object) => T|Promise<T>} execute Accepted orchestration.
 * @param {object|null} [context=null] Explicit parent-service context.
 * @returns {Promise<T|null>} Callback result, or null if an owner is busy.
 */
export async function runActorActions(actors, kind, execute, context = null) {
  const owners = [...new Set(actors.filter(actor => actor && typeof actor === "object"))];
  if (!owners.length) return null;
  const token = context ?? {};
  if (owners.some(actor => {
    const current = pending.get(actor);
    return current && (current.context !== token || current.kinds.has(kind));
  })) return null;
  for (const actor of owners) {
    const current = pending.get(actor) ?? { context: token, kinds: new Set() };
    current.kinds.add(kind);
    pending.set(actor, current);
  }
  try { return await execute(token); }
  finally {
    for (const actor of owners) {
      const current = pending.get(actor);
      current.kinds.delete(kind);
      if (!current.kinds.size) pending.delete(actor);
    }
  }
}

/** Reserve one actor; explicit contexts allow legitimate nested orchestration. */
export function runActorAction(actor, kind, execute, context = null) {
  return runActorActions([actor], kind, execute, context);
}
