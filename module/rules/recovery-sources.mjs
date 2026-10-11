/**
 * CRD recovery allowances declared by stable mechanical keys. Stored booleans
 * still represent the four ordinary recoveries; optional flags count only extra
 * source allowances, preserving existing worlds without a schema migration.
 */
import { CYPHER } from "../config.mjs";

/**
 * Inventory the ordinary allowance and independently tracked extra sources.
 * Contracts: Power Shifts > Healing; Untamed Recovery; Mind Surge; Machine Not
 * Flesh. No effect is inferred from localized names or description strings.
 * @param {object} system PC state.
 * @param {object[]} items Embedded Ability Items.
 * @param {object} flags Optional cypher recovery flags from earlier actions.
 * @param {string} interval Declared ordinary recovery interval.
 * @returns {object[]} Sources with limits, used counts, Pool restrictions and power prerequisites.
 */
export function recoverySources(system, items, flags, interval) {
  if (!CYPHER.recoveryIntervals.includes(interval)) return [];
  const has = key => items.some(item => item.type === "ability" && item.system?.key === key);
  const sources = [{ id: "standard", limit: 1, used: system.recoveries?.[interval] ? 1 : 0,
    allowedStats: CYPHER.stats, requiresPower: interval === "action" && has("machine-not-flesh") && flags.machineRecoveryPowerRequired === true }];
  if (interval === "action") {
    const healing = ["superhero", "custom"].includes(system.genre) ? system.powerShifts?.healing ?? 0 : 0;
    if (Number.isInteger(healing) && healing > 0 && healing <= 3) sources.push({ id: "power-shift-healing", limit: healing });
    if (has("untamed-recovery")) sources.push({ id: "untamed-recovery", limit: 1 });
    if (has("mind-surge")) sources.push({ id: "mind-surge", limit: 1, allowedStats: ["intellect"] });
    if (has("machine-not-flesh")) sources.push({ id: "machine-not-flesh", limit: 1, requiresPower: true });
  }
  return sources.map(source => ({ ...source, allowedStats: source.allowedStats ?? CYPHER.stats,
    used: source.used ?? Math.max(0, flags.additionalRecoveriesUsed?.[source.id] ?? 0) }))
    .map(source => ({ ...source, remaining: Math.max(0, source.limit - source.used) }));
}
