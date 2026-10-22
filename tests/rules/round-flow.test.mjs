import assert from "node:assert/strict";
import test from "node:test";
import { createRoundFlow, roundActionKind, holdRoundTurn, resumeRoundTurn, completeRoundStep } from "../../module/rules/round-flow.mjs";

test("First, normal, Follow-up and Last phases preserve initiative within each phase", () => {
  const flow = createRoundFlow(["a", "b", "c", "d"], [
    { combatantId: "b", mode: "last", confirmed: true }, { combatantId: "c", mode: "first", confirmed: true },
    { combatantId: "d", mode: "first", confirmed: true }
  ]);
  assert.deepEqual(flow.queue.map(entry => [entry.combatantId, entry.phase]), [
    ["c", "first"], ["d", "first"], ["a", "normal"], ["c", "followUp"], ["d", "followUp"], ["b", "last"]
  ]);
  assert.deepEqual(createRoundFlow(["a", "b", "c", "d"], [], 2).queue.map(entry => entry.combatantId), ["a", "b", "c", "d"]);
});

test("a light First action can instead be used as an ordinary action", () => {
  const flow = createRoundFlow(["a"]); flow.cursor = 0;
  assert.equal(roundActionKind(flow, "a", { isAttack: true, actionTiming: "firstAction" }), "primary");
  assert.equal(roundActionKind(flow, "a", { isAttack: true, actionTiming: "lastAction" }), null);
});

test("Follow-up admits only one explicitly minor non-attack activity", () => {
  const flow = createRoundFlow(["a"], [{ combatantId: "a", mode: "first", confirmed: true }]); flow.cursor = 1;
  assert.equal(roundActionKind(flow, "a", { isAttack: true, minorActivity: true }), null);
  assert.equal(roundActionKind(flow, "a", {}), null);
  assert.equal(roundActionKind(flow, "a", { minorActivity: true }), "activity");
  flow.queue[1].activityUsed = true;
  assert.equal(roundActionKind(flow, "a", { minorActivity: true }), null);
});

test("Last actions exclude a separate minor activity but permit granted extra actions", () => {
  const flow = createRoundFlow(["a"], [{ combatantId: "a", mode: "last", confirmed: true }]); flow.cursor = 0;
  assert.equal(roundActionKind(flow, "a", { minorActivity: true }), null);
  assert.equal(roundActionKind(flow, "a", { isAttack: true, actionTiming: "lastAction" }), "primary");
  flow.queue[0].used = true;
  assert.equal(roundActionKind(flow, "a", { isAttack: true, actionTiming: "lastAction" }), null);
  assert.equal(roundActionKind(flow, "a", { isAttack: true, actionTiming: "action", extraAction: true }), "extra");
});

test("waiting preserves one turn and a conditional resumption requires confirmation", () => {
  const flow = createRoundFlow(["a", "b"]); flow.cursor = 0;
  const held = holdRoundTurn(flow, "the door opens");
  assert.deepEqual(held.queue.map(entry => entry.combatantId), ["b"]);
  held.cursor = 0;
  assert.equal(resumeRoundTurn(held, "a", false), null);
  const resumed = resumeRoundTurn(held, "a", true);
  assert.deepEqual(resumed.queue.map(entry => entry.combatantId), ["a", "b"]);
  assert.equal(resumed.waiting.length, 0);
  assert.equal(resumeRoundTurn(resumed, "a", true), null);
});

test("a whole preparatory round permits any action as First only on the following round", () => {
  const flow = createRoundFlow(["a"], [{ combatantId: "a", mode: "prepare", confirmed: true }]); flow.cursor = 0;
  assert.equal(roundActionKind(flow, "a", { isAttack: true }), null);
  const completed = completeRoundStep(flow);
  const next = createRoundFlow(["a"], [], 2, completed.prepared); next.cursor = 0;
  assert.equal(next.queue[0].phase, "first");
  assert.equal(roundActionKind(next, "a", { isAttack: true, actionTiming: "lastAction" }), "primary");
  assert.equal(createRoundFlow(["a"], [], 3, completed.prepared).queue[0].phase, "normal");
});

test("invalid, duplicate and unconfirmed timing declarations reject before scheduling", () => {
  assert.equal(createRoundFlow(["a"], [{ combatantId: "a", mode: "first" }]), null);
  assert.equal(createRoundFlow(["a"], [{ combatantId: "other", mode: "normal" }]), null);
  assert.equal(createRoundFlow(["a", "a"]), null);
});
