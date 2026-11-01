import assert from "node:assert/strict";
import test from "node:test";
import { commandTiming, calmActive, commandRecoveryUpdates } from "../../module/rules/command-powers.mjs";

test("Lighting promotes ordinary actions but only normalizes Last actions", () => {
  assert.equal(commandTiming("action"), "firstAction");
  assert.equal(commandTiming("lastAction"), "action");
  assert.equal(commandTiming("firstAction"), "firstAction");
});
test("Soothe expires with recovery; maintenance requires consecutive declared source turns", () => {
  const record = { version: 1, state: "active", mode: "rest", revision: 0 };
  assert.equal(calmActive(record, 0), true);
  assert.equal(calmActive(record, 1), false);
  const maintained = { ...record, mode: "maintain", until: { combatId: "fight", combatantId: "source", revision: 3 } };
  assert.equal(calmActive(maintained, 1, { id: "fight", revisions: { source: 2 } }), true);
  assert.equal(calmActive(maintained, 1, { id: "fight", revisions: { source: 3 } }), false);
  assert.equal(calmActive(maintained, 1, { id: "other", revisions: { source: 2 } }), false);
});
test("ten-minute or longer recoveries renew Lighting and expire automatic Soothe in one revision", () => {
  assert.deepEqual(commandRecoveryUpdates({}, "action"), {});
  assert.deepEqual(commandRecoveryUpdates({ commandRecoveryRevision: 2 }, "hour"), { "flags.cypher.commandRecoveryRevision": 3 });
});
