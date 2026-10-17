/** CRD > Spending Experience Points > Character Advancement: rejected choices spend nothing. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { purchaseAdvancementSlot } from "../../module/applications/advancement-service.mjs";
import { spendXP } from "../../module/applications/character-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

beforeEach(() => {
  globalThis.game = { i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => data };
});
function actor(type = "skill") {
  return { type: "pc", isOwner: true, items: new Map(), writes: [], created: [],
    system: { xp: 8, effort: 1, resourcePoints: 0, advancementSlots: [{ type, bought: false }],
      stats: { might: { edge: 0, pool: { value: 8, max: 8 } } } },
    async update(changes) {
      await Promise.resolve();
      this.writes.push(structuredClone(changes));
      return applyDocumentUpdate(this, changes);
    },
    async createEmbeddedDocuments(_type, documents) { this.created.push(...documents); return documents; }
  };
}
for (const amount of [-1, NaN, Infinity, "1", 1.5]) {
  test(`invalid XP amount ${String(amount)} never writes`, async () => {
    const pc = actor();
    assert.equal(await spendXP(pc, amount), false);
    assert.deepEqual(pc.writes, []);
  });
}
for (const [type, extra] of [["skill", { skillId: "deleted" }], ["skill", {}],
  ["skill", { newSkillName: "  " }], ["skill", { newSkillName: 17 }],
  ["perfection", { stat: "deleted" }], ["unknown", {}], ["other", { otherType: "unknown" }]]) {
  test(`invalid ${type} advancement ${JSON.stringify(extra)} is rejected before XP`, async () => {
    const pc = actor(type);
    if (type === "other") pc.system.advancementSlots[0].otherType = extra.otherType;
    await purchaseAdvancementSlot(pc, 0, extra);
    assert.deepEqual(pc.writes, []);
    assert.deepEqual(pc.created, []);
  });
}
test("a non-owner cannot spend or buy an advancement", async () => {
  const pc = actor("effort"); pc.isOwner = false;
  assert.equal(await spendXP(pc, 1), false);
  await purchaseAdvancementSlot(pc, 0);
  assert.deepEqual(pc.writes, []);
});
test("overlapping purchases create one skill and charge one advancement", async () => {
  const pc = actor();
  await Promise.all([purchaseAdvancementSlot(pc, 0, { newSkillName: "Athletics" }),
    purchaseAdvancementSlot(pc, 0, { newSkillName: "Athletics" })]);
  assert.equal(pc.created.length, 1);
  assert.equal(pc.system.xp, 4);
  assert.equal(pc.system.advancementSlots[0].bought, true);
});
test("failed Item creation preserves committed XP, posts no success, and releases the guard", async () => {
  const pc = actor(); let cards = 0;
  globalThis.ChatMessage.create = async () => { cards++; };
  pc.createEmbeddedDocuments = async () => { throw new Error("Item write failed"); };
  await assert.rejects(purchaseAdvancementSlot(pc, 0, { newSkillName: "Athletics" }), /Item write failed/);
  assert.equal(pc.system.xp, 4);
  assert.equal(pc.system.advancementSlots[0].bought, false);
  assert.equal(cards, 0);
  pc.createEmbeddedDocuments = async () => [];
  await purchaseAdvancementSlot(pc, 0, { newSkillName: "Athletics" });
  assert.equal(pc.system.advancementSlots[0].bought, true);
});
