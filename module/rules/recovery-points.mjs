/** CRD Recoveries: distribute a result among stat Pools without exceeding maxima. */
import { CYPHER } from "../config.mjs";

/**
 * Supply a convenient default for macros and the editable allocation dialog.
 * Players can replace this Might/Speed/Intellect order with their own choices.
 * @param {number} total Available recovery points.
 * @param {object} pools Stat-keyed current values and effective maxima.
 * @param {string[]} [allowedStats=CYPHER.stats] Restricted extra recovery Pools.
 * @returns {object} Proposed points per Pool, with excess points unused.
 */
export function defaultRecoveryAllocation(total, pools, allowedStats = CYPHER.stats) {
  let remaining = Math.max(0, total);
  return Object.fromEntries(CYPHER.stats.map(stat => {
    const pool = pools[stat];
    const amount = pool && allowedStats.includes(stat) ? Math.min(remaining, Math.max(0, pool.max - pool.value)) : 0;
    remaining -= amount;
    return [stat, amount];
  }));
}

/**
 * Validate player allocation before writing any benefit or recovery marker.
 * Only actual standard Pools are supported; names/prose never create stores.
 * @param {number} total Nonnegative integer recovery result or reroll increment.
 * @param {object} pools Current Pool snapshot at the mutation boundary.
 * @param {object} allocation Nonnegative integer points per Pool.
 * @param {string[]} [allowedStats=CYPHER.stats] Source-declared Pool restriction.
 * @returns {object|null} Actor update paths, or null for invalid input.
 */
export function recoveryPoolUpdates(total, pools, allocation, allowedStats = CYPHER.stats) {
  if (!Number.isInteger(total) || total < 0 || !allocation || typeof allocation !== "object" || Array.isArray(allocation)
    || Object.keys(allocation).some(stat => !CYPHER.stats.includes(stat))) return null;
  const updates = {};
  let spent = 0;
  for (const stat of CYPHER.stats) {
    const amount = allocation[stat] ?? 0;
    const pool = pools[stat];
    if (!Number.isInteger(amount) || amount < 0 || (amount && (!pool || !allowedStats.includes(stat)
      || amount > Math.max(0, pool.max - pool.value)))) return null;
    spent += amount;
    if (amount) updates[`system.stats.${stat}.pool.value`] = pool.value + amount;
  }
  return spent <= total ? updates : null;
}
