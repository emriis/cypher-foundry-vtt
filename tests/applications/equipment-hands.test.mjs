/** Actual ownership, finite hand capacity, explicit setup and shield lifecycle integration. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { configureEquipmentUse, equipmentGrip, equipmentAttackProblem, canReadyShield, setHandCapacity } from "../../module/applications/equipment-hands-service.mjs";
import { toggleEquipped } from "../../module/applications/equipment-service.mjs";
import { rollAttack, toggleAttackConfiguration } from "../../module/applications/item-service.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";

let actor, sword, shield, registry, rolls, cards;
function makeActor(uuid) {
  const doc = { id: uuid.split(".").at(-1), uuid, type: "pc", isOwner: true, flags: {}, items: new Map(), statuses: new Set(), updates: [],
    system: { xp: 5, effort: 3, armor: {}, stats: Object.fromEntries(["might", "speed", "intellect"].map(stat =>
      [stat, { pool: { value: 10, max: 10 }, edge: 0 }])), wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity =>
      [severity, { current: 0, max: 3 }])) },
    async update(patch) { this.updates.push(patch); applyDocumentUpdate(this, patch); },
    async toggleStatusEffect() {}, rollTask(options) { return rollTask(this, options); } };
  registry.set(uuid, doc); return doc;
}
function makeItem(owner, id, type, system) {
  const item = { id, actor: owner, type, name: id, isOwner: true, flags: { other: { retained: true } }, system, updates: [],
    async update(patch) { this.updates.push(patch); applyDocumentUpdate(this, patch); } };
  owner.items.set(id, item); return item;
}
beforeEach(() => {
  registry = new Map(); rolls = 0; cards = [];
  globalThis.game = { user: { id: "gm", isGM: true }, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.foundry = { utils: { escapeHTML: value => value, randomID: () => "id" } };
  globalThis.fromUuidSync = uuid => registry.get(uuid);
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => cards.push(message) };
  globalThis.Roll = class { async evaluate() { rolls++; this.total = 12; return this; } async toMessage(message) { cards.push(message); } };
  actor = makeActor("Actor.pc");
  sword = makeItem(actor, "sword", "attack", { attackType: "heavy", stat: "might", damage: 6, freelyUsable: true, mechanics: {} });
  shield = makeItem(actor, "shield", "shield", { equipped: false, inHand: true, wounds: {
    minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 } } });
});

test("old attacks remain unknown; failed attacks and conflicting grips spend/write nothing", async () => {
  assert.equal(equipmentGrip(sword), null);
  assert.equal(await rollAttack(sword, { effortLevels: 1 }), null);
  assert.equal(rolls, 0); assert.equal(actor.system.stats.might.pool.value, 10);
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 2 }), true);
  assert.equal(await toggleEquipped(shield), false);
  assert.equal(shield.updates.length, 0);
  assert.equal(shield.system.equipped, false);
  assert.equal(sword.flags.other.retained, true);
  assert.equal(await rollAttack(sword, { effortLevels: 1, difficulty: 3 }) !== null, true);
});

test("a one-handed exception applies its hindrance from actual grip, regardless of an unchecked option", async () => {
  sword.system.mechanics.hinderedWhenUsedOneHanded = true;
  await configureEquipmentUse(sword, { held: true, hands: 1 });
  await toggleEquipped(shield);
  const result = await rollAttack(sword, { difficulty: 3, oneHanded: false });
  assert.equal(result.effectiveDifficulty, 4);
  assert.equal(shield.system.equipped, true);
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 2 }), false);
});

test("stowing keeps inventory; GM capacity changes never silently drop held items", async () => {
  await configureEquipmentUse(sword, { held: true, hands: 2 });
  assert.equal(await setHandCapacity(actor, 1), false);
  assert.equal(await setHandCapacity(actor, 3), true);
  assert.equal(await toggleEquipped(shield), true);
  game.user.isGM = false;
  assert.equal(await setHandCapacity(actor, 4), false);
  await configureEquipmentUse(sword, { held: false, hands: 2 });
  assert.equal(actor.items.get(sword.id), sword);
  assert.equal(equipmentGrip(sword).held, false);
});

test("tripod and distinct current operators are prerequisites, with no invented action costs", async () => {
  const operator = makeActor("Scene.s.Token.t.Actor.helper");
  sword.system.mechanics = { requiresTripod: true, requiredOperators: 2 };
  await configureEquipmentUse(sword, { held: true, hands: 2 });
  assert.equal(equipmentAttackProblem(sword), "needTripod");
  await configureEquipmentUse(sword, { held: true, hands: 2, deployed: true });
  assert.equal(equipmentAttackProblem(sword), "needCrew");
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 2, deployed: true, operators: [actor.uuid] }), false);
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 2, deployed: true, operators: [operator.uuid, operator.uuid] }), false);
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 2, deployed: true, operators: [operator.uuid] }), true);
  assert.equal(equipmentAttackProblem(sword), null);
  operator.flags.cypher = { generalEffects: [{ id: "unconscious", kind: "unconscious" }] };
  assert.equal(equipmentAttackProblem(sword), "needCrew");
  assert.equal(await rollAttack(sword, { effortLevels: 1 }), null);
  assert.equal(actor.system.stats.might.pool.value, 10);
  assert.equal(actor.flags.cypher?.roundActionUsage, undefined);
  assert.equal(await configureEquipmentUse(sword, { held: false, hands: 2, deployed: true, operators: [operator.uuid] }), true,
    "An unavailable crew must not trap a weapon in the acting character's hands");
});

test("hands-free attacks are explicit; zero hands cannot bypass a heavy or two-handed requirement", async () => {
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 0 }), false);
  sword.system.attackType = "light";
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 0 }), true);
  assert.equal(equipmentAttackProblem(sword), null);
  sword.system.mechanics.twoHanded = true;
  assert.equal(equipmentAttackProblem(sword), "needTwoHands");
});

test("a player cannot declare a zero-hand attack until the GM has approved that Item", async () => {
  sword.system.attackType = "light";
  game.user.isGM = false;
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 0 }), false);
  game.user.isGM = true;
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 0 }), true);
  game.user.isGM = false;
  assert.equal(await configureEquipmentUse(sword, { held: false, hands: 0 }), true);
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 0 }), true);
  game.user.isGM = true;
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 1 }), true);
  game.user.isGM = false;
  assert.equal(await configureEquipmentUse(sword, { held: true, hands: 0 }), false);
});

test("lost/destroyed shields release hands, but catching cannot displace a newly held weapon", async () => {
  await configureEquipmentUse(shield, { held: true, hands: 1 });
  assert.equal(canReadyShield(shield), true);
  shield.system.inHand = false; shield.system.equipped = false;
  assert.equal(equipmentGrip(shield).held, false);
  await configureEquipmentUse(sword, { held: true, hands: 2 });
  assert.equal(canReadyShield(shield), false);
  const ability = makeItem(actor, "ability", "ability", { key: "throw-shield" });
  shield.system.flightId = "flight";
  const caught = await rollTask(actor, { stat: "speed", difficulty: 2,
    abilitySource: { itemId: ability.id }, shieldReturn: { itemId: shield.id, flightId: "flight" }, effortLevels: 1 });
  assert.equal(caught, null); assert.equal(rolls, 0); assert.equal(actor.system.stats.speed.pool.value, 10);
});

test("configuration changes cannot make a held one-hand grip into a two-hand requirement", async () => {
  sword.system.mechanics.alternateConfiguration = { enabled: true, attackType: "light", action: "action" };
  sword.system.mechanics.activeConfiguration = "alternate";
  await configureEquipmentUse(sword, { held: true, hands: 1 });
  assert.equal(await toggleAttackConfiguration(sword), false);
  assert.equal(sword.system.mechanics.activeConfiguration, "alternate");
});

test("unowned, malformed and overlapping changes preserve the actual synthetic owner", async () => {
  actor.uuid = "Scene.s.Token.t.Actor.pc";
  const results = await Promise.all([configureEquipmentUse(sword, { held: true, hands: 2 }), configureEquipmentUse(sword, { held: true, hands: 2 })]);
  assert.equal(results.filter(Boolean).length, 1);
  sword.isOwner = false;
  assert.equal(await configureEquipmentUse(sword, { held: false, hands: 0 }), false);
  assert.equal(await configureEquipmentUse(shield, { held: true, hands: -1 }), false);
  assert.equal(await configureEquipmentUse(shield, { held: true, hands: 0.5 }), false);
  assert.equal(equipmentGrip(sword).held, true);
});
