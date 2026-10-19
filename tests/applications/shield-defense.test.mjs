/** CRD / Rules of the Game / Defending / Armor and Shields, paragraphs 7930–7935. */
import assert from "node:assert/strict";
import test from "node:test";
import { shieldAbsorbWound } from "../../module/applications/damage-service.mjs";
import { rollDefense } from "../../module/applications/task-service.mjs";
import { toggleEquipped } from "../../module/applications/equipment-service.mjs";
import { rollNpcAttack } from "../../module/applications/npc-combat-service.mjs";

function fixture() {
  const messages = [];
  let dice = 0;
  globalThis.game = { i18n: { localize: key => key, format: (key, values) => `${key}:${JSON.stringify(values)}` } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async message => messages.push(message) };
  globalThis.foundry = { utils: { escapeHTML: value => value.replaceAll("<", "&lt;").replaceAll(">", "&gt;") } };
  globalThis.Roll = class {
    async evaluate() { dice++; this.total = 10; return this; }
    async toMessage(message) { messages.push(message); }
  };
  const update = async function(changes) {
    this.updates.push(changes);
    for (const [path, value] of Object.entries(changes)) {
      const parts = path.split(".");
      let target = this;
      for (const part of parts.slice(0, -1)) target = target[part];
      target[parts.at(-1)] = value;
    }
  };
  const wounds = () => ({ minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 } });
  const actor = {
    id: "pc", uuid: "Actor.pc", type: "pc", isOwner: true, items: new Map(), updates: [],
    system: { effort: 2, hinderSteps: 0, armor: {}, wounds: wounds(),
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { pool: { value: 10, max: 10 }, edge: 0 }])),
      customStats: [] },
    statuses: new Set(), async toggleStatusEffect() {}, update
  };
  const shield = { id: "shield", actor, name: "Shield", type: "shield", isOwner: true,
    system: { equipped: true, wounds: wounds() }, updates: [], update };
  actor.items.set(shield.id, shield);
  return { actor, shield, messages, dice: () => dice };
}

test("a major shield wound destroys and unequips it in the same write, without wounding its owner", async () => {
  const { actor, shield, messages } = fixture();
  assert.equal(await shieldAbsorbWound(actor, shield, "major"), true);
  assert.equal(shield.system.wounds.major.current, 1);
  assert.equal(shield.system.equipped, false);
  assert.equal(shield.updates.length, 1);
  assert.equal(actor.updates.length, 0);
  assert.equal(messages.length, 1);
  assert.equal(await shieldAbsorbWound(actor, shield, "minor"), false);
  assert.equal(messages.length, 1);
});

for (const reason of ["unequipped", "broken", "wrong-type", "foreign", "actor-permission", "item-permission", "invalid-severity"]) {
  test(`shield absorption rejects ${reason} without writes or chat`, async () => {
    const { actor, shield, messages } = fixture();
    if (reason === "unequipped") shield.system.equipped = false;
    if (reason === "broken") shield.system.wounds.major.current = 1;
    if (reason === "wrong-type") shield.type = "armor";
    if (reason === "foreign") actor.items.delete(shield.id);
    if (reason === "actor-permission") actor.isOwner = false;
    if (reason === "item-permission") shield.isOwner = false;
    assert.equal(await shieldAbsorbWound(actor, shield, reason === "invalid-severity" ? "unknown" : "minor"), false);
    assert.equal(shield.updates.length + actor.updates.length + messages.length, 0);
  });
}

test("an unavailable selected shield rejects the defense before Effort or dice", async () => {
  const { actor, shield, messages, dice } = fixture();
  shield.system.equipped = false;
  assert.equal(await rollDefense(actor, "block", { shieldItemId: shield.id, effortLevels: 1 }), null);
  assert.equal(actor.system.stats.might.pool.value, 10);
  assert.equal(actor.updates.length + shield.updates.length + messages.length + dice(), 0);
});

test("after a shield breaks, the remaining successful Blocks reduce wounds on the character", async () => {
  const { actor, shield, messages } = fixture();
  const result = await rollDefense(actor, "block", { difficulty: 1, shieldItemId: shield.id,
    incomingSeverity: "major", incomingWounds: 2 });
  assert.equal(result.success, true);
  assert.equal(shield.system.wounds.major.current, 1);
  assert.equal(shield.system.equipped, false);
  assert.equal(actor.system.wounds.moderate.current, 1);
  assert.equal(actor.system.wounds.major.current, 0);
  assert.equal(messages.filter(message => message.content?.includes("Broken")).length, 1);
  assert.match(messages.at(-1).flavor, /RemainingReduced/);
  assert.match(messages.at(-1).flavor, /AbsorbedCount/);
  assert.equal(messages.at(-1).flags.cypher.shieldWoundsAbsorbed, 1);
});

test("a destroyed shield cannot be equipped again through the equipment service", async () => {
  const { shield } = fixture();
  shield.system.equipped = false;
  shield.system.wounds.major.current = 1;
  assert.equal(await toggleEquipped(shield), false);
  assert.equal(shield.updates.length, 0);
});

test("concurrent shield absorption accepts only one pending action", async () => {
  const { actor, shield } = fixture();
  const update = shield.update;
  let release;
  shield.update = async changes => {
    if (!release) await new Promise(resolve => { release = resolve; });
    await update.call(shield, changes);
  };
  const first = shieldAbsorbWound(actor, shield, "minor");
  assert.equal(await shieldAbsorbWound(actor, shield, "minor"), false);
  release();
  assert.equal(await first, true);
  assert.equal(shield.system.wounds.minor.current, 1);
});

test("a chosen shield absorbs a wound from the NPC attack entrypoint", async () => {
  const { actor, shield } = fixture();
  const npc = { type: "npc", system: { level: 1 } };
  const result = await rollNpcAttack(npc, { damage: { mode: "wound", severity: "moderate", wounds: 1 } },
    { target: actor, defenseType: "block", shieldItemId: shield.id });
  assert.equal(result.defense.success, true);
  assert.equal(shield.system.wounds.moderate.current, 1);
  assert.equal(actor.system.wounds.minor.current, 0);
});

test("six minor hits fill three minor slots, two moderate slots, then destroy the shield", async () => {
  const { actor, shield } = fixture();
  for (let index = 0; index < 6; index++) assert.equal(await shieldAbsorbWound(actor, shield, "minor"), true);
  assert.deepEqual(Object.values(shield.system.wounds).map(track => track.current), [3, 2, 1]);
  assert.equal(shield.system.equipped, false);
  assert.equal(actor.updates.length, 0);
});

test("a shield lost during the die evaluation cannot absorb the resolved wound", async () => {
  const { actor, shield, messages } = fixture();
  globalThis.Roll = class {
    async evaluate() { actor.items.delete(shield.id); this.total = 10; return this; }
    async toMessage(message) { messages.push(message); }
  };
  await rollDefense(actor, "block", { difficulty: 1, incomingSeverity: "moderate", shieldItemId: shield.id });
  assert.equal(shield.updates.length, 0);
  assert.equal(actor.system.wounds.minor.current, 1);
  assert.doesNotMatch(messages.at(-1).flavor, /Shield.Absorbed/);
});

test("a failed shield write propagates without publishing absorption or destruction", async () => {
  const { actor, shield, messages } = fixture();
  shield.update = async () => { throw new Error("write rejected"); };
  await assert.rejects(rollDefense(actor, "block", { difficulty: 1, incomingSeverity: "major", shieldItemId: shield.id }), /write rejected/);
  assert.equal(shield.system.wounds.major.current, 0);
  assert.equal(messages.length, 0);
  assert.equal(actor.updates.length, 0);
});

for (const [mode, difficulty, expectedPc] of [["block", 1, "minor"], ["block", 10, "moderate"], ["dodge", 1, null]]) {
  test(`${mode} at difficulty ${difficulty} resolves without involuntary shield absorption`, async () => {
    const { actor, shield } = fixture();
    await rollDefense(actor, mode, { difficulty, incomingSeverity: "moderate" });
    assert.equal(shield.updates.length, 0);
    assert.equal(actor.system.wounds.minor.current, expectedPc === "minor" ? 1 : 0);
    assert.equal(actor.system.wounds.moderate.current, expectedPc === "moderate" ? 1 : 0);
  });
}
