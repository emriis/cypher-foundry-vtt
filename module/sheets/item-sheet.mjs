import { CYPHER } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * Generic item sheet used by all Cypher item types.
 *
 * Supplies item data, shared configuration, and an enriched description to the
 * Handlebars templates while relying on ItemSheetV2 for common application behavior.
 * Template inputs save to the registered Item data model, and sheet actions
 * handle the item-specific choices that cannot be expressed as ordinary fields.
 * Template inputs save to the registered Item data model, and sheet actions
 * handle the item-specific choices that cannot be expressed as ordinary fields.
 */
export default class CypherItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** Default application configuration for the item sheet. */
  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "item"],
    position: { width: 480, height: 520 },
    window: { resizable: true },
    actions: {
      toggleDescriptorStat: CypherItemSheet.#onToggleDescriptorStat
    },
    form: { submitOnChange: true }
  };

  /** Handlebars template parts rendered by the sheet. */
  static PARTS = {
    header: { template: "systems/cypher/templates/item/parts/header.hbs" },
    body: { template: "systems/cypher/templates/item/parts/body.hbs", scrollable: [""] }
  };

  /**
   * Builds the template context and enriches the item's HTML description.
   * @param {object} options Application context options.
   * @returns {Promise<object>} Template rendering context.
   */
  /**
   * Resolves a standalone ability Item into sheet-ready display data.
   */
  static async _prepareAbilityView(ability, relativeTo) {
    const system = ability.system ?? {};
    const localize = key => game.i18n.localize(key);
    const cost = system.cost ?? {};
    const costOptions = (cost.options ?? []).map(stat =>
      localize(`CYPHER.Stat.${stat}`)
    );
    const costStat = cost.stat === "choice"
      ? localize("CYPHER.Type.AnyPool")
      : localize(`CYPHER.Stat.${cost.stat ?? "none"}`);

    const actionLabels = {
      action: localize("CYPHER.Ability.ActionStandard"),
      firstAction: localize("CYPHER.Ability.ActionFirst"),
      lastAction: localize("CYPHER.Ability.ActionLast")
    };

    return {
      uuid: ability.uuid,
      name: ability.name,
      tier: system.tier,
      tierLabel: game.i18n.format("CYPHER.Type.AbilityTier", {
        tier: system.tier
      }),
      costLabel: cost.amount
        ? game.i18n.format("CYPHER.Type.AbilityCost", {
          amount: cost.amount,
          stat: costStat
        })
        : localize("CYPHER.Type.NoPoolCost"),
      costOptionsLabel: costOptions.length
        ? game.i18n.format("CYPHER.Type.AbilityCostOptions", {
          options: costOptions.join(", ")
        })
        : "",
      enabler: Boolean(system.enabler),
      repeatable: Boolean(system.repeatable),
      actionLabel: system.action ? actionLabels[system.action] : "",
      weaponCategories: (system.freeWeaponCategories ?? []).map(category =>
        localize(`CYPHER.Type.WeaponCategory.${category}`)
      ),
      weaponCategoriesLabel: (system.freeWeaponCategories ?? []).map(category =>
        localize(`CYPHER.Type.WeaponCategory.${category}`)
      ).join(", "),
      armorCategories: (system.freeArmorCategories ?? []).map(category =>
        localize(`CYPHER.Type.ArmorCategory.${category}`)
      ),
      armorCategoriesLabel: (system.freeArmorCategories ?? []).map(category =>
        localize(`CYPHER.Type.ArmorCategory.${category}`)
      ).join(", "),
      weaponFamilies: system.freeWeaponFamilies ?? [],
      weaponFamiliesLabel: (system.freeWeaponFamilies ?? []).join(", "),
      weaponSkills: system.freeWeaponSkillCategories ?? [],
      weaponSkillsLabel: (system.freeWeaponSkillCategories ?? []).join(", "),
      chooseWeaponAttackCategory: Boolean(system.chooseWeaponAttackCategory),
      grantedArmorCategory: system.grantedArmorItemCategory
        ? localize(`CYPHER.Armor.${system.grantedArmorItemCategory}`)
        : "",
      enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        system.description ?? "", { relativeTo }
      )
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.config = CONFIG.CYPHER;
    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description ?? "", { relativeTo: this.item }
    );

    if (this.item.type === "ability") {
      context.abilityView = {
        effects: this.item.system.effects ?? [],
        rollTables: this.item.system.rollTables ?? []
      };
    }

    if (this.item.type === "type") {
      const system = this.item.system;
      const localize = key => game.i18n.localize(key);
      const genreKeys = {
        Fantasy: "CYPHER.Genre.fantasy",
        "Science Fiction": "CYPHER.Genre.sciFi",
        Superheroes: "CYPHER.Genre.superhero"
      };

      const categoryNames = (categories, categoryType, allCategories) => {
        if (categories.length) {
          return categories.map(category =>
            localize(`CYPHER.Type.${categoryType}.${category}`)
          );
        }
        return allCategories
          ? [localize(`CYPHER.Type.All${categoryType}`)]
          : [];
      };

      const abilities = await Promise.all(
        (system.abilities ?? []).map(uuid => fromUuid(uuid))
      );

      context.typeView = {
        genre: genreKeys[system.genre]
          ? localize(genreKeys[system.genre])
          : system.genre,
        subgenre: system.subgenre,
        statOptions: (system.statOptions ?? []).map(stat =>
          localize(`CYPHER.Stat.${stat}`)
        ),
        poolBonuses: CYPHER.stats.map(stat => ({
          label: localize(`CYPHER.Stat.${stat}`),
          value: Number(system.poolBonuses?.[stat]) || 0
        })),
        edgeChoice: Number(system.edgeChoice) || 0,
        woundBonuses: CYPHER.woundSeverities.map(severity => ({
          label: localize(`CYPHER.Wound.${severity}`),
          value: Number(system.woundBonuses?.[severity]) || 0
        })),
        weaponCategories: categoryNames(
          system.freeWeaponCategories ?? [],
          "WeaponCategory",
          system.freeWeapons
        ),
        armorCategories: categoryNames(
          system.freeArmorCategories ?? [],
          "ArmorCategory",
          system.freeArmor
        ),
        weaponFamilies: (system.freeWeaponFamilies ?? []).map(family =>
          localize(`CYPHER.WeaponFamily.${family}`)
        ),
        skillOptions: (system.skillOptions ?? []).filter(skill => skill?.trim()),
        abilities: await Promise.all(abilities.filter(Boolean).map(ability =>
          CypherItemSheet._prepareAbilityView(ability, this.item)
        ))
      };
    }

    if (this.item.type === "focus") {
      const sourceAbilities = this.item.system.abilities?.length
        ? this.item.system.abilities
        : this.item._source?.system?.abilities ?? [];
      const abilities = await Promise.all(sourceAbilities.map(async ability => {
        const cost = ability.cost ?? {};
        const costOptions = (cost.options ?? []).map(stat => game.i18n.localize(`CYPHER.Stat.${stat}`));
        const costStat = cost.stat === "choice"
          ? game.i18n.localize("CYPHER.FocusSheet.AnyPool")
          : game.i18n.localize(`CYPHER.Stat.${cost.stat ?? "none"}`);
        const weaponCategories = (ability.freeWeaponCategories ?? []).map(category =>
          game.i18n.localize(`CYPHER.Type.WeaponCategory.${category}`)
        );
        const armorCategories = (ability.freeArmorCategories ?? []).map(category =>
          game.i18n.localize(`CYPHER.Type.ArmorCategory.${category}`)
        );
        const weaponFamilies = (ability.freeWeaponFamilies ?? []).map(family =>
          game.i18n.localize(`CYPHER.WeaponFamily.${family}`)
        );
        const weaponSkills = (ability.freeWeaponSkillCategories ?? []).map(category =>
          game.i18n.localize(`CYPHER.AttackSkill.${category}`)
        );

        return {
          ...ability,
          tierLabel: game.i18n.format("CYPHER.FocusSheet.AbilityTier", { tier: Number(ability.tier) }),
          costLabel: cost.amount
            ? game.i18n.format("CYPHER.FocusSheet.AbilityCost", { amount: cost.amount, stat: costStat })
            : game.i18n.localize("CYPHER.FocusSheet.NoPoolCost"),
          costOptionsLabel: costOptions.length
            ? game.i18n.format("CYPHER.FocusSheet.AbilityCostOptions", { options: costOptions.join(", ") })
            : "",
          prerequisites: (ability.prerequisites ?? []).map(id =>
            sourceAbilities.find(candidate => candidate.id === id)?.name ?? id
          ),
          weaponCategories,
          weaponCategoriesLabel: weaponCategories.join(", "),
          armorCategories,
          armorCategoriesLabel: armorCategories.join(", "),
          weaponFamilies,
          weaponFamiliesLabel: weaponFamilies.join(", "),
          weaponSkills,
          weaponSkillsLabel: weaponSkills.join(", "),
          chooseWeaponAttackCategory: Boolean(ability.chooseWeaponAttackCategory),
          grantedArmorCategory: ability.grantedArmorItemCategory
            ? game.i18n.localize(`CYPHER.Armor.${ability.grantedArmorItemCategory}`)
            : "",
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            ability.description ?? "", { relativeTo: this.item }
          )
        };
      }));

      const tiers = [...new Set(abilities
        .map(ability => Number(ability.tier))
        .filter(tier => Number.isInteger(tier) && CYPHER.tiers.includes(tier)))].sort((a, b) => a - b);

      context.focusView = {
        tiers: tiers.map(tier => ({
          label: game.i18n.format("CYPHER.FocusSheet.Tier", { tier }),
          abilities: abilities.filter(ability => Number(ability.tier) === tier)
        }))
      };
    }

    if (this.item.type === "focus") {
      const uuids = this.item.system.abilities ?? [];
      const abilityDocuments = (await Promise.all(
        uuids.map(uuid => fromUuid(uuid))
      )).filter(Boolean);

      const abilityByUuid = new Map(
        abilityDocuments.map(ability => [ability.uuid, ability])
      );

      const edges = this.item.system.flowchart?.edges ?? [];
      const prerequisites = new Map();
      for (const edge of edges) {
        const list = prerequisites.get(edge.to) ?? [];
        const ability = abilityByUuid.get(edge.from);
        if (ability) list.push(ability.name);
        prerequisites.set(edge.to, list);
      }

      const abilities = await Promise.all(
        abilityDocuments.map(async ability => ({
          ...(await prepareAbilityView(ability, this.item)),
          prerequisites: prerequisites.get(ability.uuid) ?? [],
          prerequisitesLabel: (prerequisites.get(ability.uuid) ?? []).join(", ")
        }))
      );

      const tiers = [...new Set(
        abilities
          .map(ability => Number(ability.tier))
          .filter(tier => Number.isInteger(tier) && CYPHER.tiers.includes(tier))
      )].sort((a, b) => a - b);

      context.focusView = {
        tiers: tiers.map(tier => ({
          label: game.i18n.format("CYPHER.FocusSheet.Tier", { tier }),
          abilities: abilities.filter(ability => Number(ability.tier) === tier)
        }))
      };
    }

    if (this.item.type === "descriptor") {
      const system = this.item.system;
      context.descriptorView = {
        category: game.i18n.localize(system.category === "species"
          ? "CYPHER.Descriptor.SpeciesCategory"
          : "CYPHER.Descriptor.StandardCategory"),
        genres: (system.genres ?? []).map(genre => game.i18n.localize(`CYPHER.Genre.${genre}`)),
        statOptions: (system.statOptions ?? []).map(stat => game.i18n.localize(`CYPHER.Stat.${stat}`)),
        statAmount: Number(system.statAmount) || 0,
        skillOptions: (system.skillOptions ?? []).filter(skill => skill?.trim()),
        grantedSkills: system.grantedSkills ?? [],
        grantsSecondDescriptor: Boolean(system.grantsSecondDescriptor),
        benefits: await Promise.all((system.benefits ?? []).map(async benefit => ({
          ...benefit,
          enrichedDescription: await foundry.applications.ux.TextEditor.implementation.enrichHTML(
            benefit.description ?? "", { relativeTo: this.item }
          )
        })))
      };
    }

    // The template needs a boolean per checkbox, while the data model stores a compact array
    // of selected stat IDs for CypherActor#applyDescriptor.
    if (this.item.type === "descriptor") {
      const options = this.item.system.statOptions ?? [];
      context.statOptionsSet = {
        might: options.includes("might"),
        speed: options.includes("speed"),
        intellect: options.includes("intellect")
      };
    }

    return context;
  }

  /**
  * Adds or removes a stat from this Descriptor's list of offered choices.
  * Adds or removes a stat from this Descriptor's list of offered choices.
   */
  static async #onToggleDescriptorStat(event, target) {
    const stat = target.dataset.stat;
    const current = this.item.system.statOptions ?? [];
    const next = target.checked
      ? [...new Set([...current, stat])]
      : current.filter(s => s !== stat);

    if (next.length === 0) {
      // At least one stat must remain selectable, so restore the checkbox if this was the last one.
      // At least one stat must remain selectable, so restore the checkbox if this was the last one.
      target.checked = true;
      return;
    }

    await this.item.update({ "system.statOptions": next });
  }
}
