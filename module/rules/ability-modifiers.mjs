import { CYPHER } from "../config.mjs";

/**
 * Aggregate structured self-modifiers from active Ability effects.
 *
 * This pure rule intentionally ignores effect descriptions. Unsupported
 * mechanics remain represented by source text until a faithful structured
 * representation is introduced.
 *
 * @param {Array<object>} activeEffects Actor-owned active effect references.
 * @param {Array<object>} abilityItems Embedded Ability Items.
 * @returns {{poolMax: object, edge: object, woundCapacity: object}}
 */
export function resolveActiveAbilityModifiers(activeEffects, abilityItems) {
  const result = {
    poolMax: Object.fromEntries(CYPHER.stats.map(stat => [stat, 0])),
    edge: Object.fromEntries(CYPHER.stats.map(stat => [stat, 0])),
    woundCapacity: Object.fromEntries(
      CYPHER.woundSeverities.map(severity => [severity, 0])
    )
  };

  for (const active of activeEffects ?? []) {
    const item = (abilityItems ?? []).find(
      candidate => candidate?.uuid === active.itemUuid
    );
    if (!item || item.type !== "ability") continue;

    const effect = (item.system.effects ?? []).find(
      candidate => candidate.id === active.effectId
    );
    if (!effect) continue;

    for (const modifier of effect.modifiers ?? []) {
      if (modifier.kind === "poolMax"
        && CYPHER.stats.includes(modifier.stat)) {
        result.poolMax[modifier.stat] += modifier.amount;
      } else if (modifier.kind === "edge"
        && CYPHER.stats.includes(modifier.stat)) {
        result.edge[modifier.stat] += modifier.amount;
      } else if (
        modifier.kind === "woundCapacity"
        && CYPHER.woundSeverities.includes(modifier.severity)
      ) {
        result.woundCapacity[modifier.severity] += modifier.amount;
      }
    }
  }

  return result;
}
