import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { canActivateCypher, canAcquireCyphers, validateCypherCreation, validateCypherUpdates, discardCyphers,
  setCypherStash, transferCypher, reconcileCypherTransfer, runCypherActivation, validateCypherDeletion } from "../../module/applications/cypher-inventory-service.mjs";
import { acquiredCypherData, acquireCypher, drawCypher, reconcileCypherAward } from "../../module/applications/cypher-generation-service.mjs";
import { createRoundFlow } from "../../module/rules/round-flow.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor, documents, next;
function pc(id) {
  return { id, uuid: `Actor.${id}`, type: "pc", isOwner: true, system: { cypherLimit: 2 }, flags: {}, items: new Map(),
    async update(changes) { applyDocumentUpdate(this, changes); },
    async updateEmbeddedDocuments(_type, changes) { for (const change of changes) await this.items.get(change._id).update(change); },
    async createEmbeddedDocuments(_type, entries) { return entries.map(entry => cypher(this, entry)); } };
}
function cypher(owner = actor, data = {}) {
  const id = String(++next), item = { ...data, id, uuid: `${owner.uuid}.Item.${id}`, type: "cypher", actor: owner,
    name: data.name ?? "Cypher", flags: structuredClone(data.flags ?? {}), system: { cypherType: "manifest", depleted: false, ...data.system },
    async update(changes) { applyDocumentUpdate(this, changes); },
    toObject() { return structuredClone({ name: this.name, type: this.type, system: this.system, flags: this.flags }); } };
  owner.items.set(id, item); return item;
}
function combat(owner = actor) {
  const flow = createRoundFlow(["pc"], [], 1); flow.cursor = 0;
  game.combat = { id: "combat", round: 1, started: true, flags: { cypher: { roundFlow: flow } }, combatants: new Map([["pc", { id: "pc", actor: owner }]]) };
}
beforeEach(() => {
  next = 0; actor = pc("pc"); documents = new Map();
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, i18n: { localize: key => key, format: key => key } };
  globalThis.foundry = { utils: { escapeHTML: text => text } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.fromUuid = async uuid => documents.get(uuid);
});

test("one final batch capacity check rejects two arrivals into one free slot, including reactivation", () => {
  cypher();
  const arriving = [1, 2].map(() => ({ type: "cypher", actor, system: { cypherType: "manifest" } }));
  assert.equal(validateCypherCreation(arriving), false);
  assert.equal(validateCypherCreation(arriving.slice(0, 1)), true);
  const spent = cypher(actor, { system: { depleted: true } }); cypher();
  assert.equal(validateCypherUpdates([spent], [{ _id: spent.id, "system.depleted": false }]), false);
  assert.equal(canAcquireCyphers(actor), false);
});

test("stash frees only a physical cypher slot and retrieval checks current capacity", async () => {
  const item = cypher(), subtle = cypher(actor, { system: { cypherType: "subtle" } });
  assert.equal(await setCypherStash(subtle, { stashed: true, location: "camp", confirmed: true }), false);
  assert.equal(await setCypherStash(item, { stashed: true, location: "camp" }), false);
  assert.equal(await setCypherStash(item, { stashed: true, location: "camp", confirmed: true }), true);
  assert.equal(canActivateCypher(item), false); cypher();
  assert.equal(await setCypherStash(item, { stashed: false, confirmed: true }), false);
  subtle.system.depleted = true;
  assert.equal(await setCypherStash(item, { stashed: false, confirmed: true }), true);
});

test("subtle activation is instant outside the turn; manifest and a multi-discard consume one action", async () => {
  const physical = cypher(), subtle = cypher(actor, { system: { cypherType: "subtle" } }); combat();
  assert.equal(await runCypherActivation(subtle, async () => true), true);
  assert.equal(actor.flags.cypher?.roundActionUsage, undefined);
  assert.equal(await discardCyphers(actor, [physical.id, subtle.id]), false);
  assert.equal(await discardCyphers(actor, [physical.id, subtle.id], { confirmed: true }), true);
  assert.equal(actor.flags.cypher.roundActionUsage.primary, true);
  assert.equal(physical.system.depleted, false); assert.equal(physical.flags.cypher.custody, "discarded");
  const other = cypher(); assert.equal(await runCypherActivation(other, async () => true), false);
  assert.equal(await validateCypherDeletion([other]), false);
  game.combat.flags.cypher.roundFlow.cursor = 999;
  const instant = cypher(actor, { system: { cypherType: "subtle" } });
  assert.equal(await runCypherActivation(instant, async () => true), true);
});

test("invalid activation and a detached Item spend no action", async () => {
  const item = cypher(); combat();
  assert.equal(await runCypherActivation(item, async () => assert.fail(), () => false), false);
  actor.items.delete(item.id); assert.equal(canActivateCypher(item), false);
  assert.equal(actor.flags.cypher?.roundActionUsage, undefined);
});

test("transfer keeps actual synthetic ownership, capacity and a durable uncertain checkpoint", async () => {
  const target = pc("synthetic"); target.uuid = "Scene.s.Token.t.Actor.pc";
  const item = cypher(); target.createEmbeddedDocuments = async () => { throw Error("uncertain copy"); };
  await assert.rejects(transferCypher(item, target, { confirmed: true }), /uncertain copy/);
  assert.equal(item.flags.cypher.custody, "transferring"); assert.equal(canActivateCypher(item), false);
  assert.equal(await transferCypher(item, target, { confirmed: true }), false);
  actor.flags = structuredClone(actor.flags); item.flags = structuredClone(item.flags);
  assert.equal(await reconcileCypherTransfer(item, { transferred: false, note: "No destination copy exists" }), true);
  target.createEmbeddedDocuments = pc("target").createEmbeddedDocuments;
  assert.equal(await transferCypher(item, target, { confirmed: true }), true);
  assert.equal(item.flags.cypher.custody, "transferred"); assert.equal(target.items.size, 1);
});

function source() {
  const item = cypher(pc("source"), { system: { powerLevels: ["medium", "advanced"], variants: [
    { name: "Bondisseur", powerLevel: "medium" }, { name: "Voyageur", powerLevel: "advanced" }] } });
  documents.set(item.uuid, item); return item;
}
test("generated Teleporter fixes its localized structured variant without mutating the source", () => {
  const template = source(), before = template.toObject();
  const data = acquiredCypherData(template, { power: "medium" });
  assert.equal(data.name, "Cypher (Bondisseur)"); assert.deepEqual(data.system.variants, []);
  assert.deepEqual(data.system.powerLevels, ["medium"]); assert.deepEqual(template.toObject(), before);
  assert.equal(acquiredCypherData(template, { power: "ultra" }), null);
});

test("awards reject cancellation/full inventories and are idempotent across reload and uncertain creation", async () => {
  const template = source();
  assert.equal(await acquireCypher(actor, template.uuid, { requestId: "award", power: "medium" }), false);
  assert.equal(await acquireCypher(actor, template.uuid, { requestId: "award", power: "medium", confirmed: true }), true);
  actor.flags = structuredClone(actor.flags);
  assert.equal(await acquireCypher(actor, template.uuid, { requestId: "award", power: "medium", confirmed: true }), true);
  assert.equal(await acquireCypher(actor, template.uuid, { requestId: "award", power: "advanced", confirmed: true }), false);
  assert.equal(actor.items.size, 1);
  actor.createEmbeddedDocuments = async () => { throw Error("uncertain award"); };
  await assert.rejects(acquireCypher(actor, template.uuid, { requestId: "other", power: "medium", confirmed: true }), /uncertain award/);
  assert.equal(await acquireCypher(actor, template.uuid, { requestId: "other", power: "medium", confirmed: true }), false);
  assert.equal(await reconcileCypherAward(actor, "other", { confirmed: true, note: "GM inspected inventory" }), true);
  game.user.isGM = false; assert.equal(await acquireCypher(actor, template.uuid, { requestId: "player", confirmed: true }), false);
});

test("generation follows power tables and superhero redirection using stable source identities", async () => {
  const { CYPHER_GENERATION } = await import("../../module/rules/cypher-generation-catalogue.mjs");
  const medium = CYPHER_GENERATION.tables.medium.find(entry => entry.variantName === "Bounder");
  const entries = [medium.logicalId, CYPHER_GENERATION.tables.subtle[0].logicalId].map((logicalId, index) => ({ _id: String(index), type: "cypher", name: "Translated", flags: { cypherFoundry: { crd: { sourceLogicalId: logicalId } } } }));
  game.packs = new Map([["cypher.equipment-fr", { collection: "cypher.equipment-fr", getIndex: async () => entries }]]);
  let dice = [46, medium.min]; globalThis.Roll = class { async evaluate() { return { total: dice.shift() }; } };
  const offer = await drawCypher("manifest", { language: "fr" });
  assert.equal(offer.power, "medium"); assert.equal(offer.logicalId, medium.logicalId); assert.equal(dice.length, 0);
  dice = [37, 1]; assert.equal(await drawCypher("superhero", { language: "fr" }), null); assert.equal(dice.length, 2);
  assert.equal((await drawCypher("superhero", { language: "fr", superheroConfirmed: true })).logicalId, entries[1].flags.cypherFoundry.crd.sourceLogicalId);
});

test("native multi-delete spends one action and rejected ownership never consumes it", async () => {
  const first = cypher(), second = cypher(); combat();
  second.isOwner = false;
  assert.equal(await validateCypherDeletion([first, second]), false);
  assert.equal(actor.flags.cypher?.roundActionUsage, undefined);
  second.isOwner = true; assert.equal(await validateCypherDeletion([first, second]), true);
  assert.equal(actor.flags.cypher.roundActionUsage.primary, true);
  assert.equal(await validateCypherDeletion([first]), false);
});

test("full capacity and a non-elected GM reject awards before receipts or copies; chat failure cannot copy twice", async () => {
  const template = source(), options = { requestId: "once", power: "medium", confirmed: true };
  actor.system.cypherLimit = 0;
  assert.equal(await acquireCypher(actor, template.uuid, options), false); assert.deepEqual(actor.flags, {});
  actor.system.cypherLimit = 2; game.users.activeGM.id = "otherGM";
  assert.equal(await acquireCypher(actor, template.uuid, options), false); assert.deepEqual(actor.flags, {});
  game.users.activeGM.id = "gm"; ChatMessage.create = async () => { throw Error("publication failed"); };
  await assert.rejects(acquireCypher(actor, template.uuid, options), /publication failed/);
  assert.equal(actor.items.size, 1); assert.equal(actor.flags.cypher.acquisitions.once.state, "applied");
  assert.equal(await acquireCypher(actor, template.uuid, options), true); assert.equal(actor.items.size, 1);
});

test("interrupted creation cannot be reconciled concurrently while its original transfer is still running", async () => {
  const item = cypher(), target = pc("destination");
  let release, started;
  const entered = new Promise(resolve => { started = resolve; });
  target.createEmbeddedDocuments = async () => { started(); await new Promise(resolve => { release = resolve; }); throw Error("interrupted transfer"); };
  const pending = transferCypher(item, target, { confirmed: true });
  await entered;
  assert.equal(await reconcileCypherTransfer(item, { transferred: false, note: "Too early" }), false);
  release(); await assert.rejects(pending, /interrupted transfer/);
  assert.equal(await reconcileCypherTransfer(item, { transferred: false, note: "Inspected after failure" }), true);
});

test("the Power Boost form remains a GM decision even through a native Item update", () => {
  const boost = cypher(actor, { system: { cypherCategory: "powerBoost", cypherType: "" } });
  game.user.isGM = false;
  assert.equal(validateCypherUpdates([boost], [{ _id: boost.id, "system.cypherType": "manifest" }]), false);
  game.user.isGM = true;
  assert.equal(validateCypherUpdates([boost], [{ _id: boost.id, "system.cypherType": "manifest" }]), true);
});
