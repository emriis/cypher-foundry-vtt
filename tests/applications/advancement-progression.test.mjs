/** CRD Character Advancement, Gaining Resource Points and Advancement Beyond Tier 6. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { purchaseAdvancementSlot, advanceTier } from "../../module/applications/advancement-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

beforeEach(() => {
  globalThis.game = { user: { isGM: true }, i18n: { lang: "en", localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
});
function pc(tier = 1, type = "effort", otherType = "") {
  return { type: "pc", isOwner: true, uuid: "Scene.s.Token.t.Actor.pc", items: new Map(), flags: { cypher: {} }, writes: [], created: [],
    system: { tier, xp: 40, effort: 1, resourcePoints: 0, genre: "fantasy", advancementSlots: [
      { type, otherType, bought: false }, ...Array.from({ length: 3 }, () => ({ type: "", bought: false }))
    ], stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { max: 8, value: 8 }, edge: 0 }])) },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(changes) { this.writes.push(changes); return applyDocumentUpdate(this, changes); },
    async createEmbeddedDocuments(_type, documents) { this.created.push(...documents); return documents; }
  };
}
for (const [tier, reward] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [6, 3], [9, 3]]) {
  test(`tier ${tier} advancement awards ${reward} resource points`, async () => {
    const actor = pc(tier); await purchaseAdvancementSlot(actor, 0);
    assert.equal(actor.system.resourcePoints, reward);
    assert.equal(actor.system.xp, 36);
  });
}
test("a main advancement cannot be purchased twice, even after its bought slot label is edited", async () => {
  const actor = pc(); await purchaseAdvancementSlot(actor, 0);
  actor.system.advancementSlots[0].type = "perfection";
  actor.system.advancementSlots[1] = { type: "effort", bought: false };
  const saved = structuredClone(actor.system);
  await purchaseAdvancementSlot(actor, 1);
  assert.deepEqual(actor.system, saved);
});
test("only one Other may replace a main advancement and Genre requires tier three", async () => {
  const actor = pc(1, "other", "genre");
  await purchaseAdvancementSlot(actor, 0); assert.equal(actor.system.xp, 40);
  actor.system.advancementSlots[0].otherType = "recovery";
  await purchaseAdvancementSlot(actor, 0);
  actor.system.advancementSlots[1] = { type: "other", otherType: "armor", bought: false };
  await purchaseAdvancementSlot(actor, 1); assert.equal(actor.system.xp, 36);
});
test("skill specialization and combat training enforce source tier gates before XP", async () => {
  for (const [tier, level, minimumTier, minimumSpecializationTier] of [[1,"trained",null,null],[1,"practiced",2,4],[3,"trained",2,4]]) {
    const actor = pc(tier, "skill");
    actor.items.set("skill", { type: "skill", system: { level, minimumTier, minimumSpecializationTier }, async update() { assert.fail("Rejected training must not write"); } });
    await purchaseAdvancementSlot(actor, 0, { skillId: "skill" }); assert.equal(actor.system.xp, 40);
  }
});
test("cancelling an inability produces ordinary proficiency, not an easing step", async () => {
  const actor = pc(1, "skill");
  const skill = { type: "skill", system: { level: "inability" }, async update(changes) { applyDocumentUpdate(this, changes); } };
  actor.items.set("skill", skill);
  await purchaseAdvancementSlot(actor, 0, { skillId: "skill" });
  assert.equal(skill.system.level, "practiced");
});
test("four distinct advancements pass tier six with the free Focus choice resolved now", async () => {
  const actor = pc(6, "skill");
  actor.flags.cypher.appliedFocusGraph = { abilities: [{ id: "remaining", tier: 1, uuid: "Item.remaining" }] };
  globalThis.fromUuid = async () => ({ type: "ability", name: "Remaining", system: { tier: 1 } });
  actor.system.advancementSlots = ["capabilities","perfection","effort","skill"].map(type => ({ type, bought: type !== "skill" }));
  await purchaseAdvancementSlot(actor, 3, { newSkillName: "Navigation", skillKind: "general", tierChoices: { focus: { abilityId: "remaining" } } });
  assert.equal(actor.system.tier, 7);
  assert.equal(actor.system.resourcePoints, 3);
  assert.equal(actor.flags.cypher.focusAbilityPendingTier, null);
  assert.deepEqual(actor.flags.cypher.focusAbilityIds, ["remaining"]);
});

test("the public tier-completion API rejects an incomplete tier", async () => {
  const actor = pc(6);
  assert.equal(await advanceTier(actor), false);
  assert.equal(actor.system.tier, 6);
});


test("new combat training uses an explicit kind and category, never the localized name", async () => {
  const early = pc(1, "skill");
  await purchaseAdvancementSlot(early, 0, { newSkillName: "Whatever", skillKind: "attack" });
  assert.equal(early.system.xp, 40);
  const later = pc(2, "skill");
  await purchaseAdvancementSlot(later, 0, { newSkillName: "Localized weapon training", skillKind: "attack", attackCategory: "lightBladed" });
  assert.equal(later.system.xp, 36);
  assert.equal(later.created[0].flags.cypher.skillKind, "attack");
});

test("old granted combat Skills retaining canonical provenance still enforce combat tiers", async () => {
  const actor = pc(3, "skill");
  actor.items.set("skill", { type: "skill", flags: { cypherFoundry: { crd: { sourceLogicalId: "skill.defending" } } },
    system: { level: "trained" }, async update() { assert.fail("A tier-three defense specialization must be rejected"); } });
  assert.equal(await purchaseAdvancementSlot(actor, 0, { skillId: "skill" }), false);
  assert.equal(actor.system.xp, 40);
});
