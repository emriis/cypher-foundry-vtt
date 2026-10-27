import { speciesBenefitBinding, speciesConditionalTraining } from "./species-benefit-service.mjs";
import { CYPHER } from "../config.mjs";
import {
  getEligibleFocusAbilities,
  isFocusAbilityEligible
} from "../rules/focus.mjs";
import { resolveDocumentReferences } from "./reference-resolver.mjs";

/**
 * Application service for Type, Focus, and Descriptor content.
 *
 * This module owns Foundry-aware content application. Reusable content is
 * resolved at the application boundary before its mechanics are copied to an
 * actor-owned Item.
 */

/** Read an imported Skill's language-independent CRD identity, if present. */
function skillSourceIdentity(item) {
  const provenance = item.flags?.cypherFoundry?.crd;
  return provenance?.sourceLogicalId ?? provenance?.logicalId ?? null;
}

/**
 * Resolve chosen labels through the two native Skill indices before any writes.
 * Type/Descriptor choices are legacy display strings; the indexed source flags
 * let French and English choices grant the same Skill without parsing prose.
 * Foundry caches these minimal indices; no second runtime identity store exists.
 * Missing packs leave custom name matching available. Index read failures and
 * ambiguous source labels propagate before the Actor gains any benefits.
 * @param {string[]} names Selected or fixed granted Skill labels.
 * @returns {Promise<Map<string,object>>} Lowercase label to canonical indexed Skill.
 */
async function resolveGrantedSkillSources(names) {
  const requested = new Set(names.map(name => name.toLowerCase()));
  const sources = new Map();
  if (!requested.size) return sources;
  const packs = ["cypher.skills-en", "cypher.skills-fr"]
    .map(id => game.packs?.get(id)).filter(Boolean);
  const indices = await Promise.all(packs.map(pack => pack.getIndex({
    fields: ["name", "type", "flags.cypherFoundry.crd"]
  })));
  for (const index of indices) {
    for (const entry of index) {
      const name = entry.name?.toLowerCase();
      const identity = skillSourceIdentity(entry);
      if (entry.type !== "skill" || !identity || !requested.has(name)) continue;
      if (sources.has(name) && skillSourceIdentity(sources.get(name)) !== identity) {
        throw new Error(`Ambiguous CRD Skill label: ${entry.name}`);
      }
      sources.set(name, entry);
    }
  }
  return sources;
}

/** Source identity wins; only Skills without CRD provenance use the name fallback. */
function findGrantedSkill(actor, name, source) {
  const identity = source && skillSourceIdentity(source);
  return (identity && actor.items.find(item => item.type === "skill" && skillSourceIdentity(item) === identity))
    || actor.items.find(item => item.type === "skill" && !skillSourceIdentity(item)
      && item.name.toLowerCase() === name.toLowerCase());
}

/** Preserve canonical provenance when a grant creates a new actor-owned Skill. */
function grantedSkillFlags(source) {
  return source ? { flags: { cypherFoundry: { crd: structuredClone(source.flags.cypherFoundry.crd) } } } : {};
}

/** Persist mechanical origin independently of localized source/benefit names. */
function abilityGrantFlags(kind, sourceId) {
  return { flags: { cypher: { grantOrigin: { kind, sourceId: sourceId ?? null } } } };
}

/** Add only a reviewed numeric rule binding; other gifts retain their complete descriptive source. */
function benefitGrantFlags(kind, source, index) {
  const flags = abilityGrantFlags(kind, source.id ?? source._id);
  const binding = speciesBenefitBinding(source, index);
  if (binding) flags.flags.cypher.ruleBenefit = binding;
  return flags;
}

/**
 * Resolve referenced content abilities for presentation or application use.
 *
 * @param {Array<string|object>} references Ability UUID references.
 * @returns {Promise<object[]>} Resolved standalone Ability documents.
 */
export async function resolveContentAbilities(references = []) {
  return resolveDocumentReferences(references, "ability");
}

/**
 * Return the tier-one abilities available when applying a Focus.
 *
 * @param {Item} focusItem Focus Item being applied.
 * @returns {Promise<object[]>} Resolved tier-one ability data.
 */
export async function getInitialFocusAbilityChoices(focusItem) {
  if (focusItem?.type !== "focus") return [];

  const abilities = await resolveContentAbilities(
    focusItem.system.abilities ?? []
  );
  const focus = {
    abilities: abilities.map(ability => ({
      id: ability.id,
      uuid: ability.uuid,
      name: ability.name,
      ...ability.system
    })),
    flowchart: focusItem.system.flowchart ?? { edges: [] }
  };

  return getEligibleFocusAbilities(focus, [], 1);
}

/**
 * Return the Focus abilities currently available to the character.
 *
 * This keeps Focus graph traversal out of presentation code while leaving
 * dialogs and user input collection in the sheet.
 *
 * @param {Actor} actor PC Actor.
 * @returns {object[]} Eligible Focus ability data.
 */
export function getFocusAbilityChoices(actor) {
  const focus = actor.getFlag("cypher", "appliedFocusGraph");
  if (!focus) return [];

  const selected = actor.getFlag("cypher", "focusAbilityIds") ?? [];
  return getEligibleFocusAbilities(
    focus,
    selected,
    actor.system.tier
  );
}

/**
 * Apply a Type's mechanical benefits to a PC.
 *
 * @param {object} actor PC Actor.
 * @param {object} typeItem Type Item.
 * @param {object} [options={}] Player choices.
 * @returns {Promise<boolean>} Whether the Type was applied.
 */
export async function applyType(actor, typeItem, options = {}) {
  return applyTypeInternal(actor, typeItem, options);
}

async function applyTypeInternal(actor, typeItem, { stat = null, skillName = null } = {}) {
  if (actor.type !== "pc" || typeItem?.type !== "type") return false;
  if (actor.getFlag("cypher", "appliedTypeId")) {
    ui.notifications.warn(game.i18n.localize("CYPHER.Type.AlreadyApplied"));
    return false;
  }

  const abilities = await resolveDocumentReferences(
    typeItem.system.abilities ?? [],
    "ability"
  );
  if (abilities.length !== (typeItem.system.abilities ?? []).length) {
    console.warn("Cypher | A Type or Focus references an unavailable ability.");
    return false;
  }

  const system = typeItem.system;
  const finalSkillName = skillName?.trim() || (system.skillOptions ?? []).find(value => value?.trim());
  const skillSources = await resolveGrantedSkillSources(finalSkillName ? [finalSkillName] : []);
  const poolBonuses = system.poolBonuses ?? {};
  const woundBonuses = system.woundBonuses ?? {};
  const chosenStat = stat && CYPHER.stats.includes(stat) ? stat : "might";
  const updates = {
    "system.type": typeItem.name,
    "system.genre": { Fantasy: "fantasy", "Science Fiction": "sciFi", Superheroes: "superhero" }[system.genre] ?? actor.system.genre,
    "flags.cypher.appliedTypeId": typeItem.id ?? typeItem._id
  };

  for (const statName of CYPHER.stats) {
    const amount = Number(poolBonuses[statName]) || 0;
    if (!amount) continue;
    updates[`system.stats.${statName}.pool.max`] = actor.system.stats[statName].pool.max + amount;
    updates[`system.stats.${statName}.pool.value`] = actor.system.stats[statName].pool.value + amount;
  }
  if (system.edgeChoice) {
    updates[`system.stats.${chosenStat}.edge`] = actor.system.stats[chosenStat].edge + Number(system.edgeChoice);
  }
  for (const severity of CYPHER.woundSeverities) {
    const amount = Number(woundBonuses[severity]) || 0;
    if (amount) updates[`system.wounds.${severity}.max`] = actor.system.wounds[severity].max + amount;
  }
  if (Array.isArray(system.freeWeaponCategories) && system.freeWeaponCategories.length) {
    updates["system.freeWeaponCategories"] = [...new Set([
      ...(actor.system.freeWeaponCategories ?? []),
      ...system.freeWeaponCategories
    ])];
  } else if (system.freeWeapons) {
    updates["system.canFreelyUseAllWeapons"] = true;
  }
  if (Array.isArray(system.freeArmorCategories) && system.freeArmorCategories.length) {
    updates["system.freeArmorCategories"] = [...new Set([
      ...(actor.system.freeArmorCategories ?? []),
      ...system.freeArmorCategories
    ])];
  } else if (system.freeArmor) {
    updates["system.canFreelyUseAllArmor"] = true;
  }
  if (Array.isArray(system.freeWeaponFamilies) && system.freeWeaponFamilies.length) {
    updates["system.freeWeaponFamilies"] = [...new Set([
      ...(actor.system.freeWeaponFamilies ?? []),
      ...system.freeWeaponFamilies
    ])];
  }

  await actor.update(updates);

  let skillNote = "";
  if (finalSkillName) {
    const source = skillSources.get(finalSkillName.toLowerCase());
    const existing = findGrantedSkill(actor, finalSkillName, source);
    if (existing) {
      const order = ["inability", "practiced", "trained", "specialized", "expert"];
      const index = Math.max(0, order.indexOf(existing.system.level));
      const newLevel = order[Math.min(order.length - 1, index + 1)];
      await existing.update({ "system.level": newLevel });
      skillNote = game.i18n.format("CYPHER.Type.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) });
    } else {
      await actor.createEmbeddedDocuments("Item", [{
        name: finalSkillName,
        type: "skill",
        ...grantedSkillFlags(source),
        system: { level: "trained", description: game.i18n.format("CYPHER.Type.GrantedFrom", { name: typeItem.name }) }
      }]);
      skillNote = game.i18n.format("CYPHER.Type.SkillGranted", { name: finalSkillName });
    }
  }

  if (abilities.length) {
    await actor.createEmbeddedDocuments(
      "Item",
      abilities.map(ability => ({
        name: ability.name,
        type: "ability",
        ...abilityGrantFlags("type", typeItem.id ?? typeItem._id),
        system: {
          ...ability.system,
          source: typeItem.name
        }
      }))
    );
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cypher-roll-card"><h3>${game.i18n.format("CYPHER.Type.Applied", { name: typeItem.name })}</h3><p>${skillNote}</p></div>`
  });
  return true;
}

/**
 * Apply a Focus and its required tier-1 abilities to a PC.
 *
 * @param {object} actor PC Actor.
 * @param {object} focusItem Focus Item.
 * @param {string[]} abilityIds Selected tier-1 ability ids.
 * @param {object} [weaponSkillCategories={}] Weapon skill choices by ability id.
 * @returns {Promise<boolean>} Whether the Focus was applied.
 */
export async function applyFocus(
  actor,
  focusItem,
  abilityIds,
  weaponSkillCategories = {}
) {
  if (actor.type !== "pc" || focusItem?.type !== "focus") return false;
  if (actor.getFlag("cypher", "appliedFocusId")) return false;

  const abilities = await resolveDocumentReferences(
    focusItem.system.abilities ?? [],
    "ability"
  );
  if (abilities.length !== (focusItem.system.abilities ?? []).length) {
    ui.notifications.warn(
      "CYPHER.Ability.ReferenceMissing"
    );
    return false;
  }

  const focus = {
    abilities: abilities.map(ability => ({
      id: ability.id ?? ability._id,
      uuid: ability.uuid,
      name: ability.name,
      ...ability.system
    })),
    flowchart: focusItem.system.flowchart ?? { edges: [] }
  };
  const selected = [...new Set(abilityIds ?? [])];
  if (
    selected.length !== 2 ||
    !selected.every(id => isFocusAbilityEligible(focus, [], id, 1))
  ) {
    return false;
  }

  const selectedAbilities = focus.abilities.filter(
    ability => selected.includes(ability.id)
  );
  if (selectedAbilities.some(ability =>
    ability.chooseWeaponAttackCategory
    && !CYPHER.attackSkillCategories.includes(weaponSkillCategories[ability.id])
  )) return false;
  const freeWeaponCategories = selectedAbilities.flatMap(ability => ability.freeWeaponCategories ?? []);
  const freeArmorCategories = selectedAbilities.flatMap(ability => ability.freeArmorCategories ?? []);
  const freeWeaponFamilies = selectedAbilities.flatMap(ability => ability.freeWeaponFamilies ?? []);
  const freeWeaponSkillCategories = [
    ...selectedAbilities.flatMap(ability => ability.freeWeaponSkillCategories ?? []),
    ...Object.values(weaponSkillCategories)
  ];
  await actor.update({
    "system.focus": focusItem.name,
    "system.freeWeaponCategories": [...new Set([
      ...(actor.system.freeWeaponCategories ?? CYPHER.coreFreeWeaponCategories),
      ...freeWeaponCategories
    ])],
    "system.freeArmorCategories": [...new Set([
      ...(actor.system.freeArmorCategories ?? CYPHER.coreFreeArmorCategories),
      ...freeArmorCategories
    ])],
    "system.freeWeaponFamilies": [...new Set([
      ...(actor.system.freeWeaponFamilies ?? []),
      ...freeWeaponFamilies
    ])],
    "system.freeWeaponSkillCategories": [...new Set([
      ...(actor.system.freeWeaponSkillCategories ?? []),
      ...freeWeaponSkillCategories
    ])],
    "flags.cypher.appliedFocusId": focusItem.id ?? focusItem._id,
    "flags.cypher.appliedFocusGraph": focus,
    "flags.cypher.focusAbilityIds": selected
  });
  const selectedItems = selectedAbilities.map(ability => {
    const source = abilities.find(
      item => (item.id ?? item._id) === ability.id
    );
    return {
      name: source.name,
      type: "ability",
      ...abilityGrantFlags("focus", focusItem.id ?? focusItem._id),
      system: {
        ...source.system,
        source: focusItem.name,
        focusAbilityId: ability.id
      }
    };
  });
  const armorItems = selectedAbilities
    .filter(ability => ability.grantedArmorItemCategory)
    .map(ability => focusArmorItemData(focusItem, ability));
  await actor.createEmbeddedDocuments("Item", [...selectedItems, ...armorItems]);
  return true;
}

/** Preserve the public content API; progression owns entitlement consumption. */
export { selectFocusAbility } from "./advancement-service.mjs";

function focusArmorItemData(focus, ability) {
  return {
    name: ability.name,
    type: "armor",
    system: {
      category: ability.grantedArmorItemCategory,
      freelyUsable: true,
      equipped: false,
      blockEaseDamage: 0,
      description: game.i18n.format("CYPHER.FocusSelection.ArmorItemDescription", { name: focus.name })
    }
  };
}

/**
 * Apply a Descriptor or species Descriptor to a PC.
 *
 * @param {object} actor PC Actor.
 * @param {object} descriptorItem Descriptor Item.
 * @param {object} [options={}] Player choices.
 * @returns {Promise<boolean>} Whether the Descriptor was applied.
 */
export async function applyDescriptor(
  actor,
  descriptorItem,
  { stat = null, skillName = null } = {}
) {
  if (actor.type !== "pc" || descriptorItem?.type !== "descriptor") return false;

  const isSpecies = descriptorItem.system.category === "species";
  const descriptorId = descriptorItem.id ?? descriptorItem._id;
  if (isSpecies) {
    const genres = descriptorItem.system.genres ?? [];
    if (!genres.includes(actor.system.genre)) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Descriptor.SpeciesWrongGenre"));
      return false;
    }
    if (actor.getFlag("cypher", "appliedSpeciesId")) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Descriptor.SpeciesAlreadyApplied"));
      return false;
    }
  } else if (actor.getFlag("cypher", "appliedDescriptorId")) {
    if (!actor.system.hasSecondDescriptor || actor.getFlag("cypher", "appliedSecondDescriptorId")) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Descriptor.AlreadyApplied"));
      return false;
    }
  }

  const statOptions = descriptorItem.system.statOptions ?? [];
  const chosenStat = stat && statOptions.includes(stat) ? stat : statOptions[0];
  const finalSkillName = skillName?.trim();
  const grantedSkills = (descriptorItem.system.grantedSkills ?? []).map(name => name.trim()).filter(Boolean);
  const skillSources = await resolveGrantedSkillSources([finalSkillName, ...grantedSkills].filter(Boolean));
  // A player's English choice can be the same Skill as a fixed French grant.
  // Deduplicate by source identity so it still represents one trained benefit.
  const skillNames = [];
  const grantedIdentities = new Set();
  for (const name of [finalSkillName, ...grantedSkills].filter(Boolean)) {
    const source = skillSources.get(name.toLowerCase());
    const identity = source ? `crd:${skillSourceIdentity(source)}` : `custom:${name.toLowerCase()}`;
    if (grantedIdentities.has(identity)) continue;
    grantedIdentities.add(identity);
    skillNames.push(name);
  }
  const amount = descriptorItem.system.statAmount ?? 2;
  const applyingSecondDescriptor = !isSpecies && Boolean(actor.getFlag("cypher", "appliedDescriptorId"));
  const updates = isSpecies
    ? {
        "system.species": descriptorItem.name,
        "system.hasSecondDescriptor": Boolean(descriptorItem.system.grantsSecondDescriptor),
        "flags.cypher.appliedSpeciesId": descriptorId
      }
    : applyingSecondDescriptor
      ? { "system.descriptor2": descriptorItem.name, "flags.cypher.appliedSecondDescriptorId": descriptorId }
      : { "system.descriptor": descriptorItem.name, "flags.cypher.appliedDescriptorId": descriptorId };

  if (chosenStat && amount > 0) {
    updates[`system.stats.${chosenStat}.pool.max`] = actor.system.stats[chosenStat].pool.max + amount;
    updates[`system.stats.${chosenStat}.pool.value`] = actor.system.stats[chosenStat].pool.value + amount;
  }
  await actor.update(updates);

  // Reuse the same source Skill across languages while retaining its chosen name.
  // Training still follows the existing Descriptor advancement rules.
  const conditionalTraining = speciesConditionalTraining(descriptorItem);
  const order = ["inability", "practiced", "trained", "specialized", "expert"];
  const chatNotes = [];

  for (const grantedSkillName of skillNames) {
    const source = skillSources.get(grantedSkillName.toLowerCase());
    const existing = findGrantedSkill(actor, grantedSkillName, source);
    if (existing && conditionalTraining) {
      const previous = existing.flags?.cypher?.conditionalTraining ?? [];
      if (!previous.some(binding => binding.id === conditionalTraining.id)) await existing.update({ "flags.cypher.conditionalTraining": [...previous, { version: 1, id: conditionalTraining.id }] });
      chatNotes.push(game.i18n.format("CYPHER.Benefit.conditionalTrainingGranted", { name: existing.name }));
    } else if (existing) {
      const newLevel = existing.system.level === "inability"
        ? "trained"
        : order[Math.min(order.length - 1, order.indexOf(existing.system.level) + 1)];
      await existing.update({ "system.level": newLevel });
      chatNotes.push(game.i18n.format("CYPHER.Descriptor.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) }));
    } else {
      const [created] = await actor.createEmbeddedDocuments("Item", [{
        name: grantedSkillName,
        type: "skill",
        ...grantedSkillFlags(source),
        ...(conditionalTraining ? { flags: { ...grantedSkillFlags(source).flags, cypher: { conditionalTraining: [{ version: 1, id: conditionalTraining.id }] } } } : {}),
        system: {
          level: conditionalTraining ? "practiced" : "trained",
          description: game.i18n.format("CYPHER.Descriptor.GrantedFrom", { name: descriptorItem.name })
        }
      }]);
      chatNotes.push(game.i18n.format("CYPHER.Descriptor.SkillGranted", { name: created.name }));
    }
  }

  const benefits = descriptorItem.system.benefits ?? [];
  if (benefits.length) {
    await actor.createEmbeddedDocuments("Item", benefits.map((benefit, index) => ({
      name: benefit.name,
      type: "ability",
      // Representation as an Ability must not turn a species/Descriptor benefit
      // into a genre/Type/Focus grant for capacity stacking. Preserve origin in
      // flags rather than reconstructing it from a localized source/name later.
      ...benefitGrantFlags(isSpecies ? "species" : "descriptor", descriptorItem, index),
      system: {
        // Generated benefits need a nonblank Ability key too. Source identity
        // and the authored benefit slot avoid executing a localized label;
        // this technical key is not a CRD catalogue identity or dispatch key.
        key: `${isSpecies ? "species" : "descriptor"}-benefit-${descriptorId ?? "custom"}-${index}`,
        source: descriptorItem.name,
        tier: 1,
        enabler: true,
        cost: { stat: "none", amount: 0, options: [] },
        action: null,
        repeatable: false,
        passiveModifiers: structuredClone(benefit.passiveModifiers ?? []),
        effects: [],
        rollTables: [],
        description: benefit.description
      }
    })));
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cypher-roll-card">
      <h3>${game.i18n.format(isSpecies ? "CYPHER.Descriptor.SpeciesApplied" : "CYPHER.Descriptor.Applied", { name: descriptorItem.name })}</h3>
      ${chosenStat && amount > 0 ? `<p>${game.i18n.format("CYPHER.Descriptor.StatNote", { amount, stat: game.i18n.localize(`CYPHER.Stat.${chosenStat}`) })}</p>` : ""}
      ${chatNotes.map(note => `<p>${note}</p>`).join("")}
    </div>`
  });
  return true;
}
