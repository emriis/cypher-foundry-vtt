/** Numeric species gifts from the supplied CRD; explicit conditions never parse names, descriptions or token geometry. */
import { SPECIES_BENEFITS } from "./species-benefit-catalogue.mjs";
export const benefitRule = id => SPECIES_BENEFITS.rules.find(rule => rule.id === id) ?? null;
export const speciesSourceRules = source => {
  const identity = source?.flags?.cypherFoundry?.crd?.sourceLogicalId ?? source?.flags?.cypherFoundry?.crd?.logicalId;
  return SPECIES_BENEFITS.rules.filter(rule => identity ? rule.sourceId === identity : rule.legacySourceItemId === (source?.id ?? source?._id));
};

/** Owned, source-bound gifts only; duplicate copies of one gift do not invent a second grant. */
export function ownedBenefitRules(items) {
  const seen = new Set(), result = [];
  for (const item of items ?? []) {
    const bindings = item.type === "ability" ? [item.flags?.cypher?.ruleBenefit] : item.type === "skill" ? item.flags?.cypher?.conditionalTraining ?? [] : [];
    for (const binding of bindings) {
      const rule = binding?.version === 1 && benefitRule(binding.id);
      if (!rule || seen.has(rule.id) || (item.type === "skill") !== (rule.kind === "training")) continue;
      seen.add(rule.id); result.push({ ...rule, itemId: item.id, itemUuid: item.uuid, name: item.name });
    }
  }
  return result;
}

/** Selected conditions are attestations about this task, not extra modifiers supplied by a macro. */
export function resolveSpeciesTask(rules, { selected = [], conditions = [], isAttack = false, defenseType = null,
  skillRuleIds = [], skillSteps = 0, skillLogicalId = null, prepared = [], energyChosen = false } = {}) {
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some(id => !rules.some(rule => rule.id === id))) return null;
  const result = { damage: 0, assets: 0, skillSteps, suppressIntrusion: false, applied: [] };
  for (const rule of rules) {
    const declared = selected.includes(rule.id);
    const known = conditions.includes(rule.condition);
    if (rule.kind === "damage" && isAttack && (known || declared)) {
      if (rule.condition === "chosenEnergy" && !energyChosen) return null;
      result.damage += rule.amount; result.applied.push(rule.id);
    } else if (rule.kind === "asset" && declared) {
      if (rule.condition !== "shapedBody" && (isAttack || defenseType)) return null;
      if (rule.preparationSeconds && !prepared.includes(rule.id)) return null;
      result.assets += rule.amount; result.applied.push(rule.id);
    } else if (rule.kind === "training" && declared && skillRuleIds.includes(rule.id)) {
      result.skillSteps = result.skillSteps < 0 ? 1 : Math.min(3, result.skillSteps + 1); result.applied.push(rule.id);
    } else if (rule.kind === "intrusionImmunity") {
      const skillMatch = { stealth: "skill.stealth", athletics: "skill.athletics", recognizingMotive: "skill.recognizing-motive" }[rule.condition];
      if (defenseType === rule.condition || !isAttack && !defenseType && skillMatch && (skillLogicalId === skillMatch || declared)) {
        result.suppressIntrusion = true; result.applied.push(rule.id);
      }
    }
  }
  return result;
}

/** Every applicable species resistance contributes; these are outside Ability non-stacking rules. */
export function speciesWoundReduction(rules, tags = []) {
  const conditions = { falling: ["falling"], fireHeat: ["fire", "heat"], coldIce: ["cold", "ice"] };
  return rules.filter(rule => rule.kind === "woundReduction" && conditions[rule.condition]?.some(tag => tags.includes(tag)))
    .reduce((sum, rule) => sum + rule.amount, 0);
}
