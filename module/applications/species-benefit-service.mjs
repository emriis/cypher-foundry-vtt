import { SPECIES_BENEFITS } from "../rules/species-benefit-catalogue.mjs";
import { resolveWeaponConfiguration } from "../rules/weapon-mechanics.mjs";
/** Explicit CRD species gift bindings, conditional preparation and legacy refresh on actual owned documents. */
import { benefitRule, speciesSourceRules, ownedBenefitRules, resolveSpeciesTask, speciesWoundReduction } from "../rules/species-benefits.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
const itemsOf = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
export const speciesBenefits = actor => ownedBenefitRules(itemsOf(actor));
const owned = actor => actor?.type === "pc" && actor.isOwner !== false;
const preparations = actor => (actor.flags?.cypher?.benefitPreparations ?? []).filter(entry => entry?.version === 1);

/** Source and slot are stable identities across translations. No localized benefit name selects mechanics. */
export function speciesBenefitBinding(source, index) {
  const rule = speciesSourceRules(source).find(rule => rule.benefitIndex === index);
  return rule ? { version: 1, id: rule.id } : null;
}
export function speciesConditionalTraining(source) { return speciesSourceRules(source).find(rule => rule.kind === "training") ?? null; }

/** Read structured weapon categories; absent facts require the player's explicit condition declaration. */
export function speciesTaskPlan(actor, { selected = [], isAttack = false, defenseType = null, skillItemId = null, weaponSource = {}, attackForm = null } = {}) {
  if (!Array.isArray(selected)) return null;
  const skill = actor.items?.get?.(skillItemId), weapon = actor.items?.get?.(weaponSource?.itemId), conditions = [];
  if (isAttack) {
    const category = weapon?.system.attackSkillCategory, size = weapon ? resolveWeaponConfiguration(weapon.system).attackType : weaponSource.attackType;
    for (const id of selected ?? []) {
      const rule = benefitRule(id);
      if (rule?.kind === "damage" && rule.condition.startsWith("light") && size && size !== "light"
        || rule?.condition === "heavyMelee" && size && size !== "heavy") return null;
    }
    const melee = ["lightBashing", "lightBladed", "mediumBashing", "mediumBladed", "heavyBashing", "heavyBladed", "unarmed"].includes(category) || attackForm === "melee";
    if (melee) conditions.push("melee");
    if (melee && size === "light") conditions.push("lightMelee");
    if (melee && size === "heavy") conditions.push("heavyMelee");
    if (category === "unarmed") conditions.push("unarmed");
    if (["lightBladed", "mediumBladed", "heavyBladed"].includes(category)) conditions.push("bladed");
    if (weapon?.system.weaponFamily === "axes") conditions.push("axes");
  }
  const energy = (actor.flags?.cypher?.benefitChoices ?? []).find(choice => choice.id === "descriptor.species.dragonfolk:1");
  return resolveSpeciesTask(speciesBenefits(actor), { selected, conditions, isAttack, defenseType,
    skillRuleIds: (skill?.flags?.cypher?.conditionalTraining ?? []).map(binding => binding.id), skillSteps: skill?.system.stepModifier ?? 0,
    skillLogicalId: skill?.flags?.cypherFoundry?.crd?.sourceLogicalId ?? skill?.flags?.cypherFoundry?.crd?.logicalId,
    prepared: preparations(actor).filter(entry => entry.state === "ready").map(entry => entry.id), energyChosen: Boolean(energy?.value) });
}

/** Store a choice once; changing an established energy is an explicit GM correction. */
export async function chooseBenefitEnergy(actor, id, value) {
  if (!owned(actor) || benefitRule(id)?.condition !== "chosenEnergy" || !speciesBenefits(actor).some(rule => rule.id === id) || typeof value !== "string" || !value.trim()) return false;
  return Boolean(await runActorActions([actor], "benefitChoice", async () => {
    const choices = actor.flags?.cypher?.benefitChoices ?? [], previous = choices.find(choice => choice.id === id);
    if (previous && previous.value !== value.trim() && !game.user?.isGM) return false;
    await actor.update({ "flags.cypher.benefitChoices": [...choices.filter(choice => choice.id !== id), { id, value: value.trim() }] }); return true;
  }));
}

/** Preparation consumes declared game time, not wall time; completion requires an explicit uninterrupted-work confirmation. */
export async function prepareSpeciesBenefit(actor, id, { scope = "", completed = false, confirmed = false } = {}) {
  const rule = speciesBenefits(actor).find(rule => rule.id === id), now = game.time?.worldTime;
  if (!owned(actor) || !rule?.preparationSeconds || confirmed !== true || !Number.isFinite(now)) return false;
  return Boolean(await runActorActions([actor], "benefitPreparation", async () => {
    const entries = preparations(actor), previous = entries.find(entry => entry.id === id);
    if (completed && (previous?.state !== "preparing" || now < previous.readyAt)) return false;
    if (!completed && (typeof scope !== "string" || !scope.trim())) return false;
    const entry = completed ? { ...previous, state: "ready" } : { version: 1, id, scope: scope.trim(), state: "preparing", readyAt: now + rule.preparationSeconds };
    await actor.update({ "flags.cypher.benefitPreparations": [...entries.filter(entry => entry.id !== id), entry] }); return true;
  }));
}

/** Resolve a recorded legacy ID through reviewed identities; normal pack builds rewrite original authoring IDs. */
async function recordedSpeciesSource(id) {
  const world = game.items?.get(id); if (world?.type === "descriptor") return world;
  const canonical = SPECIES_BENEFITS.rules.find(rule => rule.legacySourceItemId === id)?.sourceId;
  for (const language of ["en", "fr"]) {
    const pack = game.packs?.get(`cypher.descriptors-${language}`); if (!pack) continue;
    const index = await pack.getIndex({ fields: ["flags.cypherFoundry.crd.logicalId", "flags.cypherFoundry.crd.sourceLogicalId"] });
    const entry = index.get(id) ?? (canonical ? index.find(entry => (entry.flags?.cypherFoundry?.crd?.sourceLogicalId ?? entry.flags?.cypherFoundry?.crd?.logicalId) === canonical) : null);
    if (entry) return pack.getDocument(entry._id);
  }
  return null;
}

/** Bind old generated gifts through recorded identity and technical slot. Unknown gifts remain unchanged, never matched by prose. */
export async function refreshSpeciesBenefits(actor, { confirmed = false } = {}) {
  if (!game.user?.isGM || !owned(actor) || confirmed !== true) return false;
  return runActorActions([actor], "benefitRefresh", async () => {
    let updated = 0;
    for (const item of itemsOf(actor)) {
      const origin = item.flags?.cypher?.grantOrigin;
      if (item.type !== "ability" || !["species", "descriptor"].includes(origin?.kind) || item.flags?.cypher?.ruleBenefit) continue;
      const suffix = `${origin.kind}-benefit-${origin.sourceId}-`, key = item.system.key;
      if (typeof key !== "string" || !key.startsWith(suffix) || !/^\d+$/.test(key.slice(suffix.length))) continue;
      const source = await recordedSpeciesSource(origin.sourceId), binding = source && speciesBenefitBinding(source, Number(key.slice(suffix.length)));
      if (!binding) continue;
      await item.update({ "flags.cypher.ruleBenefit": binding }); updated++;
    }
    return updated;
  });
}

/** Recovery-only gifts are separate from rolled point allocation and paid reroll deltas. */
export function speciesRecovery(actor) {
  const rules = speciesBenefits(actor);
  return { bonus: rules.filter(rule => rule.kind === "recovery").reduce((sum, rule) => sum + rule.amount, 0),
    intellect: rules.filter(rule => rule.kind === "poolRecovery" && rule.condition === "intellect").reduce((sum, rule) => sum + rule.amount, 0) };
}
export const speciesDamageReduction = (actor, tags) => speciesWoundReduction(speciesBenefits(actor), tags);

/** Item names are presentation only; the registered definition supplies each explicit condition and preparation requirement. */
export function speciesBenefitDisplay(actor) {
  return speciesBenefits(actor).map(rule => ({ ...rule, conditionLabel: `CYPHER.Benefit.${rule.kind === "poolRecovery" ? "intellectRecovery" : rule.condition}`, preparation: preparations(actor).find(entry => entry.id === rule.id),
    canPrepare: Boolean(rule.preparationSeconds), needsEnergy: rule.condition === "chosenEnergy", value: (actor.flags?.cypher?.benefitChoices ?? []).find(choice => choice.id === rule.id)?.value ?? "" }));
}

/** Resolve the recorded source identity across world and bilingual packs without any name matching. */
export async function appliedSpeciesSource(actor) {
  const id = actor.flags?.cypher?.appliedSpeciesId;
  return id ? recordedSpeciesSource(id) : null;
}

/** A legacy training's independent base cannot be reconstructed. The GM explicitly reviews it; repeat calls never downgrade later training. */
export async function reviewConditionalTraining(actor, skillId, sourceUuid, { confirmed = false, baseLevel, note = "" } = {}) {
  const skill = actor.items?.get(skillId), source = await resolveDocumentReference(sourceUuid, "descriptor"), rule = speciesConditionalTraining(source);
  if (!game.user?.isGM || !owned(actor) || skill?.type !== "skill" || skill.isOwner === false || !rule || confirmed !== true
    || !["inability", "practiced", "trained", "specialized", "expert"].includes(baseLevel) || !note.trim()) return false;
  return Boolean(await runActorActions([actor, skill], "conditionalTrainingReview", async () => {
    const bindings = skill.flags?.cypher?.conditionalTraining ?? [];
    if (bindings.some(binding => binding.id === rule.id)) return true;
    await skill.update({ "system.level": baseLevel, "flags.cypher.conditionalTraining": [...bindings, { version: 1, id: rule.id }],
      "flags.cypher.conditionalTrainingReview": { sourceUuid, ruleId: rule.id, baseLevel, note } }); return true;
  }));
}
