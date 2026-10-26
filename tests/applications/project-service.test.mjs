import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createProject, approveProject, cancelProject, completeProject, resumeProject,
  reconcileProject, adjustResourcePoints, projectReview, projectDisplay } from "../../module/applications/project-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor, helper, target, documents, nextId, outputs;
function pc(id) {
  return { type: "pc", id, uuid: `Actor.${id}`, isOwner: true, flags: {},
    system: { resourcePoints: 10, xp: 5 }, items: new Map([["skill", { type: "skill", system: { level: "trained" } }]]),
    async update(changes) { applyDocumentUpdate(this, changes); },
    async createEmbeddedDocuments(_type, data) { outputs.push(...structuredClone(data)); return data; } };
}
const proposal = () => ({ label: "Repair the window", kind: "repairObject", targetUuid: target.uuid,
  skillItemId: "skill", genreConfirmed: true, skillAppropriate: true, durationSeconds: 3600 });
beforeEach(() => {
  nextId = 0; outputs = []; documents = new Map(); actor = pc("pc"); helper = pc("helper");
  target = { type: "object", uuid: "Scene.scene.Token.window.Actor.window", isOwner: true,
    flags: {}, system: { originalLevel: 3, levelDamage: 3, destructionDamage: 0, physical: true },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  for (const document of [actor, helper, target]) documents.set(document.uuid, document);
  globalThis.fromUuid = async uuid => documents.get(uuid) ?? null;
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, time: { worldTime: 0 },
    i18n: { format: key => key } };
  globalThis.foundry = { utils: { randomID: () => `id${++nextId}`, escapeHTML: value => value },
    documents: { Actor: { create: async data => { outputs.push(data); return data; } } } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
});
const saved = id => actor.flags.cypher.projects[id];
async function active(input = proposal()) { const id = await createProject(actor, input); assert.equal(await approveProject(actor, id, { confirmed: true }), true); return id; }

test("proposal, approval, elapsed time and explicit work confirmation precede any expenditure", async () => {
  const id = await createProject(actor, proposal());
  assert.equal(actor.system.resourcePoints, 10);
  assert.equal(await approveProject(actor, id), false);
  assert.equal(await approveProject(actor, id, { confirmed: true }), true);
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  game.time.worldTime = 3600;
  assert.equal(await completeProject(actor, id), false);
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), true);
  assert.equal(actor.system.resourcePoints, 9); assert.equal(actor.system.xp, 5);
  assert.equal(target.system.levelDamage, 0); assert.equal(saved(id).state, "completed");
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  assert.equal(actor.system.resourcePoints, 9);
});

test("draft/active cancellation spends nothing and players cannot approve or settle", async () => {
  const id = await active(); game.user.isGM = false;
  assert.equal(await approveProject(actor, id, { confirmed: true }), false);
  game.time.worldTime = 4000; assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  assert.equal(await cancelProject(actor, id), true); assert.equal(actor.system.resourcePoints, 10);
  assert.equal(target.system.levelDamage, 3);
});

test("repair checks original level, real training and destroyed state rather than declared cheap inputs", async () => {
  for (const changes of [{ levelDamage: 3, destructionDamage: 3 }, { originalLevel: 5, levelDamage: 5 }]) {
    Object.assign(target.system, changes);
    const id = await createProject(actor, { ...proposal(), level: 1 });
    assert.equal(await approveProject(actor, id, { confirmed: true }), false);
  }
  Object.assign(target.system, { originalLevel: 3, levelDamage: 3, destructionDamage: 0 });
  actor.items.delete("skill");
  const id = await createProject(actor, proposal());
  assert.equal(await approveProject(actor, id, { confirmed: true }), false);
  assert.equal(actor.system.resourcePoints, 10);
});

test("collaboration pays the combined cost, not each participant's full project cost", async () => {
  const id = await active({ label: "Research the keep", kind: "research", level: 7, durationSeconds: 1,
    contributions: [{ actorUuid: helper.uuid, amount: 2 }] });
  game.time.worldTime = 1;
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), true);
  assert.equal(actor.system.resourcePoints, 9); assert.equal(helper.system.resourcePoints, 8);
});

test("insufficient participant resources reject completion before even the first debit", async () => {
  const id = await active({ label: "Research", kind: "research", level: 7, durationSeconds: 1,
    contributions: [{ actorUuid: helper.uuid, amount: 2 }] });
  game.time.worldTime = 1; helper.system.resourcePoints = 1;
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  assert.equal(saved(id).state, "active"); assert.equal(actor.system.resourcePoints, 10);
});

test("a partial multi-owner debit resumes after reload without charging the first participant twice", async () => {
  const id = await active({ label: "Research", kind: "research", level: 7, durationSeconds: 1,
    contributions: [{ actorUuid: helper.uuid, amount: 2 }] });
  game.time.worldTime = 1; const update = helper.update;
  helper.update = async () => { throw Error("failed contribution"); };
  await assert.rejects(completeProject(actor, id, { workConfirmed: true }), /failed contribution/);
  assert.equal(actor.system.resourcePoints, 9); assert.equal(saved(id).state, "settling");
  actor.flags = JSON.parse(JSON.stringify(actor.flags)); helper.update = update;
  assert.equal(await resumeProject(actor, id), true);
  assert.equal(actor.system.resourcePoints, 9); assert.equal(helper.system.resourcePoints, 8);
  assert.equal(saved(id).state, "completed");
});

test("an uncertain output is not replayed and requires documented GM reconciliation", async () => {
  const id = await active(); game.time.worldTime = 3600;
  target.update = async () => { throw Error("uncertain repair"); };
  await assert.rejects(completeProject(actor, id, { workConfirmed: true }), /uncertain repair/);
  assert.equal(actor.system.resourcePoints, 9);
  assert.equal(await resumeProject(actor, id), false); assert.equal(saved(id).state, "manual");
  assert.equal(await reconcileProject(actor, id, { confirmed: true, note: "GM repaired the object externally" }), true);
  assert.equal(actor.system.resourcePoints, 9); assert.equal(saved(id).state, "completed");
});

test("the actual manifest source controls power eligibility; successful crafting copies its mechanics", async () => {
  actor.items.get("skill").system.level = "expert";
  const source = { type: "cypher", uuid: "Item.source", system: { cypherType: "manifest", powerLevel: "low" },
    toObject() { return { system: { ...this.system, description: "Source effect", depleted: true } }; } };
  documents.set(source.uuid, source);
  const bad = await createProject(actor, { label: "Unsupported", kind: "craftCypher", power: "high", sourceUuid: source.uuid,
    durationSeconds: 1, genreConfirmed: true, skillAppropriate: true, skillItemId: "skill" });
  assert.equal(await approveProject(actor, bad, { confirmed: true }), false);
  const id = await active({ ...saved(bad).proposal, power: "low" }); game.time.worldTime = 1;
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), true);
  assert.equal(actor.system.resourcePoints, 8); assert.equal(outputs[0].system.description, "Source effect");
  assert.equal(outputs[0].system.depleted, false);
});

test("a low-power crafted cypher cannot retain a random advanced-power variant", async () => {
  const source = { type: "cypher", uuid: "Item.multi", system: { cypherType: "manifest", powerLevels: ["low", "advanced"],
    variants: [{ name: "Low effect", powerLevel: "low" }, { name: "Advanced effect", powerLevel: "advanced" }] },
    toObject() { return { system: structuredClone(this.system) }; } };
  documents.set(source.uuid, source);
  const input = { label: "Specific low cypher", kind: "craftCypher", power: "low", sourceUuid: source.uuid,
    durationSeconds: 0, genreConfirmed: true, skillAppropriate: true, skillItemId: "skill" };
  const bad = await createProject(actor, input); assert.equal(await approveProject(actor, bad, { confirmed: true }), false);
  const id = await active({ ...input, variantName: "Low effect" });
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), true);
  assert.deepEqual(outputs[0].system.powerLevels, ["low"]); assert.deepEqual(outputs[0].system.variants, []);
  assert.equal(outputs[0].flags.cypher.craftedVariant, "Low effect");
});

test("GM resource awards use idempotent receipts and never change advancement XP", async () => {
  assert.equal(await adjustResourcePoints(actor, 2, { id: "award", note: "GM reward" }), true);
  assert.equal(await adjustResourcePoints(actor, 2, { id: "award", note: "GM reward" }), true);
  assert.equal(actor.system.resourcePoints, 12); assert.equal(actor.system.xp, 5);
  actor.system.resourcePoints = 0;
  assert.equal(await adjustResourcePoints(actor, 2, { id: "award", note: "GM reward" }), true);
  assert.equal(actor.system.resourcePoints, 0);
  game.user.isGM = false;
  assert.equal(await adjustResourcePoints(actor, 2, { id: "other", note: "No GM" }), false);
});

test("an actual source's higher object level cannot be replaced by a cheap declared level", async () => {
  documents.set("Item.source", { type: "equipment", uuid: "Item.source", system: { level: 6 } });
  const id = await createProject(actor, { ...proposal(), kind: "craftObject", level: 2, sourceUuid: "Item.source" });
  assert.equal(await approveProject(actor, id, { confirmed: true }), false);
  assert.equal(actor.system.resourcePoints, 10);
});

test("changed skill qualification or a destroyed target invalidates completion before payment", async () => {
  const id = await active(); game.time.worldTime = 3600;
  actor.items.delete("skill"); assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  actor.items.set("skill", { type: "skill", system: { level: "trained" } });
  target.system.destructionDamage = 3;
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  assert.equal(actor.system.resourcePoints, 10);
});

test("commissioned NPC expertise replaces an absent PC skill without changing time or price", async () => {
  const npc = { type: "npc", uuid: "Actor.crafter", isOwner: true }; documents.set(npc.uuid, npc);
  actor.items.clear();
  const id = await active({ ...proposal(), workerUuid: npc.uuid, workerTraining: 1 });
  assert.equal(saved(id).cost, 1); assert.equal(saved(id).readyAt, 3600);
  game.time.worldTime = 3600; assert.equal(await completeProject(actor, id, { workConfirmed: true }), true);
  assert.equal(actor.system.resourcePoints, 9);
});

test("restoring a saved synthetic follower costs rounded-up half-level and restores numeric Health", async () => {
  target.type = "npc"; target.system = { level: 3, health: { value: 0, max: 9 } };
  const id = await active({ label: "Restore follower", kind: "restoreFollower", targetUuid: target.uuid,
    durationSeconds: 604800, followerConfirmed: true });
  game.time.worldTime = 604800;
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), true);
  assert.equal(actor.system.resourcePoints, 8); assert.equal(target.system.health.value, 9);
});

test("unqualified followers, duplicated contributors and unauthorized GMs cannot approve", async () => {
  const id = await createProject(actor, { label: "Research", kind: "research", level: 5, durationSeconds: 1,
    contributions: [{ actorUuid: helper.uuid, amount: 1 }, { actorUuid: helper.uuid, amount: 1 }] });
  assert.equal(await approveProject(actor, id, { confirmed: true }), false);
  const other = await createProject(actor, proposal()); game.users.activeGM.id = "differentGM";
  assert.equal(await approveProject(actor, other, { confirmed: true }), false);
  assert.equal(actor.system.resourcePoints, 10);
});

test("linked-token aliases cannot contribute twice from the same actual resource owner", async () => {
  documents.set("Scene.scene.Token.linked.Actor.helper", helper);
  const id = await createProject(actor, { label: "Research", kind: "research", level: 7, durationSeconds: 1,
    contributions: [{ actorUuid: helper.uuid, amount: 1 }, { actorUuid: "Scene.scene.Token.linked.Actor.helper", amount: 1 }] });
  assert.equal(await approveProject(actor, id, { confirmed: true }), false);
  assert.equal(helper.system.resourcePoints, 10);
});

test("approval rechecks the concrete review and rejected or cancelled actions preserve resources", async () => {
  const id = await createProject(actor, proposal());
  const review = await projectReview(actor, id);
  assert.equal(review.cost, 1); assert.equal(review.hours, 1);
  const changed = { ...review, cost: 2 };
  assert.equal(await approveProject(actor, id, { confirmed: true, expectedReview: changed }), false);
  assert.equal(saved(id).state, "draft"); assert.equal(actor.system.resourcePoints, 10);
});

test("chat publication failure leaves an already completed project non-payable", async () => {
  const id = await active(); game.time.worldTime = 3600;
  ChatMessage.create = async () => { throw Error("chat failed"); };
  await assert.rejects(completeProject(actor, id, { workConfirmed: true }), /chat failed/);
  assert.equal(saved(id).state, "completed"); assert.equal(actor.system.resourcePoints, 9);
  assert.equal(await resumeProject(actor, id), false);
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
});

test("old or malformed optional flags do not break sheets or manufacture an elapsed deadline", async () => {
  assert.deepEqual(projectDisplay(actor), []);
  actor.flags.cypher = { projects: { old: { version: 0 }, broken: null, partial: { version: 1 } } };
  assert.deepEqual(projectDisplay(actor), []);
  const id = await active(); delete saved(id).readyAt;
  assert.equal(await completeProject(actor, id, { workConfirmed: true }), false);
  assert.equal(actor.system.resourcePoints, 10); assert.equal(actor.flags.cypher.projects.old.version, 0);
});
