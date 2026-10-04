import { CYPHER } from "../config.mjs";

/**
 * Build the deterministic data used by a recovery roll.
 *
 * @param {number} tier Character tier.
 * @param {number} bonus Recovery bonus.
 * @returns {{formula: string, data: object}}
 */
export function getRecoveryRollData(tier, bonus) {
  return {
    formula: "1d6 + @tier + @bonus",
    data: { tier, bonus }
  };
}

/**
 * Compute the wound and recovery-marker updates for a recovery interval.
 *
 * @param {string} interval Recovery interval.
 * @param {object} wounds Current wound tracks.
 * @param {object} recoveries Recovery markers.
 * @returns {{updates: object, woundNoteKey: string|null}}
 */
export function computeRecoveryUpdates(interval, wounds, recoveries = {}) {
  const updates = {};
  let woundNoteKey = null;

  if (interval === "tenMinutes") {
    updates["system.wounds.minor.current"] = 0;
    woundNoteKey = "CYPHER.Recovery.RemovesAllMinor";
  } else if (interval === "hour") {
    if (wounds.moderate.current > 0) {
      updates["system.wounds.moderate.current"] = wounds.moderate.current - 1;
      woundNoteKey = "CYPHER.Recovery.RemovesOneModerate";
    } else {
      updates["system.wounds.minor.current"] = 0;
      woundNoteKey = "CYPHER.Recovery.RemovesAllMinor";
    }
  } else if (interval === "tenHours") {
    updates["system.wounds.moderate.current"] = 0;
    woundNoteKey = "CYPHER.Recovery.RemovesAllModerateReminder";
  }

  if (!recoveries[interval]) {
    updates[`system.recoveries.${interval}`] = true;
  }

  return { updates, woundNoteKey };
}

/**
 * Return the configured Might cost for rallying a wound.
 *
 * @param {string} severity Wound severity.
 * @param {boolean} canRallyMajor Whether major wounds may be rallied.
 * @returns {number|null} Cost, or null when the severity is not rallyable.
 */
export function getRallyCost(severity, canRallyMajor = false) {
  if (severity === "major") {
    return canRallyMajor ? CYPHER.rallyCostMajorSuperhero : null;
  }
  return CYPHER.rallyCost[severity] ?? null;
}

/**
 * Compute the state change for rallying an existing wound.
 *
 * @param {string} severity Wound severity.
 * @param {number} might Current Might Pool.
 * @param {object} wounds Current wounds.
 * @param {boolean} canRallyMajor Whether major wounds may be rallied.
 * @returns {{cost: number, remainingMight: number, remainingWound: number}|null}
 */
export function computeRallyResult(
  severity,
  might,
  wounds,
  canRallyMajor = false
) {
  const cost = getRallyCost(severity, canRallyMajor);
  if (cost === null || might < cost || wounds[severity].current <= 0) {
    return null;
  }

  return {
    cost,
    remainingMight: might - cost,
    remainingWound: wounds[severity].current - 1
  };
}
