import assert from "node:assert/strict";
import test from "node:test";
import { runActorAction, runActorActions } from "../../module/applications/action-guard.mjs";

test("nested services need an explicit parent context and cannot recursively reactivate their category", async () => {
  const actor = {};
  await runActorAction(actor, "outer", async context => {
    assert.equal(await runActorAction(actor, "other", () => true), null);
    assert.equal(await runActorAction(actor, "outer", () => true, context), null);
    assert.equal(await runActorAction(actor, "inner", () => 7, context), 7);
  });
  assert.equal(await runActorAction(actor, "outer", () => 8), 8);
});

test("failed multi-owner preflight reserves nothing and exceptions release every accepted owner", async () => {
  const first = {}, target = {};
  await runActorAction(target, "busy", async () => {
    assert.equal(await runActorActions([first, target], "attack", () => true), null);
    assert.equal(await runActorAction(first, "available", () => true), true);
  });
  await assert.rejects(runActorActions([first, target, first], "attack", () => { throw new Error("write failed"); }), /write failed/);
  assert.equal(await runActorActions([first, target], "attack", () => true), true);
});
