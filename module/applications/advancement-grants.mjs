/** Read-only source resolution and embedded Item plans for progression grants. */
import { CYPHER } from "../config.mjs";
import { GENRE_ABILITIES } from "../rules/genre-ability-catalogue.mjs";
import { isFocusAbilityEligible } from "../rules/focus.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";

/** Canonical identities survive language changes; display names are never deduplication keys. */
export function advancementAbilityIdentity(item) {
  const crd = item?.flags?.cypherFoundry?.crd;
  return crd?.sourceLogicalId ?? crd?.logicalId ?? null;
}
const genreSourceKey = genre => genre === "sciFi" ? "science-fiction" : genre;
const inventory = actor => actor.items?.contents ?? (Array.isArray(actor.items) ? actor.items : [...(actor.items?.values?.() ?? [])]);

/** List only source-backed Genre choices, preferring the user's content language. */
export async function getGenreAbilityChoices(actor, tier = actor.system.tier, genre = actor.system.genre) {
  const candidates = new Map();
  const languages = game.i18n.lang === "fr" ? ["fr", "en"] : ["en", "fr"];
  for (const language of languages) {
    const pack = game.packs?.get(`cypher.abilities-${language}`);
    if (!pack) continue;
    const index = await pack.getIndex({ fields: ["name", "type", "system.tier", "system.repeatable", "flags.cypherFoundry.crd"] });
    for (const item of index) {
      const id = advancementAbilityIdentity(item);
      const record = GENRE_ABILITIES.find(record => record.id === id && record.genres.includes(genreSourceKey(genre)) && record.tier <= Math.min(tier, 6));
      if (!record || item.type !== "ability" || candidates.has(id)) continue;
      if (!item.system?.repeatable && inventory(actor).some(owned => owned.type === "ability" && advancementAbilityIdentity(owned) === id)) continue;
      candidates.set(id, { id, name: item.name, uuid: item.uuid ?? `Compendium.${pack.collection}.Item.${item._id}` });
    }
  }
  return [...candidates.values()];
}

/** Compose permissions and Item data after all source choices have been validated. */
function grantPlan(actor, source, kind, sourceId, weaponSkillCategory, focusAbilityId = null) {
  const system = source.system.toObject?.() ?? structuredClone(source.system);
  if (system.chooseWeaponAttackCategory && !CYPHER.attackSkillCategories.includes(weaponSkillCategory)) return null;
  const updates = {};
  for (const [field, defaults] of [["freeWeaponCategories", CYPHER.coreFreeWeaponCategories], ["freeArmorCategories", CYPHER.coreFreeArmorCategories],
    ["freeWeaponFamilies", []], ["freeWeaponSkillCategories", []]]) {
    const grants = [...(system[field] ?? []), ...(field === "freeWeaponSkillCategories" && system.chooseWeaponAttackCategory ? [weaponSkillCategory] : [])];
    if (grants.length) updates[`system.${field}`] = [...new Set([...(actor.system[field] ?? defaults), ...grants])];
  }
  const flags = { ...(source.flags?.cypherFoundry ? { cypherFoundry: structuredClone(source.flags.cypherFoundry) } : {}),
    cypher: { grantOrigin: { kind, sourceId } } };
  const items = [{ name: source.name, type: "ability", img: source.img, flags,
    system: { ...system, ...(focusAbilityId ? { focusAbilityId } : {}) } }];
  if (system.grantedArmorItemCategory) items.push({ name: source.name, type: "armor", system: {
    category: system.grantedArmorItemCategory, freelyUsable: true, equipped: false, blockEaseDamage: 0,
    description: game.i18n.format("CYPHER.FocusSelection.ArmorItemDescription", { name: actor.system.focus })
  } });
  return { updates, items };
}

/** Recheck the actual graph and source before charging a paid pick or consuming a free one. */
export async function prepareAdvancementGrant(actor, kind, options = {}, tier = actor.system.tier) {
  if (kind === "focus") {
    const focus = actor.getFlag("cypher", "appliedFocusGraph");
    const selected = actor.getFlag("cypher", "focusAbilityIds") ?? [];
    if (!isFocusAbilityEligible(focus, selected, options.abilityId, Math.min(tier, 6))) return null;
    const entry = focus.abilities.find(ability => ability.id === options.abilityId);
    const source = await resolveDocumentReference(entry.uuid, "ability");
    if (!source || source.system.tier > Math.min(tier, 6)) return null;
    const plan = grantPlan(actor, source, "focus", actor.getFlag("cypher", "appliedFocusId") ?? null, options.weaponSkillCategory, entry.id);
    if (plan) plan.updates["flags.cypher.focusAbilityIds"] = [...selected, entry.id];
    return plan;
  }
  if (kind !== "genre") return null;
  const source = await resolveDocumentReference(options.abilityUuid, "ability");
  const id = advancementAbilityIdentity(source);
  const genre = actor.system.genre === "custom" ? options.genre : actor.system.genre;
  if (!source || !GENRE_ABILITIES.some(record => record.id === id && record.genres.includes(genreSourceKey(genre)) && record.tier <= Math.min(tier, 6))
    || source.system.tier > Math.min(tier, 6)) return null;
  if (!source.system.repeatable && inventory(actor).some(item => item.type === "ability" && advancementAbilityIdentity(item) === id)) return null;
  return grantPlan(actor, source, "genre", id, options.weaponSkillCategory);
}
