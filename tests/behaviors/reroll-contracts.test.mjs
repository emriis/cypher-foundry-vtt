// CRD > Spending Experience Points > Rerolling; Artifacts > Depletion.
import assert from "node:assert/strict";
import test from "node:test";
import { rerollMessage } from "../../module/applications/character-service.mjs";

function scenario(flags, values = [10]) {
  const messages = [], formulas = [];
  globalThis.game = { i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {}, warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}) };
  globalThis.Roll = class {
    constructor(formula) { formulas.push(formula); }
    async evaluate() { this.total = values.shift(); return this; }
    async toMessage(message) { messages.push(message); return message; }
  };
  const item = { system: { depleted: true }, async update(change) {
    this.system.depleted = change["system.depleted"];
  } };
  const actor = { id: "pc", type: "pc", items: new Map([["item", item]]),
    system: { xp: 5 }, async update(change) {
      if (change["system.xp"] !== undefined) this.system.xp = change["system.xp"];
    } };
  const message = { flags: { cypher: { rerollable: true, ...flags } },
    getFlag(namespace, key) { return this.flags[namespace]?.[key]; },
    async update(change) { this.flags.cypher = change["flags.cypher"]; } };
  return { actor, item, message, messages, formulas };
}

test("Given a task reroll, when it is rerolled again, then each roll costs 1 XP and retains the best d20", async () => {
  const c = scenario({ rollType: "task", d20: 4, effectiveDifficulty: 2, targetNumber: 6 }, [12, 3]);
  await rerollMessage(c.actor, c.message);
  const flags = c.messages[0].flags.cypher;
  assert.equal(flags.rerollable, true);
  assert.equal(flags.d20, 12);
  assert.equal(c.message.flags.cypher.d20, 12, "the original card must also remember the best result");
  await rerollMessage(c.actor, c.message);
  assert.equal(c.actor.system.xp, 3);
  assert.equal(c.messages[1].flags.cypher.d20, 12);
});

test("Given depletion 2–4 on d6, when a 3 is rerolled to 1, then the non-depleting result wins and restores the Item", async () => {
  const c = scenario({ rollType: "depletion", itemId: "item", dieMax: 6,
    depletionMin: 2, depletionMax: 4, originalRoll: 3 }, [1]);
  await rerollMessage(c.actor, c.message);
  assert.equal(c.item.system.depleted, false);
  assert.deepEqual(c.formulas, ["1d6"]);
  assert.equal(c.messages[0].flags.cypher.originalRoll, 1);
});

test("Given a recovery roll, when it is rerolled, then its original formula and highest recovery value are retained", async () => {
  const c = scenario({ rollType: "recovery", rollFormula: "1d6 + 2", originalRoll: 6 }, [4]);
  await rerollMessage(c.actor, c.message);
  assert.deepEqual(c.formulas, ["1d6 + 2"]);
  assert.equal(c.messages[0].flags.cypher.originalRoll, 6);
});

test("Given a paid task, when a reroll retains natural 20, then its original Pool cost is refunded only once", async () => {
  const c = scenario({ rollType: "task", d20: 4, effectiveDifficulty: 2, targetNumber: 6,
    stat: "might", effortCost: 3, costRefunded: false }, [20, 20]);
  c.actor.system.stats = { might: { pool: { value: 7, max: 10 }, edge: 0 } };
  const update = c.actor.update.bind(c.actor);
  c.actor.update = async change => {
    await update(change);
    if (change["system.stats.might.pool.value"] !== undefined) {
      c.actor.system.stats.might.pool.value = change["system.stats.might.pool.value"];
    }
  };
  await rerollMessage(c.actor, c.message);
  assert.equal(c.actor.system.stats.might.pool.value, 10);
  c.actor.system.stats.might.pool.value = 6;
  await rerollMessage(c.actor, c.message);
  assert.equal(c.actor.system.stats.might.pool.value, 6, "the same action cannot refund twice");
  assert.equal(c.actor.system.xp, 3, "natural 20 does not refund XP spent on rerolls");
});

test("Given malformed metadata, when a reroll is requested, then no XP is spent and no roll is evaluated", async () => {
  for (const flags of [{ rollType: "unknown" }, { rollType: "task", d20: undefined },
    { rollType: "depletion", itemId: "item", dieMax: 6, depletionMin: 4, depletionMax: 2, originalRoll: 3 }]) {
    const c = scenario(flags);
    await rerollMessage(c.actor, c.message);
    assert.equal(c.actor.system.xp, 5);
    assert.deepEqual(c.formulas, []);
    assert.deepEqual(c.messages, []);
  }
});

test("Given overlapping reroll requests, when both are activated, then only one spends XP", async () => {
  const c = scenario({ rollType: "task", d20: 4, effectiveDifficulty: 2, targetNumber: 6 }, [12]);
  const results = await Promise.all([rerollMessage(c.actor, c.message), rerollMessage(c.actor, c.message)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(c.actor.system.xp, 4);
  assert.equal(c.messages.length, 1);
});

test("Given a depletion write failure, when rerolled, then no success card is published and the next request can run", async () => {
  const c = scenario({ rollType: "depletion", itemId: "item", dieMax: 6,
    depletionMin: 1, depletionMax: 2, originalRoll: 1 }, [5, 6]);
  const update = c.item.update.bind(c.item);
  c.item.update = async () => { throw new Error("Item write failed"); };
  await assert.rejects(rerollMessage(c.actor, c.message), /Item write failed/);
  assert.equal(c.actor.system.xp, 4, "accepted XP remains spent after a later failure");
  assert.deepEqual(c.messages, []);
  assert.equal(c.message.flags.cypher.originalRoll, 1);
  c.item.update = update;
  assert.ok(await rerollMessage(c.actor, c.message));
  assert.equal(c.actor.system.xp, 3);
  assert.equal(c.item.system.depleted, false);
});

test("Given an unordered Cypher table, when rerolled, then the player's choice determines the better result", async () => {
  const c = scenario({ rollType: "cypherTable", itemId: "item", tableId: "table",
    rollFormula: "1d100", originalRoll: 80 }, [10]);
  c.item.system.rollTables = [{ id: "table", name: "Table", results: [
    { min: 1, max: 50, description: "Low-number preferred result" },
    { min: 51, max: 100, description: "High-number result" }
  ] }];
  globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { ux: { TextEditor: {
    implementation: { enrichHTML: async value => value }
  } } } };
  await rerollMessage(c.actor, c.message, { chooseResult: async () => "new" });
  assert.deepEqual(c.formulas, ["1d100"]);
  assert.equal(c.messages[0].flags.cypher.originalRoll, 10);
  assert.match(c.messages[0].flavor, /Low-number preferred result/);
  assert.equal(c.item.system.depleted, true, "a reroll does not consume another Cypher");
});
