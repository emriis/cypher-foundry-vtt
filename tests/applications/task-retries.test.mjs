/** CRD Retrying a Task After Failure: each retry is a fresh paid-Effort action. */
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { retryTask, setTaskRetryPermission, closeInterruptedTaskRetry } from "../../module/applications/task-retry-service.mjs";
import { rerollMessage } from "../../module/applications/reroll-service.mjs";
import { createRoundFlow } from "../../module/rules/round-flow.mjs";
import { rollTask } from "../../module/applications/task-service.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor, messages, die, dice;
beforeEach(() => {
  messages = new Map(); die = 2; dice = 0;
  globalThis.game = { messages, user: { id: "user", isGM: false }, i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { warn() {}, error() {} } };
  globalThis.foundry = { utils: { escapeHTML: value => value } };
  function publish(data) { const message = { ...data, id: String(messages.size + 1), isOwner: true,
    getFlag(scope, key) { return this.flags?.[scope]?.[key]; }, async update(changes) { return applyDocumentUpdate(this, changes); } };
    messages.set(message.id, message); return message; }
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => publish(data) };
  globalThis.Roll = class { async evaluate() { dice++; this.total = die; return this; } async toMessage(data) { return publish(data); } };
  actor = { type: "pc", id: "pc", uuid: "Scene.scene.Token.token.Actor.pc", isOwner: true, flags: {}, items: new Map(),
    system: { tier: 1, effort: 2, hinderSteps: 0, armor: {}, customStats: [], xp: 5,
      stats: Object.fromEntries(["might", "speed", "intellect"].map(stat => [stat, { edge: 0, pool: { value: 20, max: 20 } }])) },
    async update(changes) { applyDocumentUpdate(this, changes); }
  };
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : null;
});

test("ordinary task cards preserve an explicit attempt identity and base inputs for later retries", async () => {
  const result = await rollTask(actor, { stat: "intellect", difficulty: 4, flavor: "Open this lock" });
  assert.equal(result.success, false);
  const message = [...messages.values()][0];
  assert.equal(message.flags.cypher.taskAttempt.version, 1);
  assert.equal(message.flags.cypher.taskAttempt.difficulty, 4);
  assert.equal(message.flags.cypher.taskAttempt.stat, "intellect");
  assert.equal(message.flags.cypher.actorUuid, actor.uuid);
});


const choices = { label: "Open this lock", duration: "one action", sameTaskConfirmed: true, effortLevels: 1 };
async function failure(options = {}) { await rollTask(actor, { stat: "intellect", difficulty: 4, ...options }); return [...messages.values()].at(-1); }

test("a retry is a new action with its own paid Effort, result and parent; no XP or old cost is refunded", async () => {
  const first = await failure({ effortLevels: 1 });
  assert.equal(actor.system.stats.intellect.pool.value, 17);
  const result = await retryTask(actor, first, choices);
  assert.equal(result.success, false); assert.equal(actor.system.stats.intellect.pool.value, 14);
  assert.equal(actor.system.xp, 5); assert.equal(first.flags.cypher.d20, 2);
  assert.equal(result.message.flags.cypher.taskAttempt.parentMessageId, first.id);
  assert.equal(first.flags.cypher.taskRetry.nextMessageId, result.message.id);
  assert.equal(await retryTask(actor, first, choices), null);
  assert.equal(dice, 2);
  assert.ok(await retryTask(actor, result.message, choices));
  assert.equal(actor.system.stats.intellect.pool.value, 11);
});

for (const options of [{ effortLevels: 0 }, { effortLevels: 0, freeEffortLevels: 1, freeEffortSource: "Confirmed source" },
  { effortLevels: -1 }, { effortLevels: 0.5 }, { effortLevels: Infinity }, { sameTaskConfirmed: false }, { duration: "" }]) {
  test(`invalid retry ${JSON.stringify(options)} spends nothing and leaves no checkpoint`, async () => {
    const first = await failure(); const before = structuredClone(actor.system);
    assert.equal(await retryTask(actor, first, { ...choices, ...options }), null);
    assert.deepEqual(actor.system, before); assert.equal(dice, 1);
    assert.equal(first.flags.cypher.taskRetry, undefined);
  });
}
test("Edge can reduce the point cost to zero but free Effort cannot replace the required paid level", async () => {
  const first = await failure(); actor.system.stats.intellect.edge = 3;
  assert.ok(await retryTask(actor, first, choices));
  assert.equal(actor.system.stats.intellect.pool.value, 20);
});
test("actual clamped Effort and insufficient Pool are rechecked before the checkpoint", async () => {
  const first = await failure(); actor.system.effort = 0;
  assert.equal(await retryTask(actor, first, choices), null);
  actor.system.effort = 1; actor.system.stats.intellect.pool.value = 2;
  assert.equal(await retryTask(actor, first, choices), null);
  assert.equal(first.flags.cypher.taskRetry, undefined); assert.equal(dice, 1);
});
test("a natural twenty refunds only this new action's cost, preserving the preceding failed action's expense", async () => {
  const first = await failure({ effortLevels: 1 }); die = 20;
  const result = await retryTask(actor, first, choices);
  assert.equal(result.success, true); assert.equal(actor.system.stats.intellect.pool.value, 17);
  assert.equal(actor.system.xp, 5); assert.equal(await retryTask(actor, result.message, choices), null);
});
test("the GM may forbid retries, including subsequent attempts after an ancestor veto", async () => {
  const first = await failure();
  assert.equal(await setTaskRetryPermission(first, { allowed: false }), false);
  game.user.isGM = true;
  assert.equal(await setTaskRetryPermission(first, { allowed: false, reason: "The mechanism is jammed" }), true);
  assert.equal(await retryTask(actor, first, choices), null);
  await setTaskRetryPermission(first, { allowed: true });
  const second = await retryTask(actor, first, choices);
  await setTaskRetryPermission(first, { allowed: false });
  assert.equal(await retryTask(actor, second.message, choices), null);
});
test("a successful retained paid reroll closes retry eligibility, including on later failed attempts", async () => {
  const first = await failure(); const second = await retryTask(actor, first, choices);
  die = 20; await rerollMessage(actor, first);
  assert.equal(first.flags.cypher.originalRoll, 20);
  assert.equal(await retryTask(actor, second.message, choices), null);
});
test("the same failed attempt cannot be retried twice by overlapping activation", async () => {
  const first = await failure();
  const results = await Promise.all([retryTask(actor, first, choices), retryTask(actor, first, choices)]);
  assert.equal(results.filter(Boolean).length, 1); assert.equal(dice, 2);
});
test("managed rounds reject reuse of a spent action and the following round spends a fresh slot", async () => {
  const first = await failure();
  const combat = { id: "combat", started: true, round: 1, flags: { cypher: { roundFlow: createRoundFlow(["pc"], [], 1) } },
    combatants: new Map([["pc", { id: "pc", actor }]]) };
  combat.flags.cypher.roundFlow.cursor = 0;
  game.combat = combat;
  await actor.update({ "flags.cypher.roundActionUsage": { combatId: combat.id, stepId: combat.flags.cypher.roundFlow.queue[0].id, primary: true, activity: false } });
  assert.equal(await retryTask(actor, first, choices), null);
  assert.equal(first.flags.cypher.taskRetry, undefined);
  combat.round = 2; combat.flags.cypher.roundFlow = createRoundFlow(["pc"], [], 2);
  combat.flags.cypher.roundFlow.cursor = 0;
  assert.ok(await retryTask(actor, first, choices));
  assert.equal(actor.flags.cypher.roundActionUsage.primary, true);
});
test("interrupted writes persist across reload and cannot spend or roll twice", async () => {
  const first = await failure();
  actor.update = async () => { throw Error("Pool write failed"); };
  await assert.rejects(retryTask(actor, first, choices), /Pool write failed/);
  assert.equal(first.flags.cypher.taskRetry.state, "pending");
  first.flags = JSON.parse(JSON.stringify(first.flags));
  assert.equal(await retryTask(actor, first, choices), null); assert.equal(dice, 1);
  assert.equal(await closeInterruptedTaskRetry(first, { reconciled: true }), false);
  game.user.isGM = true;
  assert.equal(await closeInterruptedTaskRetry(first), false);
  assert.equal(await closeInterruptedTaskRetry(first, { reconciled: true }), true);
  assert.equal(await retryTask(actor, first, choices), null);
});
test("synthetic identity, permissions and recorded duration survive serialization without a base-Actor fallback", async () => {
  const first = await failure();
  first.flags = JSON.parse(JSON.stringify(first.flags));
  assert.equal(await retryTask({ ...actor, uuid: "Actor.pc" }, first, choices), null);
  actor.isOwner = false; assert.equal(await retryTask(actor, first, choices), null); actor.isOwner = true;
  first.isOwner = false; assert.equal(await retryTask(actor, first, choices), null); first.isOwner = true;
  const second = await retryTask(actor, first, choices);
  assert.equal(await retryTask(actor, second.message, { ...choices, duration: "one minute" }), null);
});
test("legacy cards and specialized actions are never reconstructed as ordinary retries", async () => {
  const first = await failure(); delete first.flags.cypher.taskAttempt;
  assert.equal(await retryTask(actor, first, choices), null);
  const attack = await failure({ isAttack: true });
  assert.equal(attack.flags.cypher.taskAttempt, undefined);
  const minor = await failure({ minorActivity: true });
  assert.equal(minor.flags.cypher.taskAttempt, undefined);
});


test("a missing original Actor cannot substitute a world Actor or charge an orphaned document", async () => {
  const first = await failure(); globalThis.fromUuid = async () => null;
  assert.equal(await retryTask(actor, first, choices), null);
  assert.equal(first.flags.cypher.taskRetry, undefined);
  assert.equal(actor.system.stats.intellect.pool.value, 20);
});
test("chat publication failure retains committed cost and blocks replay after reload", async () => {
  const first = await failure(); Roll.prototype.toMessage = async () => { throw Error("chat failed"); };
  await assert.rejects(retryTask(actor, first, choices), /chat failed/);
  assert.equal(actor.system.stats.intellect.pool.value, 17);
  assert.equal(first.flags.cypher.taskRetry.state, "pending");
  assert.equal(await retryTask(actor, first, choices), null);
  assert.equal(dice, 2);
});
test("a final predecessor write failure blocks descendants until explicit reconciliation", async () => {
  const first = await failure(); const update = first.update.bind(first);
  first.update = async changes => {
    if (changes["flags.cypher.taskRetry"]?.state === "done") throw Error("link write failed");
    return update(changes);
  };
  await assert.rejects(retryTask(actor, first, choices), /link write/);
  const second = [...messages.values()].at(-1);
  assert.equal(await retryTask(actor, second, choices), null);
  assert.equal(actor.system.stats.intellect.pool.value, 17);
  game.user.isGM = true;
  assert.ok(await closeInterruptedTaskRetry(first, { reconciled: true }));
  assert.ok(await retryTask(actor, second, choices));
});
test("declared help is selected fresh and consumed once by the new task", async () => {
  const first = await failure();
  actor.flags.cypher = { generalEffects: [{ id: "help", kind: "help", assets: 1, sourceUuid: "Actor.helper", taskLabel: "Lock", until: null }] };
  const result = await retryTask(actor, first, { ...choices, cooperativeMode: "help", cooperativeEffectIds: ["help"] });
  assert.equal(result.effectiveDifficulty, 2);
  assert.deepEqual(actor.flags.cypher.generalEffects, []);
});
