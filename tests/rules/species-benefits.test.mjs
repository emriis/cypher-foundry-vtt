import assert from "node:assert/strict";
import test from "node:test";
import { benefitRule, ownedBenefitRules, resolveSpeciesTask, speciesWoundReduction } from "../../module/rules/species-benefits.mjs";
const rules = (...ids) => ids.map(id => benefitRule(`descriptor.species.${id}`));

test("different species damage bonuses both apply, while one declaration never duplicates an automatic bonus", () => {
  const source = rules("cyborg:1", "drakain:1");
  assert.equal(resolveSpeciesTask(source, { isAttack: true, conditions: ["melee", "bladed"], selected: [source[0].id] }).damage, 2);
});

test("source identity survives localized names and a duplicate copy does not mint another gift", () => {
  const item = { type: "ability", name: "Nom traduit", flags: { cypher: { ruleBenefit: { version: 1, id: "descriptor.species.dwarf:0" } } } };
  assert.equal(ownedBenefitRules([item, structuredClone(item)]).length, 1);
  assert.deepEqual(ownedBenefitRules([{ ...item, flags: {} }]), []);
  assert.equal(resolveSpeciesTask(rules("dwarf:1"), { selected: ["invented"] }), null);
});

test("conditional skill training leaves its independent level intact outside the confirmed condition", () => {
  const source = rules("elf:training"), id = source[0].id;
  assert.equal(resolveSpeciesTask(source, { skillSteps: 0, skillRuleIds: [id] }).skillSteps, 0);
  assert.equal(resolveSpeciesTask(source, { skillSteps: 0, skillRuleIds: [id], selected: [id] }).skillSteps, 1);
  assert.equal(resolveSpeciesTask(source, { skillSteps: 1, skillRuleIds: [id], selected: [id] }).skillSteps, 2);
  assert.equal(resolveSpeciesTask(source, { skillSteps: 3, skillRuleIds: [id], selected: [id] }).skillSteps, 3);
});

test("intrusion immunity matches the actual defense or the canonical task, not the displayed skill name", () => {
  assert.equal(resolveSpeciesTask(rules("aarak:2"), { defenseType: "dodge" }).suppressIntrusion, true);
  assert.equal(resolveSpeciesTask(rules("aarak:2"), { defenseType: "block" }).suppressIntrusion, false);
  assert.equal(resolveSpeciesTask(rules("rigellian:0"), { skillLogicalId: "skill.athletics" }).suppressIntrusion, true);
});

test("prepared assets require the completed preparation and pheromones cannot ease an attack", () => {
  const source = rules("delph:0", "delph:1"), id = source[1].id;
  assert.equal(resolveSpeciesTask(source, { selected: [id] }), null);
  assert.equal(resolveSpeciesTask(source, { selected: [id], prepared: [id] }).assets, 1);
  assert.equal(resolveSpeciesTask(source, { selected: [source[0].id], isAttack: true }), null);
  assert.equal(resolveSpeciesTask(rules("dragonfolk:1"), { selected: ["descriptor.species.dragonfolk:1"], isAttack: true }), null);
});

test("one declared fire/heat source triggers its resistance once and never supplies shield capacity", () => {
  assert.equal(speciesWoundReduction(rules("hellborn:0", "zantari:0"), ["fire", "heat"]), 1);
  assert.equal(speciesWoundReduction(rules("aarak:1"), ["falling"]), 1);
  assert.equal(speciesWoundReduction(rules("zantari:0"), []), 0);
});
