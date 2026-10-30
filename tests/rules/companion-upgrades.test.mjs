import assert from "node:assert/strict";
import test from "node:test";
import { COMPANION_UPGRADES, companionEffectActive, companionArmorUsable, companionFlight } from "../../module/rules/companion-upgrades.mjs";
test("source profiles distinguish forms, timed capacity and sensory recovery thresholds", () => {
  assert.equal(COMPANION_UPGRADES["automaton-armor-upgrade"].category, "light");
  assert.equal(COMPANION_UPGRADES["automaton-heavy-armor-upgrade"].category, "heavy");
  assert.equal(COMPANION_UPGRADES["automaton-cypher-upgrade"].durationSeconds, 86400);
  assert.equal(COMPANION_UPGRADES["beast-eyes"].recovery, "tenMinutes");
});
test("clock and completed-recovery stamps disable benefits before asynchronous cleanup", () => {
  const effect = { version: 1, id: "e", state: "active", key: "automaton-cypher-upgrade", endsAt: 100 };
  assert.equal(companionEffectActive(effect, {}, 99), true);
  assert.equal(companionEffectActive(effect, {}, 100), false);
  const armor = { ...effect, key: "automaton-armor-upgrade", recoveryRevision: 2 };
  assert.equal(companionEffectActive(armor, { companionRecoveries: { hour: 3 } }, 0), false);
  assert.equal(companionArmorUsable({ flags: { cypher: { companionEquipment: { kind: "armor", followerId: "slot" } } }, id: "suit" }, {
    companionEffects: { e: { ...armor, itemId: "suit", followerId: "slot", recoveryRevision: 0 } }
  }, 0), true);
});
test("flight carries only the source's twenty feet per round and turret form remains immobile", () => {
  assert.deepEqual(companionFlight({ installed: true, carrying: true }), { enabled: true, range: "", feet: 20, meters: 6 });
  assert.equal(companionFlight({ installed: true, mode: "turret" }).enabled, false);
});
