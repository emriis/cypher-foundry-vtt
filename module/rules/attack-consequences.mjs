/** CRD / Rerolling and Special Rolls: reconcile actual, capped NPC Health loss. */

/**
 * Replace only this attack's contribution, preserving intervening unrelated damage.
 * Bands locate Health points actually lost within the nominal damage interval:
 * overkill has no band and therefore can never become a later refund. Increasing
 * damage appends only newly applied points; decreasing clips those contributions.
 * Healing makes this attribution uncertain, so a changed revision rejects a
 * correction. An unchanged result needs no target write and remains valid.
 * @param {object} history Previous resolvedDamage, damageBands and healthRevision.
 * @param {number} damage New post-Armor damage, using the original Armor snapshot.
 * @param {number} health Current NPC Health, not the original snapshot.
 * @param {number} max Current maximum Health.
 * @param {number} revision Current healing/edit revision.
 * @returns {object|null} New Health and contribution, or null for GM reconciliation.
 */
export function planAttackDamage(history, damage, health, max, revision) {
  const valid = value => Number.isSafeInteger(value) && value >= 0;
  if (!history || ![history.resolvedDamage, history.healthRevision, damage, health, max, revision].every(valid)
    || health > max || !Array.isArray(history.damageBands)) return null;
  let end = 0;
  for (const band of history.damageBands) {
    if (!band || !valid(band.from) || !valid(band.to) || band.from < end
      || band.to <= band.from || band.to > history.resolvedDamage) return null;
    end = band.to;
  }
  const old = history.resolvedDamage;
  if (damage !== old && revision !== history.healthRevision) return null;
  let bands = history.damageBands.map(band => ({ ...band }));
  if (damage > old) {
    const loss = Math.min(health, damage - old);
    health -= loss;
    if (loss) bands.push({ from: old, to: old + loss });
  } else if (damage < old) {
    health += bands.reduce((sum, band) => sum + Math.max(0, band.to - Math.max(band.from, damage)), 0);
    bands = bands.filter(band => band.from < damage).map(band => ({ from: band.from, to: Math.min(band.to, damage) }));
    if (health > max) return null;
  }
  return { health, resolvedDamage: damage, damageBands: bands, healthRevision: history.healthRevision };
}
