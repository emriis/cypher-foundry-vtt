import { CYPHER } from "../config.mjs";

/**
 * Resolve a Cypher stat key against actor system data.
 *
 * This helper contains no Foundry document access. It only maps a stat id to
 * the corresponding data and update path used by application services.
 *
 * @param {object} system Actor system data.
 * @param {string} statKey Core stat id or custom stat id.
 * @returns {{data: object, path: string, label: string}|null} Resolved stat.
 */
export function resolveStat(system, statKey) {
  if (CYPHER.stats.includes(statKey)) {
    return {
      data: system.stats[statKey],
      path: `system.stats.${statKey}`,
      label: `CYPHER.Stat.${statKey}`
    };
  }

  const customStats = system.customStats ?? [];
  const index = customStats.findIndex(stat => stat.id === statKey);
  if (index === -1) return null;

  return {
    data: customStats[index],
    path: `system.customStats.${index}`,
    label: customStats[index].label
  };
}
