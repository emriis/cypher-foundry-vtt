/** Synchronous projections for native inventory/vision hooks; never mutate on read or parse prose. */
import { COMPANION_UPGRADES, companionEffectActive, companionArmorUsable, companionFlight } from "../rules/companion-upgrades.mjs";
import { resolveCachedDocumentReference, resolveDocumentReference } from "./reference-resolver.mjs";
const clock = () => globalThis.game?.time?.worldTime ?? 0;
export const companionEffects = actor => Object.values(actor?.flags?.cypher?.companionEffects ?? {}).filter(effect => effect?.version === 1);
export const liveCompanionEffects = actor => companionEffects(actor).filter(effect => companionEffectActive(effect, actor.flags?.cypher, clock()));
export const companionInstallations = actor => Object.values(actor?.flags?.cypher?.companionUpgrades ?? {}).filter(binding => binding?.version === 1);

/** The extra slot expires by game time, without changing saved base capacity or deleting excess cyphers. */
export function effectiveCypherLimit(actor) {
  return (actor?.system?.cypherLimit ?? 0) + (liveCompanionEffects(actor).some(effect => effect.key === "automaton-cypher-upgrade") ? 1 : 0);
}

/** A physical form follows the current follower slot; replacements do not inherit an old active transformation. */
export function automatonMode(npc) {
  const receipt = npc?.flags?.cypher?.followerProgress;
  if (!receipt) return "normal";
  const owner = resolveCachedDocumentReference(receipt.ownerUuid);
  if (owner?.flags?.cypher?.followers?.[receipt.slotId]?.npcUuid !== npc.uuid) return "normal";
  const pending = companionEffects(owner).find(effect => effect.npcUuid === npc.uuid && ["armor", "turret"].includes(COMPANION_UPGRADES[effect.key]?.kind)
    && effect.state === "pending" && companionEffectActive({ ...effect, state: "active" }, owner.flags?.cypher, clock()));
  if (pending) return "pending";
  return liveCompanionEffects(owner).find(effect => effect.npcUuid === npc.uuid && ["armor", "turret"].includes(COMPANION_UPGRADES[effect.key]?.kind))?.key ?? "normal";
}

/** Target-side protection is max-one for identical Focus effects; native recipient links alone grant nothing. */
export function companionFieldReduction(actor) {
  for (const [id, link] of Object.entries(actor?.flags?.cypher?.companionFields ?? {})) {
    const owner = resolveCachedDocumentReference(link.ownerUuid);
    const effect = owner?.flags?.cypher?.companionEffects?.[id];
    if (effect?.key === "automaton-force-field-upgrade" && companionEffectActive(effect, owner.flags?.cypher, clock()) && effect.targets?.includes(actor.uuid)) return 1;
  }
  return 0;
}
export const companionNpcProtection = actor => companionFieldReduction(actor) * 3;

/** A retained suit remains an ordinary repairable Item, but cannot be equipped outside its transformation. */
export function companionEquipmentUsable(item) {
  const tag = item?.flags?.cypher?.companionEquipment;
  if (!tag) return true;
  const owner = tag.ownerUuid === item.actor?.uuid ? item.actor : resolveCachedDocumentReference(tag.ownerUuid);
  if (!owner) return false;
  if (tag.kind === "armor") return tag.ownerUuid === item.actor?.uuid && companionArmorUsable(item, owner.flags?.cypher, clock());
  return tag.kind === "turret" && liveCompanionEffects(owner).some(effect => effect.id === tag.effectId && effect.key === "automaton-turret-upgrade"
    && effect.operators?.includes(item.actor?.uuid));
}

/** Carrying a worn suit is carrying its wearer; the turret's stated immobility overrides flight. */
export function automatonFlight(npc) {
  const receipt = npc?.flags?.cypher?.followerProgress, owner = receipt && resolveCachedDocumentReference(receipt.ownerUuid);
  if (!owner || owner.flags?.cypher?.followers?.[receipt.slotId]?.npcUuid !== npc.uuid) return companionFlight();
  const installed = companionInstallations(owner).some(binding => binding.followerId === receipt.slotId && binding.key === "automaton-flight-upgrade"
    && owner.items?.get?.(binding.itemId)?.system?.key === binding.key);
  const armorWorn = (owner.items?.contents ?? Array.from(owner.items?.values?.() ?? [])).some(item => item.type === "armor" && item.system.equipped
    && item.flags?.cypher?.companionEquipment?.followerId === receipt.slotId && companionEquipmentUsable(item));
  const mode = automatonMode(npc);
  return companionFlight({ installed, mode: mode === "automaton-turret-upgrade" ? "turret" : mode === "pending" ? "pending" : "normal",
    carrying: armorWorn || owner.flags?.cypher?.companionCarrying?.[receipt.slotId] === true });
}

/** Actual source identity for the shared NPC defense engine, never a caller-supplied difficulty discount. */
export async function resolveTurretAttack(npc, source) {
  if (!game.user?.isGM || game.users?.activeGM?.id !== game.user.id || !source) return null;
  const owner = await resolveDocumentReference(source.ownerUuid, "pc");
  const effect = owner && liveCompanionEffects(owner).find(effect => effect.id === source.effectId && effect.key === "automaton-turret-upgrade" && effect.npcUuid === npc.uuid);
  const slot = effect && owner.flags.cypher.followers[effect.followerId];
  return effect && slot?.available && slot.mode === "independent" ? { owner, effect } : null;
}
