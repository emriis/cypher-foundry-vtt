/**
 * Legacy content migrations.
 *
 * These migrations convert persisted Type and Focus content from the former
 * embedded-ability representation to standalone Ability document references.
 */

/**
 * Migrate world-level Type and Focus items that still contain embedded
 * legacy ability objects.
 *
 * Compendium source data is intentionally excluded. Compendium source
 * migrations belong to the deterministic source-pack build process.
 *
 * @returns {Promise<void>}
 */
export async function migrateWorldTypeAndFocusAbilities() {
  const worldItems = [...(game.items ?? [])];

  for (const item of worldItems) {
    if (!["type", "focus"].includes(item.type)) continue;

    const legacyAbilities = item._source?.system?.abilities;
    if (!Array.isArray(legacyAbilities) || !legacyAbilities.some(
      ability => ability && typeof ability === "object"
    )) {
      continue;
    }

    const references = [];
    const ids = new Map();

    for (const ability of legacyAbilities) {
      if (!ability || typeof ability !== "object") continue;

      const action = inferLegacyAbilityAction(ability);
      const created = await Item.create({
        name: ability.name,
        type: "ability",
        img: ability.img ?? "icons/svg/upgrade.svg",
        system: {
          key: ability.id ?? slugLegacyAbilityName(ability.name),
          tier: Number(ability.tier) || 1,
          enabler: Boolean(ability.enabler),
          repeatable: Boolean(ability.repeatable),
          cost: ability.cost ?? { stat: "none", amount: 0, options: [] },
          action,
          freeWeaponCategories: ability.freeWeaponCategories ?? [],
          freeArmorCategories: ability.freeArmorCategories ?? [],
          freeWeaponFamilies: ability.freeWeaponFamilies ?? [],
          freeWeaponSkillCategories: ability.freeWeaponSkillCategories ?? [],
          chooseWeaponAttackCategory: Boolean(ability.chooseWeaponAttackCategory),
          grantedArmorItemCategory: ability.grantedArmorItemCategory ?? "",
          effects: ability.effects ?? [],
          rollTables: ability.rollTables ?? [],
          description: ability.description ?? ""
        },
        flags: {
          cypher: {
            migratedFrom: item.uuid,
            migratedAbilityId: ability.id ?? null
          }
        }
      });

      references.push(created.uuid);
      if (ability.id) ids.set(ability.id, created.id);
    }

    const update = { "system.abilities": references };

    if (item.type === "focus") {
      update["system.flowchart"] = {
        edges: legacyAbilities.flatMap(ability =>
          (ability.prerequisites ?? []).map(prerequisite => ({
            from: ids.get(prerequisite),
            to: ids.get(ability.id)
          }))
        ).filter(edge => edge.from && edge.to)
      };
    }

    await item.update(update);
  }
}

/**
 * Infer the legacy action metadata from the old ability description.
 *
 * @param {object} ability Legacy ability data.
 * @returns {string|null} Normalized action identifier.
 */
export function inferLegacyAbilityAction(ability) {
  if (ability.enabler) return null;

  const text = String(ability.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .trim();

  if (/\bFirst action\.\s*$/i.test(text)) return "firstAction";
  if (/\bLast action\.\s*$/i.test(text)) return "lastAction";
  if (/\bAction\.\s*$/i.test(text)) return "action";

  return null;
}

/**
 * Create a stable key for a legacy ability that did not have an explicit id.
 *
 * @param {string} name Legacy ability name.
 * @returns {string} Slug suitable for an Ability system key.
 */
export function slugLegacyAbilityName(name = "ability") {
  return name.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
