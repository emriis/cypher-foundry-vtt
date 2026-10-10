/** Per-Actor, per-action guards prevent overlapping requests on this client. */
const pending = new WeakMap();

/**
 * Reject an overlapping activation and always release the guard on completion.
 * This is not a cross-client lock or a rollback mechanism for document writes.
 * @template T
 * @param {object} actor Actual Actor identity, including synthetic Actors.
 * @param {string} kind Action category; distinct nested categories are allowed.
 * @param {() => (T|Promise<T>)} execute Accepted action callback.
 * @returns {Promise<T|null>} Callback result or null while the category is busy.
 */
export async function runActorAction(actor, kind, execute) {
  const actions = pending.get(actor) ?? new Set();
  if (actions.has(kind)) return null;
  actions.add(kind); pending.set(actor, actions);
  try { return await execute(); }
  finally {
    actions.delete(kind);
    if (!actions.size) pending.delete(actor);
  }
}
