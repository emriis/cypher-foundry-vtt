/** CRD Builds Allies 3586–3604 and Controls Beasts 3943: source profiles and read-only expiry. */
export const COMPANION_UPGRADES = {
  "automaton-armor-upgrade": { kind: "armor", category: "light", cost: 3, recovery: "hour", action: "npc", paragraph: 3586 },
  "automaton-heavy-armor-upgrade": { kind: "armor", category: "heavy", cost: 6, recovery: "hour", action: "npc", paragraph: 3604 },
  "automaton-cypher-upgrade": { kind: "cypher", cost: 3, durationSeconds: 86400, paragraph: 3587 },
  "automaton-flight-upgrade": { kind: "flight", cost: 0, paragraph: 3595 },
  "automaton-turret-upgrade": { kind: "turret", cost: 0, action: "npc", paragraph: 3596 },
  "automaton-force-field-upgrade": { kind: "field", cost: 0, recovery: "tenMinutes", paragraph: 3601 },
  "beast-eyes": { kind: "senses", cost: 3, recovery: "tenMinutes", action: "pc", paragraph: 3943 }
};

/** A completed recovery invalidates the effect in the same PC update as rest benefits. */
export function companionEffectActive(effect, flags = {}, now = 0) {
  const rule = COMPANION_UPGRADES[effect?.key];
  return Boolean(effect?.version === 1 && effect.state === "active" && rule
    && (!effect.followerId || !effect.npcUuid || flags.followers?.[effect.followerId]?.npcUuid === effect.npcUuid)
    && (rule.durationSeconds === undefined || Number.isFinite(effect.endsAt) && now < effect.endsAt)
    && (!rule.recovery || (flags.companionRecoveries?.[rule.recovery] ?? 0) === (effect.recoveryRevision ?? 0)));
}

/** Preserve ordinary armor; source-linked armor works only in its live transformation. */
export function companionArmorUsable(item, flags = {}, now = 0) {
  const tag = item?.flags?.cypher?.companionEquipment;
  if (!tag || tag.kind !== "armor") return true;
  return Object.values(flags.companionEffects ?? {}).some(effect => companionEffectActive(effect, flags, now)
    && COMPANION_UPGRADES[effect.key].kind === "armor" && effect.followerId === tag.followerId && effect.itemId === item.id);
}

/** Installed flight declares movement limits; no coordinates, anatomy or movement action is invented. */
export function companionFlight({ installed = false, carrying = false, mode = "normal" } = {}) {
  return !installed || ["turret", "pending"].includes(mode) ? { enabled: false, range: "", feet: 0, meters: 0 }
    : carrying ? { enabled: true, range: "", feet: 20, meters: 6 } : { enabled: true, range: "long", feet: 0, meters: 0 };
}

/** Minimum recovery clocks advance monotonically; old worlds start at zero without writes on load. */
export function companionRecoveryUpdates(flags, interval) {
  const updates = {};
  if (!Object.values(flags?.companionEffects ?? {}).some(effect => effect?.version === 1 && ["active", "pending"].includes(effect.state))) return updates;
  if (["tenMinutes", "hour", "tenHours"].includes(interval)) updates["flags.cypher.companionRecoveries.tenMinutes"] = (flags?.companionRecoveries?.tenMinutes ?? 0) + 1;
  if (["hour", "tenHours"].includes(interval)) updates["flags.cypher.companionRecoveries.hour"] = (flags?.companionRecoveries?.hour ?? 0) + 1;
  return updates;
}
