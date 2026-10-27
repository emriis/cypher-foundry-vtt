import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { prepareSpeciesBenefit, speciesTaskPlan, chooseBenefitEnergy, speciesRecovery, reviewConditionalTraining } from "../../module/applications/species-benefit-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor, documents;
function gift(id) { const item = { id, uuid: `Actor.pc.Item.${id}`, type: "ability", name: "Translated gift", flags: { cypher: { ruleBenefit: { version: 1, id } } } }; actor.items.set(id, item); return item; }
beforeEach(() => {
  actor = { type: "pc", uuid: "Actor.pc", flags: {}, items: new Map(), async update(changes) { applyDocumentUpdate(this, changes); } };
  globalThis.game = { user: { isGM: true }, time: { worldTime: 0 } }; documents = new Map(); globalThis.fromUuid = async uuid => documents.get(uuid);
});

test("ten-minute preparation requires elapsed game time and explicit confirmation, including after reload", async () => {
  const id = "descriptor.species.prota:1"; gift(id);
  assert.equal(await prepareSpeciesBenefit(actor, id, { scope: "This wall" }), false); assert.deepEqual(actor.flags, {});
  assert.equal(await prepareSpeciesBenefit(actor, id, { scope: "This wall", confirmed: true }), true);
  assert.equal(await prepareSpeciesBenefit(actor, id, { completed: true, confirmed: true }), false);
  actor.flags = structuredClone(actor.flags); game.time.worldTime = 600;
  assert.equal(speciesTaskPlan(actor, { selected: [id] }), null);
  assert.equal(await prepareSpeciesBenefit(actor, id, { completed: true, confirmed: true }), true);
  assert.equal(speciesTaskPlan(actor, { selected: [id] }).assets, 1);
});

test("a chosen energy is required and an established choice can only be changed by the GM", async () => {
  const id = "descriptor.species.dragonfolk:1"; gift(id); game.user.isGM = false;
  assert.equal(speciesTaskPlan(actor, { selected: [id], isAttack: true }), null);
  assert.equal(await chooseBenefitEnergy(actor, id, "Acid"), true);
  assert.equal(await chooseBenefitEnergy(actor, id, "Cold"), false);
  assert.equal(speciesTaskPlan(actor, { selected: [id], isAttack: true }).damage, 1);
});

test("a light-weapon gift cannot be declared against a known heavy weapon or alternate configuration", () => {
  const id = "descriptor.species.gnome:1"; gift(id);
  actor.items.set("weapon", { type: "attack", system: { attackType: "light", mechanics: { activeConfiguration: "alternate", alternateConfiguration: { enabled: true, attackType: "heavy" } } } });
  assert.equal(speciesTaskPlan(actor, { selected: [id], isAttack: true, weaponSource: { itemId: "weapon", attackType: "light" } }), null);
});

test("recovery grants distinguish the rolled bonus and the fixed extra Intellect point", () => {
  gift("descriptor.species.dwarf:0"); gift("descriptor.species.d-nec:0");
  assert.deepEqual(speciesRecovery(actor), { bonus: 1, intellect: 1 });
});

test("reviewing legacy conditional training is explicit and does not reset later independent advancement", async () => {
  const skill = { id: "skill", type: "skill", flags: {}, system: { level: "trained" }, async update(changes) { applyDocumentUpdate(this, changes); } };
  actor.items.set(skill.id, skill);
  const source = { type: "descriptor", id: "SpcFntElf0000001", uuid: "Item.elf" }; documents.set(source.uuid, source);
  assert.equal(await reviewConditionalTraining(actor, skill.id, source.uuid, { baseLevel: "practiced", note: "Species only" }), false);
  assert.equal(await reviewConditionalTraining(actor, skill.id, source.uuid, { confirmed: true, baseLevel: "practiced", note: "Species only" }), true);
  skill.system.level = "trained";
  assert.equal(await reviewConditionalTraining(actor, skill.id, source.uuid, { confirmed: true, baseLevel: "practiced", note: "Repeated request" }), true);
  assert.equal(skill.system.level, "trained");
});
