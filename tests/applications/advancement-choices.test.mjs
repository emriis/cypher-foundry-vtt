/** Paid/free choices, source resolution and multi-document interruption boundaries. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { purchaseAdvancementSlot, selectAdvancementAbility, selectFocusAbility, clearAdvancementInterruption } from "../../module/applications/advancement-service.mjs";
import { GENRE_ABILITIES } from "../../module/rules/genre-ability-catalogue.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor, sources;
beforeEach(() => {
  globalThis.game = { user: { isGM: true }, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  actor = { type: "pc", isOwner: true, system: { tier: 3, xp: 20, effort: 2, resourcePoints: 0, genre: "fantasy", focus: "Focus", advancementSlots: [
    { type: "other", otherType: "focus", bought: false }, ...Array.from({length:3},()=>({ type: "", bought: false }))
  ] }, flags: { cypher: { focusAbilityIds: ["root"], appliedFocusGraph: { abilities: [
    { id: "root", tier: 1, uuid: "Item.root" }, { id: "next", tier: 2, uuid: "Item.next" }, { id: "high", tier: 6, uuid: "Item.high" }
  ], flowchart: { edges: [{ from: "root", to: "next" }, { from: "next", to: "high" }] } } } }, items: new Map(),
  getFlag(scope, key) { return this.flags[scope]?.[key]; },
  async update(changes) { applyDocumentUpdate(this, changes); },
  async createEmbeddedDocuments(_type, items) { for (const [index,item] of items.entries()) this.items.set(`created-${this.items.size}-${index}`, structuredClone(item)); return items; }
  };
  sources = new Map([["Item.next", { type: "ability", id: "next", name: "Next", system: { tier: 2, grantedArmorItemCategory: "light", freeWeaponCategories: ["medium"] } }]]);
  globalThis.fromUuid = async uuid => sources.get(uuid);
});
test("paid Focus resolves the graph, grants the actual source and armor, and charges once", async () => {
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "high" }), false);
  assert.equal(actor.system.xp, 20);
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), true);
  assert.equal(actor.system.xp, 16); assert.equal(actor.system.resourcePoints, 2);
  assert.deepEqual(actor.flags.cypher.focusAbilityIds, ["root", "next"]);
  assert.equal(actor.items.size, 2); assert.deepEqual(actor.system.freeWeaponCategories, ["light", "medium"]);
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), false);
});
test("missing sources and cancelled/invalid choices never consume XP or a free entitlement", async () => {
  sources.clear(); actor.flags.cypher.focusAbilityPendingTier = 2;
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), false);
  assert.equal(await selectFocusAbility(actor, "next"), false);
  assert.equal(actor.system.xp, 20); assert.equal(actor.flags.cypher.focusAbilityPendingTier, 2);
  assert.equal(actor.items.size, 0); assert.equal(actor.flags.cypher.advancementPending, undefined);
});
test("free Focus consumes one entitlement and the compatibility API cannot grant unlimited choices", async () => {
  assert.equal(await selectFocusAbility(actor, "next"), false);
  actor.flags.cypher.focusAbilityPendingTier = 2;
  assert.equal(await selectFocusAbility(actor, "next"), true);
  assert.equal(actor.items.size, 2); assert.equal(actor.system.xp, 20);
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, null);
  assert.equal(await selectFocusAbility(actor, "next"), false);
});
test("an explicit legacy Focus choice is settled at the current tier before further purchases", async () => {
  actor.system.tier = 6; actor.flags.cypher.focusAbilityIds.push("next");
  actor.flags.cypher.focusAbilityPendingTier = 2;
  sources.set("Item.high", { type: "ability", name: "High", system: { tier: 6 } });
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "high" }), false);
  assert.equal(actor.system.xp, 20);
  assert.equal(await selectAdvancementAbility(actor, "legacy-focus-2", { abilityId: "high" }), true);
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, null);
});

test("Genre selection validates canonical source identity, genre and duplicates across languages", async () => {
  const record = GENRE_ABILITIES.find(entry => entry.genres.includes("fantasy"));
  const source = { type: "ability", name: "Localized Genre Power", system: { tier: record.tier }, flags: { cypherFoundry: { crd: { sourceLogicalId: record.id } } } };
  sources.set("Item.genre", source); actor.system.advancementSlots[0].otherType = "genre";
  actor.system.genre = "science-fiction";
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityUuid: "Item.genre" }), record.genres.includes("science-fiction"));
  actor.system.genre = "fantasy";
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityUuid: "Item.genre" }), true);
  assert.equal(actor.items.values().next().value.flags.cypher.grantOrigin.kind, "genre");
  actor.system.tier = 6; actor.system.advancementSlots[0].bought = false;
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityUuid: "Item.genre" }), false);
});
test("interrupted embedded grants keep the paid checkpoint and block replay until explicit GM reconciliation", async () => {
  actor.createEmbeddedDocuments = async () => { throw new Error("write failed"); };
  await assert.rejects(purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), /write failed/);
  assert.equal(actor.system.xp, 16); assert.equal(actor.system.resourcePoints, 0);
  actor.flags = JSON.parse(JSON.stringify(actor.flags));
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), false);
  assert.equal(actor.system.xp, 16);
  assert.equal(await clearAdvancementInterruption(actor), false);
  game.user.isGM = false; assert.equal(await clearAdvancementInterruption(actor, { reconciled: true }), false);
  game.user.isGM = true; assert.equal(await clearAdvancementInterruption(actor, { reconciled: true }), true);
});


test("the fourth purchase requires all new-tier choices before XP and never banks choices", async () => {
  actor.system.tier = 2;
  actor.system.advancementSlots = ["capabilities", "perfection", "effort", "other"].map(type => ({ type, otherType: type === "other" ? "focus" : "", bought: type !== "other" }));
  const record = GENRE_ABILITIES.find(entry => entry.genres.includes("fantasy") && entry.tier <= 3);
  sources.set("Item.genre", { type: "ability", name: "Genre", system: { tier: record.tier }, flags: { cypherFoundry: { crd: { logicalId: record.id } } } });
  // Paid Focus takes Next; the free Focus may take an unselected tier-one branch.
  actor.flags.cypher.appliedFocusGraph.abilities.push({ id: "side", tier: 1, uuid: "Item.side" });
  sources.set("Item.side", { type: "ability", name: "Side", system: { tier: 1 } });
  assert.equal(await purchaseAdvancementSlot(actor, 3, { abilityId: "next" }), false);
  assert.equal(actor.system.xp, 20); assert.equal(actor.items.size, 0);
  assert.equal(await purchaseAdvancementSlot(actor, 3, { abilityId: "next", tierChoices: { focus: { abilityId: "side" }, genre: { abilityUuid: "Item.genre" } } }), true);
  assert.equal(actor.system.tier, 3); assert.equal(actor.system.xp, 16); assert.equal(actor.system.resourcePoints, 1);
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, null);
  assert.equal(actor.flags.cypher.advancementChoices, undefined);
  assert.deepEqual(actor.flags.cypher.focusAbilityIds, ["root", "next", "side"]);
  assert.equal(actor.items.size, 4);
});


test("same-key Type and Genre variants cannot substitute for the canonical Genre definition", async () => {
  actor.system.advancementSlots[0].otherType = "genre";
  const record = GENRE_ABILITIES.find(entry => entry.id.startsWith("ability.tough-"));
  const source = { type: "ability", name: "Same translated title", system: { tier: record.tier }, flags: { cypherFoundry: { crd: { logicalId: "ability.tough" } } } };
  sources.set("Item.variant", source);
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityUuid: "Item.variant" }), false);
  source.flags.cypherFoundry.crd.logicalId = record.id;
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityUuid: "Item.variant" }), true);
});

test("a final Actor write failure retains its checkpoint and cannot duplicate the granted Items", async () => {
  const update = actor.update.bind(actor);
  actor.update = async changes => {
    if (Object.hasOwn(changes, "system.resourcePoints")) throw Error("final Actor write failed");
    return update(changes);
  };
  await assert.rejects(purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), /final Actor write/);
  assert.equal(actor.items.size, 2); assert.equal(actor.system.xp, 16);
  assert.ok(actor.flags.cypher.advancementPending);
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), false);
  assert.equal(actor.items.size, 2); assert.equal(actor.system.xp, 16);
});

test("permission revoked during source resolution rejects before the first write", async () => {
  globalThis.fromUuid = async uuid => { actor.isOwner = false; return sources.get(uuid); };
  assert.equal(await purchaseAdvancementSlot(actor, 0, { abilityId: "next" }), false);
  assert.equal(actor.system.xp, 20); assert.equal(actor.items.size, 0);
});
