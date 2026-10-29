/** CRD 3579, 3938–3939, 3941, 3946 and 2337: explicit companion support. */
export function companionBonuses({ ready = false, immediate = false, riding = false, calmed = false, family = null,
  alive = ready, stronger = false, betterment = false, mount = false } = {}, { isAttack = false, isDefense = false } = {}) {
  const together = ready && alive && immediate && stronger;
  const mounted = ready && alive && isAttack && riding && family === "mount" && mount && !calmed;
  return { assets: (isDefense && together ? 1 : 0) + (mounted ? 1 : 0),
    damage: isAttack && together ? 2 : 0, recovery: alive && immediate && betterment && !calmed ? 3 : 0, mounted };
}

/** Declared NPC Health damage never converts PC wound severity into numeric damage. */
export function retainerHealthDamage(amount, armor = 0, ignoresArmor = 0) {
  if (![amount, armor, ignoresArmor].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  return Math.max(0, amount - Math.max(0, armor - ignoresArmor));
}
