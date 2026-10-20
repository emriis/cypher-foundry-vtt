/**
 * Remove only this failed defense's recorded wounds/Pool loss from current state.
 * Revisions count intervening removals/recovery, not later injuries/spending.
 * A changed revision means attribution was lost; never restore an old snapshot.
 * @param {object} input Current state and the persisted contribution.
 * @returns {object|null} Incremental Actor updates, or null when attribution is unsafe.
 */
export function planDefenseCorrection({ contribution, wounds, revisions, pool = null }) {
  if (contribution?.version !== 1 || contribution.state !== "applied" || contribution.success !== false) return null;
  const updates = {};
  for (const severity of ["minor", "moderate", "major"]) {
    const amount = contribution.wounds?.[severity];
    const revision = contribution.revisions?.[severity];
    const current = wounds?.[severity]?.current;
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(revision) || revision < 0) return null;
    if (!amount) continue;
    if (!Number.isSafeInteger(current) || current < amount || (revisions?.[severity] ?? 0) !== revision) return null;
    updates[`system.wounds.${severity}.current`] = current - amount;
  }
  if (contribution.pool) {
    const { amount, revision } = contribution.pool;
    if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(revision) || revision < 0
      || !pool || pool.revision !== revision || !Number.isSafeInteger(pool.value)
      || !Number.isSafeInteger(pool.max) || pool.value + amount > pool.max || typeof pool.path !== "string") return null;
    updates[pool.path] = pool.value + amount;
  }
  return updates;
}
