import { CYPHER } from "../config.mjs";

/**
 * Build the deterministic data used by a recovery roll.
 *
 * @param {number} tier Character tier.
 * @param {number} bonus Recovery bonus.
 * @param {object} [options={}] Last action adds the CRD's two-point bonus.
 * @returns {{formula: string, data: object}}
 */
export function getRecoveryRollData(tier, bonus, { lastAction = false } = {}) {
  return {
    formula: "1d6 + @tier + @bonus",
    data: { tier, bonus: bonus + (lastAction ? 2 : 0) }
  };
}

/**
 * Compute the wound and recovery-marker updates for a recovery interval.
 *
 * @param {string} interval Recovery interval.
 * @param {object} wounds Current wound tracks.
 * @param {object} recoveries Recovery markers.
 * @param {object} [options={}] Explicit wound choice and validated extra recovery.
 * @returns {{updates: object, woundNoteKey: string|null}}
 */
export function computeRecoveryUpdates(interval, wounds, recoveries = {}, { woundChoice = "moderate", additional = false } = {}) {
  const updates = {};
  let woundNoteKey = null;
  if (!CYPHER.recoveryIntervals.includes(interval) || (recoveries[interval] && !additional)) return { updates, woundNoteKey };

  if (interval === "tenMinutes") {
    updates["system.wounds.minor.current"] = 0;
    woundNoteKey = "CYPHER.Recovery.RemovesAllMinor";
  } else if (interval === "hour") {
    if (woundChoice !== "minor" && wounds.moderate.current > 0) {
      updates["system.wounds.moderate.current"] = wounds.moderate.current - 1;
      woundNoteKey = "CYPHER.Recovery.RemovesOneModerate";
    } else {
      updates["system.wounds.minor.current"] = 0;
      woundNoteKey = "CYPHER.Recovery.RemovesAllMinor";
    }
  } else if (interval === "tenHours") {
    // CRD Healing Wounds > Rest: exchange one moderate removal for all minor
    // wounds. User adjudication also permits this with no moderate wound.
    updates["system.wounds.moderate.current"] = woundChoice === "minor" ? Math.min(1, wounds.moderate.current) : 0;
    if (woundChoice === "minor") updates["system.wounds.minor.current"] = 0;
    woundNoteKey = woundChoice === "minor" ? "CYPHER.Recovery.RemovesMinorAndModerate" : "CYPHER.Recovery.RemovesAllModerate";
  }

  if (interval === "tenHours") {
    // Completion starts a new day; availability is independent of use order.
    for (const key of CYPHER.recoveryIntervals) updates[`system.recoveries.${key}`] = false;
  } else if (!additional) {
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
  if (cost === null || !Number.isFinite(might) || might < cost || !(wounds[severity]?.current > 0)) {
    return null;
  }

  return {
    cost,
    remainingMight: might - cost,
    remainingWound: wounds[severity].current - 1
  };
}
