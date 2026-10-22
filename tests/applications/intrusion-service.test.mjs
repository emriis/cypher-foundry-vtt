/** CRD intrusions: requests cannot spend XP before the GM's decision. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { usePlayerIntrusion } from "../../module/applications/character-service.mjs";
import { createGMIntrusion, requestIntrusionShare, resolvePlayerIntrusion, resolveIntrusionShare,
  resumeIntrusionShares, getIntrusion } from "../../module/applications/intrusion-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

let gm, alice, bob, source, recipient, registry, messages;
function collection(entries) {
  const values = new Map(entries.map(entry => [entry.id, entry]));
  values.find = callback => [...values.values()].find(callback);
  values.filter = callback => [...values.values()].filter(callback);
  values[Symbol.iterator] = function* () { yield* this.values(); };
  return values;
}

beforeEach(() => {
  gm = { id: "gm", isGM: true, active: true };
  alice = { id: "alice", isGM: false }; bob = { id: "bob", isGM: false };
  registry = new Map(); messages = collection([]);
  globalThis.game = { user: gm, users: collection([gm, alice, bob]), messages,
    i18n: { localize: key => key, format: key => key } };
  game.users.activeGM = gm;
  globalThis.fromUuid = async uuid => registry.get(uuid);
  globalThis.foundry = { utils: { escapeHTML: value => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;") } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => {
    const id = `message-${messages.size}`, author = game.user;
    const message = { ...data, id, uuid: `ChatMessage.${id}`, author,
      async update(patch) { applyDocumentUpdate(this, patch); return this; } };
    messages.set(id, message); registry.set(message.uuid, message); return message;
  } };
  const actor = (id, owner) => {
    const doc = { id, uuid: `Actor.${id}`, name: id, type: "pc", flags: { cypher: {} }, system: { xp: 5 }, updates: [],
      testUserPermission: user => user?.isGM || user?.id === owner.id,
      get isOwner() { return this.testUserPermission(game.user); },
      async update(patch) { this.updates.push(patch); return applyDocumentUpdate(this, patch); } };
    owner.character = doc; registry.set(doc.uuid, doc); return doc;
  };
  source = actor("source", alice); recipient = actor("recipient", bob);
});

async function playerRequest(options) {
  game.user = alice; const request = await usePlayerIntrusion(source, "A helpful coincidence.", options);
  game.user = gm; return request;
}

async function shareRequest() {
  const origin = await createGMIntrusion(source, "The bridge breaks.");
  game.user = alice; const choice = await requestIntrusionShare(origin, recipient, bob.id);
  game.user = gm; return { origin, choice };
}

test("a player intrusion request leaves XP untouched until the GM accepts it", async () => {
  globalThis.game = { user: { id: "player", isGM: false }, i18n: { localize: key => key, format: key => key } };
  globalThis.foundry = { utils: { escapeHTML: text => text } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => ({ ...data, id: "request", uuid: "ChatMessage.request" }) };
  const actor = { id: "pc", uuid: "Actor.pc", name: "PC", type: "pc", isOwner: true, system: { xp: 5 },
    async update(patch) { if ("system.xp" in patch) this.system.xp = patch["system.xp"]; } };
  await usePlayerIntrusion(actor, "A familiar guide arrives.");
  assert.equal(actor.system.xp, 5);
});

test("only the elected GM accepts a proposal, charging exactly one XP without consuming an action", async () => {
  const request = await playerRequest();
  source.flags.cypher.roundActionUsage = { primary: true, activity: true };
  game.user = alice;
  assert.equal(await resolvePlayerIntrusion(request), false);
  game.user = gm;
  const accepted = await Promise.all([resolvePlayerIntrusion(request), resolvePlayerIntrusion(request)]);
  assert.equal(accepted.filter(Boolean).length, 1);
  assert.equal(source.system.xp, 4);
  assert.equal(getIntrusion(request).state, "resolved");
  assert.deepEqual(source.flags.cypher.roundActionUsage, { primary: true, activity: true });
  assert.equal(await resolvePlayerIntrusion(request), false);
});

test("rejection and fresh insufficient XP charge nothing and cannot be silently accepted later", async () => {
  const rejected = await playerRequest();
  assert.equal(await resolvePlayerIntrusion(rejected, { accept: false }), true);
  assert.equal(source.system.xp, 5);
  assert.equal(await resolvePlayerIntrusion(rejected), false);
  const request = await playerRequest(); source.system.xp = 0;
  assert.equal(await resolvePlayerIntrusion(request), false);
  assert.equal(getIntrusion(request).state, "pending");
  assert.equal(source.flags.cypher.intrusionReceipts, undefined);
});

test("GM awards await the player's choice and apply one net XP to each different player's PC", async () => {
  const { origin, choice } = await shareRequest();
  assert.equal(source.system.xp, 5); assert.equal(recipient.system.xp, 5);
  const result = await Promise.all([resolveIntrusionShare(choice), resolveIntrusionShare(choice)]);
  assert.equal(result.filter(Boolean).length, 1);
  assert.equal(source.system.xp, 6); assert.equal(recipient.system.xp, 6);
  assert.equal(getIntrusion(origin).state, "resolved");
  await resumeIntrusionShares();
  assert.equal(source.system.xp + recipient.system.xp, 12);
});

test("the share rejects self, another PC of the same player, forged authors and non-GM settlement", async () => {
  const origin = await createGMIntrusion(source, "Complication");
  game.user = alice;
  assert.equal(await requestIntrusionShare(origin, source, bob.id), null);
  assert.equal(await requestIntrusionShare(origin, recipient, alice.id), null);
  const choice = await requestIntrusionShare(origin, recipient, bob.id);
  assert.equal(await resolveIntrusionShare(choice), false);
  game.user = gm; choice.author = bob;
  assert.equal(await resolveIntrusionShare(choice), false);
  assert.equal(source.system.xp + recipient.system.xp, 10);
});

test("a partially saved award resumes from receipts without overwriting intervening XP", async () => {
  const { origin, choice } = await shareRequest();
  const update = recipient.update;
  recipient.update = async () => { throw Error("recipient unavailable"); };
  await assert.rejects(resolveIntrusionShare(choice), /recipient unavailable/);
  assert.equal(source.system.xp, 6); assert.equal(recipient.system.xp, 5);
  assert.equal(getIntrusion(origin).state, "processing");
  source.system.xp = 9; recipient.update = update;
  origin.flags = structuredClone(origin.flags); source.flags = structuredClone(source.flags);
  await resumeIntrusionShares();
  assert.equal(source.system.xp, 9); assert.equal(recipient.system.xp, 6);
  assert.equal(source.updates.length, 1);
});

test("a lost XP-write acknowledgement or final-card failure never repeats a debit", async () => {
  const request = await playerRequest(), update = source.update;
  source.update = async function(patch) { await update.call(this, patch); throw Error("ack lost"); };
  await assert.rejects(resolvePlayerIntrusion(request), /ack lost/);
  assert.equal(source.system.xp, 4);
  source.update = update;
  const save = request.update;
  request.update = async function(patch) {
    if (patch["flags.cypher.intrusion"].state === "resolved") throw Error("chat unavailable");
    return save.call(this, patch);
  };
  await assert.rejects(resolvePlayerIntrusion(request), /chat unavailable/);
  request.update = save;
  assert.equal(await resolvePlayerIntrusion(request), true);
  assert.equal(source.system.xp, 4); assert.equal(source.updates.length, 1);
});

test("natural-one intrusions are free, source-validated and unique across original and reroll cards", async () => {
  const roll = await ChatMessage.create({ flags: { cypher: { rollType: "task", d20: 1, actorUuid: source.uuid } } });
  const first = await createGMIntrusion(source, "A complication", { rollMessage: roll });
  assert.equal(getIntrusion(first).kind, "gmFree");
  assert.equal(await createGMIntrusion(source, "Again", { rollMessage: roll }), first);
  const child = await ChatMessage.create({ flags: { cypher: { rerollOriginId: roll.id } } });
  assert.equal(await createGMIntrusion(source, "Again", { rollMessage: child }), first);
  assert.equal(source.system.xp, 5); assert.equal(recipient.system.xp, 5);
  roll.flags.cypher.d20 = 12;
  assert.equal(await createGMIntrusion(source, "Invalid", { rollMessage: roll }), null);
});

test("reaction requests and GM acceptance both enforce the next primary turn without consuming it", async () => {
  const combatant = { id: "pc", actor: source };
  game.combat = { id: "combat", round: 1, turn: 0, combatant, turns: [combatant], flags: { cypher: { turnRevisions: { pc: 1 } } } };
  const intrusion = await createGMIntrusion(source, "A complication");
  game.user = alice;
  assert.equal(await usePlayerIntrusion(source, "React", { reactionTo: intrusion.uuid }), null);
  game.combat.flags.cypher.turnRevisions.pc = 2;
  const request = await usePlayerIntrusion(source, "React", { reactionTo: intrusion.uuid });
  assert.ok(request);
  game.user = gm;
  game.combat.flags.cypher.turnRevisions.pc = 3;
  assert.equal(await resolvePlayerIntrusion(request), false);
  assert.equal(source.system.xp, 5);
  game.combat.flags.cypher.turnRevisions.pc = 2;
  assert.equal(await resolvePlayerIntrusion(request), true);
  assert.equal(source.flags.cypher.roundActionUsage, undefined);
});

test("unowned Actors, blank proposals and a second GM cannot bypass validation", async () => {
  game.user = bob;
  assert.equal(await usePlayerIntrusion(source, "No"), null);
  game.user = alice;
  assert.equal(await usePlayerIntrusion(source, "  "), null);
  game.user = { id: "otherGM", isGM: true };
  assert.equal(await createGMIntrusion(source, "Complication"), null);
  assert.equal(source.updates.length, 0);
});

test("a frozen recipient survives a conflicting choice and a failed final chat write", async () => {
  const { origin, choice } = await shareRequest();
  const other = { ...recipient, id: "other", uuid: "Actor.other", system: { xp: 2 }, flags: {}, updates: [] };
  registry.set(other.uuid, other);
  game.user = alice;
  const competing = await requestIntrusionShare(origin, other, bob.id);
  game.user = gm;
  const save = origin.update;
  origin.update = async function(patch) {
    if (patch["flags.cypher.intrusion"].state === "resolved") throw Error("chat failed");
    return save.call(this, patch);
  };
  await assert.rejects(resolveIntrusionShare(choice), /chat failed/);
  assert.equal(source.system.xp, 6); assert.equal(recipient.system.xp, 6);
  origin.update = save;
  await resolveIntrusionShare(competing);
  assert.equal(getIntrusion(competing).state, "superseded");
  await resolveIntrusionShare(choice);
  assert.equal(getIntrusion(choice).state, "resolved");
  assert.equal(other.system.xp, 2);
  assert.equal(source.updates.length, 1); assert.equal(recipient.updates.length, 1);
});

test("invalid recipient XP and revoked request ownership leave decisions and resources untouched", async () => {
  const { origin, choice } = await shareRequest();
  recipient.system.xp = Number.MAX_SAFE_INTEGER;
  assert.equal(await resolveIntrusionShare(choice), false);
  assert.equal(getIntrusion(origin).state, "awaitingRecipient");
  assert.equal(source.updates.length, 0);
  const request = await playerRequest();
  source.testUserPermission = user => user.isGM;
  assert.equal(await resolvePlayerIntrusion(request), false);
  assert.equal(getIntrusion(request).state, "pending");
});

test("intrusion receipts belong to the actual synthetic Actor rather than its world sibling", async () => {
  const sibling = source;
  source = { ...sibling, uuid: "Scene.scene.Token.token.Actor.source", system: { xp: 3 }, flags: {}, updates: [] };
  registry.set(source.uuid, source);
  const request = await playerRequest();
  await resolvePlayerIntrusion(request);
  assert.equal(source.system.xp, 2);
  assert.equal(sibling.system.xp, 5);
  assert.equal(sibling.flags.cypher.intrusionReceipts, undefined);
});

test("an unassigned secondary PC retains its player identity and ambiguous ownership requires a choice", async () => {
  alice.character = null;
  const origin = await createGMIntrusion(source, "Secondary PC complication");
  assert.equal(getIntrusion(origin).sourcePlayerId, alice.id);
  game.user = alice;
  assert.equal(await requestIntrusionShare(origin, recipient, alice.id), null);
  game.user = gm;
  source.testUserPermission = () => true;
  assert.equal(await createGMIntrusion(source, "Ambiguous player"), null);
  const explicit = await createGMIntrusion(source, "Explicit affected player", { sourcePlayerId: alice.id });
  assert.equal(getIntrusion(explicit).sourcePlayerId, alice.id);
});
