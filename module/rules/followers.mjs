/** CRD 2026-07-29, Followers (7977–7984): progression, help and retained improvements. */
const positive = value => Number.isSafeInteger(value) && value > 0;
const natural = value => Number.isSafeInteger(value) && value >= 0;

/** Earn one level per two tiers gained since acquisition; already applied gains never repeat or reverse. */
export function followerProgression(acquiredTier, currentTier, appliedSteps = 0) {
  if (!positive(acquiredTier) || !positive(currentTier) || !natural(appliedSteps)) return null;
  const earned = Math.max(appliedSteps, Math.max(0, Math.floor((currentTier - acquiredTier) / 2)));
  return { earned, pending: earned - appliedSteps };
}

/** Use the explicitly applicable task level, including an inability; task names never infer mechanics. */
export function followerHelpAssets(level, taskLevel = null) {
  if (!positive(level) || taskLevel !== null && !natural(taskLevel)) return null;
  return (taskLevel ?? level) >= 5 ? 2 : 1;
}

/** A replacement retains every tier increase and explicit additional level improvement. */
export function followerReplacementLevel(baseLevel, earnedSteps, extraLevels = 0) {
  if (!positive(baseLevel) || !natural(earnedSteps) || !natural(extraLevels)) return null;
  const level = baseLevel + earnedSteps + extraLevels;
  return Number.isSafeInteger(level) ? level : null;
}
