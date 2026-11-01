/** CRD temporary companion creation: source profiles, allocation and recovery clocks. */
const natural = value => Number.isSafeInteger(value) && value >= 0;
export const BASIC_NECROMANCY_IDENTITIES = {
  genre: "ability.basic-necromancy-d68c55e38e39",
  focus: "ability.basic-necromancy-455f4fa10b45"
};

/** Counts and effect Effort are explicit allocations; they never become generic attack easing. */
export function temporaryFollowerPlan(key, { identity = null, count = 1, improved = false, duplicateEffort = 0, levelEffort = null } = {}) {
  if (!natural(count) || count < 1 || !natural(duplicateEffort) || typeof improved !== "boolean") return null;
  if (key === "duplicate") {
    const levels = levelEffort ?? Array(duplicateEffort + 1).fill(0);
    if (!Array.isArray(levels) || levels.length !== duplicateEffort + 1 || !levels.every(natural)) return null;
    return { key, family: "duplicate", levels: levels.map(value => value + 2), cost: 2, stat: "might", range: "short",
      action: "action", recovery: "tenMinutes", effectEffort: duplicateEffort + levels.reduce((sum, value) => sum + value, 0) };
  }
  if (key === "recompile-machine") {
    const levels = levelEffort ?? [0];
    if (duplicateEffort || count !== 1 || !Array.isArray(levels) || levels.length !== 1 || !levels.every(natural)) return null;
    return { key, family: "machine", cost: 8, stat: "intellect", range: "long", action: "lastAction", recovery: "tenHours",
      maximumLevel: 4 + levels[0], effectEffort: levels[0] };
  }
  if (duplicateEffort || levelEffort !== null && (!Array.isArray(levelEffort) || levelEffort.some(value => value !== 0))) return null;
  let level, cost, additional, action = "action", repairable = true, range = "short";
  if (key === "basic-necromancy") {
    if (!Object.values(BASIC_NECROMANCY_IDENTITIES).includes(identity)) return null;
    const focus = identity === BASIC_NECROMANCY_IDENTITIES.focus;
    if (count > 1 && (!focus || !improved)) return null;
    level = 1; cost = 3; additional = 1; repairable = focus;
    action = focus ? "lastAction" : "action"; range = focus && improved ? "short" : "immediate";
  } else if (key === "greater-necromancy") { level = 3; cost = 5; additional = 2; }
  else if (key === "true-necromancy") { level = 5; cost = 8; additional = 3; }
  else return null;
  return { key, identity, family: "undead", cost: cost + (count - 1) * additional, stat: "intellect", range, action,
    multiple: key !== "basic-necromancy" || identity === BASIC_NECROMANCY_IDENTITIES.focus && improved,
    repairable, recovery: "hour", levels: Array(count).fill(level), effectEffort: 0 };
}

/** Accepted adjudication: intact corpses retain damage; a repaired destroyed Focus corpse returns full. */
export function temporaryHealth(health, { repairable = false, repaired = false } = {}) {
  if (!natural(health?.value) || !natural(health?.max) || !health.max || health.value > health.max) return null;
  return health.value > 0 ? health.value : repairable && repaired === true ? health.max : null;
}

/** No fixed day cutoff: recompiled companions last until the owner's ten-hour recovery. */
export function temporaryFollowerActive(record, flags = {}) {
  return record?.version === 1 && record.state === "active" && record.revision === (flags.temporaryRecoveries?.[record.recovery] ?? 0)
    && (!record.useId || flags.temporaryUses?.[record.useId]?.state === "complete");
}

/** Inert copied gear supplies no equipment benefits, even if retained for a later attack correction. */
export function temporaryCopyActive(item, flags) {
  const copy = item?.flags?.cypher?.temporaryEquipment;
  return !copy || Boolean(flags && temporaryFollowerActive(flags.temporaryFollowers?.[copy.id], flags));
}

/** Expiration is part of the recovery write, before any asynchronous NPC/equipment cleanup. */
export function temporaryRecoveryUpdates(flags = {}, interval) {
  if (!Object.values(flags.temporaryFollowers ?? {}).some(record => ["active", "pending", "rebooting", "awaiting"].includes(record.state))) return {};
  const minimum = { action: 0, tenMinutes: 1, hour: 2, tenHours: 3 }[interval] ?? 0;
  return Object.fromEntries(["tenMinutes", "hour", "tenHours"].filter((_value, index) => minimum > index)
    .map(key => [`flags.cypher.temporaryRecoveries.${key}`, (flags.temporaryRecoveries?.[key] ?? 0) + 1]));
}
