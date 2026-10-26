import { CYPHER_GENERATION } from "./cypher-generation-catalogue.mjs";

/** CRD Cypher Limit: spent, discarded, transferred or hidden physical items do not occupy a carried slot. */
export function isCarriedCypher(item) {
  return item?.type === "cypher" && !item.system?.depleted
    && !["stashed", "discarded", "transferred"].includes(item.flags?.cypher?.custody);
}

/** Check the carried capacity before an acquisition; callers never purge existing inventory. */
export function cypherCapacity(items, limit, incoming = 1) {
  if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(incoming) || incoming < 0) return false;
  return items.filter(isCarriedCypher).length + incoming <= limit;
}

/** Resolve a CRD generation step, not a power-effect roll. Every d100 endpoint includes 100 for printed 00. */
export function resolveCypherGeneration(table, roll) {
  if (!Number.isSafeInteger(roll) || roll < 1 || roll > 100) return null;
  const entries = table === "manifest" ? CYPHER_GENERATION.manifestPower : CYPHER_GENERATION.tables[table];
  const entry = entries?.find(entry => roll >= entry.min && roll <= entry.max);
  if (!entry) return null;
  return { ...entry, ...(["low", "medium", "advanced", "high", "ultra"].includes(table) ? { power: table } : {}) };
}
