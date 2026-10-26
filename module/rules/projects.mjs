/** CRD Resource Points / Goals and Activities: deterministic costs, not narrative adjudication. */

/**
 * Quote source-backed activities and explicitly priced GM-defined goals.
 * Training ranks are 0 untrained, 1 trained, 2 specialized and 3 expert.
 * A null result requires another activity or explicit GM adjudication; it is
 * never a guessed cost for a higher-technology object or an unlisted power.
 * @param {object} proposal Kind, level/power classification and applicable training rank.
 * @returns {{cost: number, minimumTraining: number}|null} Resource-point cost and prerequisite.
 */
export function quoteProject(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const { kind, level, power, training = 0 } = proposal;
  if (!Number.isSafeInteger(training) || training < 0 || training > 3) return null;
  let cost, minimumTraining = 0;
  if (["rest", "carouse"].includes(kind)) cost = 0;
  else if (kind === "craftCypher") {
    const rank = { low: 1, medium: 2, advanced: 3 }[power];
    if (!rank) return null;
    cost = rank + 1; minimumTraining = rank;
  } else if (["collaborate", "custom"].includes(kind)) {
    if (!Number.isSafeInteger(proposal.customCost) || proposal.customCost < 1) return null;
    cost = proposal.customCost;
  } else if (kind === "investment") cost = 1;
  else {
    if (!Number.isSafeInteger(level) || level < 1) return null;
    switch (kind) {
      case "craftObject":
        minimumTraining = 1; cost = 1;
        if (level > 4 || proposal.advancedTechnology === true) {
          minimumTraining = 2; cost = proposal.customCost;
          if (!Number.isSafeInteger(cost) || cost < 2) return null;
        }
        break;
      case "repairObject": if (level > 4) return null; minimumTraining = 1; cost = 1; break;
      case "craftArtifact":
        if (level > 5) return null;
        minimumTraining = 2; cost = proposal.customCost ?? 5;
        if (!Number.isSafeInteger(cost) || cost < 5) return null;
        break;
      case "contact": if (![3, 5, 7].includes(level)) return null; cost = (level - 1) / 2; break;
      case "research": if (level > 7) return null; cost = level <= 3 ? 1 : level <= 5 ? 2 : 3; break;
      case "restoreFollower": cost = Math.max(1, Math.ceil(level / 2)); break;
      case "befriend": if (level > 7) return null; cost = 2 * level * (proposal.befriendPenalty === true ? 2 : 1); break;
      default: return null;
    }
  }
  return training >= minimumTraining && Number.isSafeInteger(cost) ? { cost, minimumTraining } : null;
}
