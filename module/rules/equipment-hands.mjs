/** CRD Weapons 5267–5269; explicit weapon notes 5401, 5405, 5589, 5761, 5814. */
import { resolveWeaponConfiguration } from "./weapon-mechanics.mjs";

/** Minimum declared grip; zero remains an explicit option for attacks requiring no hands. */
export function minimumWeaponHands(system) {
  if (system.mechanics?.hinderedWhenUsedOneHanded) return 1;
  return system.mechanics?.twoHanded || resolveWeaponConfiguration(system).attackType === "heavy" ? 2 : 0;
}

/** Validate integer hand units and the sum of simultaneous held objects. */
export function handsFit(capacity, holds) {
  return Number.isSafeInteger(capacity) && capacity >= 0 && holds.every(hands => Number.isSafeInteger(hands) && hands >= 0)
    && holds.reduce((sum, hands) => sum + hands, 0) <= capacity;
}
