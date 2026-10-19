import { CYPHER } from "../config.mjs";

/**
 * Build an effective wound track without changing saved capacities or counts.
 * @param {object} wounds Persisted severity/current/max pairs.
 * @param {object[]} activeEffects Actor-owned activation references.
 * @param {object[]} abilityItems Owned Items supplying structured modifiers.
 * @param {object} [context={}] Actor's current rank, when a grant requires it.
 * @returns {object} Independent track used for overflow, healing and presentation.
 */
export function resolveAbilityWoundTrack(wounds, activeEffects, abilityItems, context = {}) {
  const { woundCapacity } = resolveActiveAbilityModifiers(activeEffects, abilityItems, context);
  return effectiveWoundTrack(wounds, woundCapacity);
}

/**
 * Read the shield capacity available when its owner uses it, keeping the PC
 * track separate. No Actor/Item update or wound removal occurs here.
 * @param {object} wounds Shield's saved track.
 * @param {object[]} activeEffects Owner's activation references.
 * @param {object[]} abilityItems Owner's embedded Items.
 * @param {object} [context={}] Owner's current rank.
 * @returns {object} Independent effective shield track.
 */
export function resolveShieldWoundTrack(wounds, activeEffects, abilityItems, context = {}) {
  const { shieldWoundCapacity } = resolveActiveAbilityModifiers(activeEffects, abilityItems, context);
  return effectiveWoundTrack(wounds, shieldWoundCapacity);
}

/** Preserve over-capacity counts when a benefit is removed; never erase wounds. */
function effectiveWoundTrack(wounds, capacities) {
  return Object.fromEntries(Object.entries(wounds).map(([severity, wound]) =>
    [severity, { ...wound, max: Math.max(0, wound.max + (capacities[severity] ?? 0)) }]));
}

/**
 * Aggregate explicit passive modifiers and active Ability effects.
 *
 * This pure rule intentionally ignores effect descriptions. Unsupported
 * mechanics remain represented by source text until a faithful structured
 * representation is introduced.
 * Capacity grants use independent severity/recipient groups: a minor bonus and
 * a moderate bonus both apply. Overlapping positive grants within one group
 * from genre/Type/Focus Abilities contribute only their strongest value.
 * Explicit species/Descriptor origins remain additive outside that group,
 * even though Foundry represents their benefits as Ability Items.
 * Existing reductions remain additive.
 *
 * @param {Array<object>} activeEffects Actor-owned active effect references.
 * @param {Array<object>} abilityItems Embedded Ability Items.
 * @param {object} [context={}] Actor's current rank; missing rank never satisfies a minimum.
 * @returns {{poolMax: object, edge: object, woundCapacity: object, shieldWoundCapacity: object}}
 */
export function resolveActiveAbilityModifiers(activeEffects, abilityItems, context = {}) {
  const result = {
    poolMax: Object.fromEntries(CYPHER.stats.map(stat => [stat, 0])),
    edge: Object.fromEntries(CYPHER.stats.map(stat => [stat, 0])),
    woundCapacity: Object.fromEntries(
      CYPHER.woundSeverities.map(severity => [severity, 0])
    ),
    shieldWoundCapacity: Object.fromEntries(
      CYPHER.woundSeverities.map(severity => [severity, 0])
    )
  };

  const seenEffects = new Set();
  const capacityGrants = new Map();
  const modifierLists = (abilityItems ?? []).filter(item => item?.type === "ability")
    .map(item => modifierSource(item, item.system.passiveModifiers ?? []));

  for (const active of activeEffects ?? []) {
    const effectKey = `${active?.itemUuid}::${active?.effectId}`;
    if (seenEffects.has(effectKey)) continue;
    seenEffects.add(effectKey);

    const item = (abilityItems ?? []).find(
      candidate => candidate?.uuid === active.itemUuid
    );
    if (!item || item.type !== "ability") continue;

    const effect = (item.system.effects ?? []).find(
      candidate => candidate.id === active.effectId
    );
    if (!effect) continue;

    modifierLists.push(modifierSource(item, effect.modifiers ?? []));
  }

  for (const { modifiers, independentCapacity } of modifierLists) {
    for (const modifier of modifiers) {
      if (!Number.isSafeInteger(modifier.amount)) continue;
      const minimumRank = modifier.minimumRank ?? 0;
      if (!Number.isSafeInteger(minimumRank) || minimumRank < 0
        || (minimumRank > 0 && (!Number.isSafeInteger(context.rank) || context.rank < minimumRank))) continue;
      if (modifier.kind === "poolMax"
        && CYPHER.stats.includes(modifier.stat)) {
        result.poolMax[modifier.stat] += modifier.amount;
      } else if (modifier.kind === "edge"
        && CYPHER.stats.includes(modifier.stat)) {
        result.edge[modifier.stat] += modifier.amount;
      } else if (
        ["woundCapacity", "shieldWoundCapacity"].includes(modifier.kind)
        && CYPHER.woundSeverities.includes(modifier.severity)
      ) {
        const key = `${modifier.kind}:${modifier.severity}`;
        const prior = capacityGrants.get(key) ?? 0;
        // Only positive Ability-group capacity is non-stacking. Other origins
        // and existing negative modifiers stay outside that group's maximum.
        const amount = modifier.amount > 0 && !independentCapacity
          ? Math.max(0, modifier.amount - prior) : modifier.amount;
        if (!independentCapacity) capacityGrants.set(key, Math.max(prior, modifier.amount));
        result[modifier.kind][modifier.severity] += amount;
      }
    }
  }

  return result;
}

/** Keep each modifier's actual origin; names and descriptive prose are not scope. */
function modifierSource(item, modifiers) {
  // Ordinary standalone/legacy Ability Items retain the Ability default.
  // Explicit non-Ability origins never enter its non-stacking group.
  const origin = item.flags?.cypher?.grantOrigin?.kind ?? "ability";
  return { modifiers, independentCapacity: !["ability", "genre", "type", "focus"].includes(origin) };
}
