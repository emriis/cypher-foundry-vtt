import { CYPHER } from "../config.mjs";
import { resolveStat } from "./stats.mjs";

/**
 * Resolve the Pool stat used by an Ability cost.
 *
 * Choice costs must be resolved from the source-defined options rather than
 * inferred from effect prose.
 *
 * @param {object} cost Structured Ability cost.
 * @param {string|null} selectedStat Player-selected stat for choice costs.
 * @returns {string|null} Resolved stat identifier.
 */
export function resolveAbilityCostStat(cost, selectedStat = null) {
  if (!cost || cost.amount <= 0 || cost.stat === "none") return null;
  if (cost.stat !== "choice") return cost.stat;
  if (!selectedStat || !(cost.options ?? []).includes(selectedStat)) return null;
  return selectedStat;
}

/**
 * Compute and validate an Ability Pool cost against actor state.
 *
 * @param {object} system Actor system data.
 * @param {object} cost Structured Ability cost.
 * @param {string|null} selectedStat Player-selected stat for choice costs.
 * @returns {{stat: string|null, amount: number, path: string|null}|null}
 *   Resolved transaction or null when the cost cannot be paid.
 */
export function resolveAbilityCost(system, cost, selectedStat = null) {
  const amount = Number(cost?.amount) || 0;
  if (amount < 0) return null;

  const stat = resolveAbilityCostStat(cost, selectedStat);
  if (!amount) return { stat: null, amount: 0, path: null };
  if (!stat || !CYPHER.stats.includes(stat)) return null;

  const resolved = resolveStat(system, stat);
  if (!resolved) return null;
  if (resolved.data.pool.value < amount) return null;

  return {
    stat,
    amount,
    path: `${resolved.path}.pool.value`
  };
}
