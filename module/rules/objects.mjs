/**
 * CRD Damage to Objects 7741–7748; physical material cutting 5798.
 * @param {object|null} system Original level, damage counters and physical/material declarations.
 * @returns {object|null} Valid state with derived current level/status, or null for inconsistent counters.
 */
export function objectState(system) {
  const { originalLevel, levelDamage, destructionDamage, physical } = system ?? {};
  if (![originalLevel, levelDamage, destructionDamage].every(Number.isSafeInteger) || originalLevel < 1
    || levelDamage < 0 || levelDamage > originalLevel || destructionDamage < 0 || destructionDamage > originalLevel
    || levelDamage < originalLevel && destructionDamage !== 0 || typeof physical !== "boolean") return null;
  const level = originalLevel - levelDamage;
  return { originalLevel, levelDamage, destructionDamage, physical, material: system.material ?? "", level,
    status: level > 0 ? "functional" : destructionDamage >= originalLevel ? "destroyed" : "broken" };
}

/**
 * One successful hit; breaking overflow never becomes destruction damage on that same hit.
 * @param {object} system Persisted object state; no wounds or stat Pools.
 * @param {number} damage Non-negative integer raw damage points.
 * @param {object} profile Physical-tool declaration, hardness, nullable cutting threshold and Armor bypass.
 * @returns {object|null} New counters and actual applied damage, or null when the action is invalid.
 */
export function resolveObjectDamage(system, damage, profile) {
  const state = objectState(system);
  if (!state || state.status === "destroyed" || !Number.isSafeInteger(damage) || damage < 0
    || typeof profile?.usesPhysicalTool !== "boolean" || !Number.isSafeInteger(profile.armorBypass) || profile.armorBypass < 0
    || profile.cutLevel !== null && (!Number.isSafeInteger(profile.cutLevel) || profile.cutLevel < 0)) return null;
  const cuts = state.physical && profile.usesPhysicalTool && profile.cutLevel !== null && state.level <= profile.cutLevel;
  if (profile.usesPhysicalTool && !cuts && typeof profile.toolHardEnough !== "boolean") return null;
  const ineffective = profile.usesPhysicalTool && !cuts && !profile.toolHardEnough;
  const armor = cuts ? 0 : Math.max(0, state.level - (state.physical ? profile.armorBypass : 0));
  const penetrating = ineffective ? 0 : Math.max(0, damage - armor);
  const levelLoss = Math.min(state.level, penetrating);
  const destruction = state.level === 0 ? Math.min(state.originalLevel - state.destructionDamage, penetrating) : 0;
  return { system: { originalLevel: state.originalLevel, levelDamage: state.levelDamage + levelLoss,
    destructionDamage: state.destructionDamage + destruction, physical: state.physical, material: state.material },
    armor, cuts, ineffective, appliedDamage: levelLoss + destruction };
}
