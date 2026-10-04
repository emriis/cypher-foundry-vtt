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
    return false;
  }

  const system = typeItem.system;
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

  const finalSkillName = skillName?.trim() || (system.skillOptions ?? []).find(value => value?.trim());
  let skillNote = "";
  if (finalSkillName) {
    const existing = actor.items.find(item => item.type === "skill" && item.name.toLowerCase() === finalSkillName.toLowerCase());
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

export async function applyFocus(actor, focusItem, abilityIds, weaponSkillCategories = {}) {
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

export async function selectFocusAbility(actor, abilityId, weaponSkillCategory = null) {
  if (actor.type !== "pc") return false;
  const focus = actor.getFlag("cypher", "appliedFocusGraph");
  const selected = actor.getFlag("cypher", "focusAbilityIds") ?? [];
  if (!isFocusAbilityEligible(focus, selected, abilityId, actor.system.tier)) return false;

  const ability = focus.abilities.find(candidate => candidate.id === abilityId);
  if (ability.chooseWeaponAttackCategory && !CYPHER.attackSkillCategories.includes(weaponSkillCategory)) return false;
  const updates = {
    "flags.cypher.focusAbilityIds": [...selected, abilityId],
    "flags.cypher.focusAbilityPendingTier": null
  };
  const freeWeaponCategories = ability.freeWeaponCategories ?? [];
  const freeArmorCategories = ability.freeArmorCategories ?? [];
  const freeWeaponFamilies = ability.freeWeaponFamilies ?? [];
  const freeWeaponSkillCategories = [
    ...(ability.freeWeaponSkillCategories ?? []),
    ...(weaponSkillCategory ? [weaponSkillCategory] : [])
  ];
  if (freeWeaponCategories.length) {
    updates["system.freeWeaponCategories"] = [...new Set([
      ...(actor.system.freeWeaponCategories ?? CYPHER.coreFreeWeaponCategories),
      ...freeWeaponCategories
    ])];
  }
  if (freeArmorCategories.length) {
    updates["system.freeArmorCategories"] = [...new Set([
      ...(actor.system.freeArmorCategories ?? CYPHER.coreFreeArmorCategories),
      ...freeArmorCategories
    ])];
  }
  if (freeWeaponFamilies.length) {
    updates["system.freeWeaponFamilies"] = [...new Set([
      ...(actor.system.freeWeaponFamilies ?? []),
      ...freeWeaponFamilies
    ])];
  }
  if (freeWeaponSkillCategories.length) {
    updates["system.freeWeaponSkillCategories"] = [...new Set([
      ...(actor.system.freeWeaponSkillCategories ?? []),
      ...freeWeaponSkillCategories
    ])];
  }
  await actor.update({
    ...updates
  });
  const source = await resolveDocumentReferences([ability.uuid], "ability");
  if (source.length !== 1) return false;

  const items = [{
    name: source[0].name,
    type: "ability",
    system: {
      ...source[0].system,
      source: actor.system.focus,
      focusAbilityId: ability.id
    }
  }];
  if (ability.grantedArmorItemCategory) {
    items.push(
      focusArmorItemData({ name: actor.system.focus }, ability)
    );
  }
  await actor.createEmbeddedDocuments("Item", items);
  return true;
}

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

  // Advance an existing skill of the same name, or create a new trained skill, using the
  // same progression logic as purchaseAdvancementSlot's "skill" advancement.
  const order = ["inability", "practiced", "trained", "specialized", "expert"];
  const grantedSkills = (descriptorItem.system.grantedSkills ?? []).map(name => name.trim()).filter(Boolean);
  const skillNames = [...new Set([finalSkillName, ...grantedSkills].filter(Boolean))];
  const chatNotes = [];

  for (const grantedSkillName of skillNames) {
    const existing = actor.items.find(item => item.type === "skill" && item.name.toLowerCase() === grantedSkillName.toLowerCase());
    if (existing) {
      const newLevel = existing.system.level === "inability"
        ? "trained"
        : order[Math.min(order.length - 1, order.indexOf(existing.system.level) + 1)];
      await existing.update({ "system.level": newLevel });
      chatNotes.push(game.i18n.format("CYPHER.Descriptor.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) }));
    } else {
      const [created] = await actor.createEmbeddedDocuments("Item", [{
        name: grantedSkillName,
        type: "skill",
        system: {
          level: "trained",
          description: game.i18n.format("CYPHER.Descriptor.GrantedFrom", { name: descriptorItem.name })
        }
      }]);
      chatNotes.push(game.i18n.format("CYPHER.Descriptor.SkillGranted", { name: created.name }));
    }
  }

  const benefits = descriptorItem.system.benefits ?? [];
  if (benefits.length) {
    await actor.createEmbeddedDocuments("Item", benefits.map(benefit => ({
      name: benefit.name,
      type: "ability",
      system: {
        source: descriptorItem.name,
        tier: 1,
        enabler: true,
        cost: { stat: "none", amount: 0, options: [] },
        action: null,
        repeatable: false,
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

export { getEligibleFocusAbilities };