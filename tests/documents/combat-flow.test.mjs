/** Exercise the real Combat adapter and saved round services with document writes and boundary hooks. */
import assert from "node:assert/strict";
import test from "node:test";

function merge(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) merge(target[key] ??= {}, value);
    else target[key] = value;
  }
}
globalThis.game = { user: { id: "gm", isGM: true }, i18n: { localize: key => key }, users: { activeGM: { id: "gm" } } };
globalThis.ui = { notifications: { warn() {} } };
globalThis.foundry = { documents: { Combat: class {
  constructor() {
    this.id = "combat"; this.isOwner = true; this.round = 0; this.turn = null;
    this.flags = { cypher: { roundFlow: { version: 1, round: 1, plans: [{ combatantId: "slow", mode: "first", confirmed: true }] } } };
    this.turns = ["fast", "medium", "slow"].map((id, index) => ({ id, initiative: 18 - index * 6, isOwner: true,
      actor: { uuid: `Actor.${id}`, type: "pc", isOwner: true, flags: { cypher: {} } } }));
    this.combatants = new Map(this.turns.map(entry => [entry.id, entry]));
  }
  get combatant() { return this.turns[this.turn]; }
  get started() { return this.round > 0; }
  async startCombat() { this.round = 1; this.turn = 0; return this; }
  async nextTurn() { this.turn++; return this; }
  async update(patch, options = {}) {
    stampGeneralTurnRevision(this, patch, options);
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split("."); let cursor = this;
      for (const key of parts.slice(0, -1)) cursor = cursor[key] ??= {};
      if (value && typeof value === "object" && !Array.isArray(value)) merge(cursor[parts.at(-1)] ??= {}, value);
      else cursor[parts.at(-1)] = value;
    }
    return this;
  }
} } };
const { stampGeneralTurnRevision } = await import("../../module/applications/general-effect-service.mjs");
const { planCombatRound, waitCombatTurn, resumeCombatTurn, getRoundFlow } = await import("../../module/applications/round-flow-service.mjs");
const { roundActionContext, consumeRoundAction } = await import("../../module/applications/round-action-service.mjs");
const { default: CypherCombat } = await import("../../module/documents/combat.mjs");

test("a declared First action starts ahead of normal initiative without rewriting scores", async () => {
  const combat = new CypherCombat();
  await combat.startCombat();
  assert.equal(combat.combatant.id, "slow");
  assert.deepEqual(combat.turns.map(entry => entry.initiative), [18, 12, 6]);
});

function setup() {
  const combat = new CypherCombat(); game.combat = combat; game.user.isGM = true;
  for (const entry of combat.turns) entry.actor.update = async function(patch) {
    for (const [path, value] of Object.entries(patch)) {
      const parts = path.split("."); let cursor = this;
      for (const key of parts.slice(0, -1)) cursor = cursor[key] ??= {};
      cursor[parts.at(-1)] = value;
    }
  };
  return combat;
}

test("follow-up is not a second source turn and the next round restores initiative order", async () => {
  const combat = setup(); await combat.startCombat();
  assert.equal(combat.flags.cypher.turnRevisions.slow, 1);
  const order = [combat.combatant.id];
  for (let i = 0; i < 3; i++) { await combat.nextTurn(); order.push(combat.combatant.id); }
  assert.deepEqual(order, ["slow", "fast", "medium", "slow"]);
  assert.equal(combat.flags.cypher.turnRevisions.slow, 1);
  await combat.nextTurn();
  assert.equal(combat.round, 2); assert.equal(combat.combatant.id, "fast");
});

test("player-owned usage persists without requiring permission to update the Combat", async () => {
  const combat = setup(); await combat.startCombat(); game.user.isGM = false;
  const actor = combat.combatant.actor;
  combat.update = async () => { throw Error("Players cannot update Combat"); };
  assert.equal(await consumeRoundAction(roundActionContext(actor)), true);
  assert.equal(roundActionContext(actor).kind, null);
  assert.equal(roundActionContext(actor, { defenseType: "dodge" }), null);
  assert.equal(roundActionContext(combat.turns[0].actor).kind, null);
  game.user.isGM = true;
});

test("waiting resumes exactly once before the trigger without duplicating source boundaries", async () => {
  const combat = setup(); await planCombatRound(combat, []); await combat.startCombat();
  assert.equal(await waitCombatTurn(combat, { trigger: "door opens" }), true);
  assert.equal(combat.combatant.id, "medium");
  assert.equal(await resumeCombatTurn(combat, "fast"), false);
  assert.equal(await resumeCombatTurn(combat, "fast", { triggerConfirmed: true }), true);
  assert.equal(combat.flags.cypher.turnRevisions.fast, 1);
  assert.equal(await resumeCombatTurn(combat, "fast", { triggerConfirmed: true }), false);
  await combat.nextTurn(); assert.equal(combat.combatant.id, "medium");
  assert.equal(combat.flags.cypher.turnRevisions.medium, 1);
});

test("source effects expire at their primary boundary before deciding whether a turn is lost", async () => {
  const combat = setup(); await planCombatRound(combat, []);
  const actor = combat.turns[0].actor;
  actor.flags.cypher.generalEffects = [{ id: "stun", kind: "stunned", until: {
    combatId: combat.id, combatantId: "fast", turnRevision: 1 } }];
  await combat.startCombat();
  assert.equal(combat.combatant.id, "fast");
  assert.equal(getRoundFlow(combat).queue[0].skipped, undefined);
});

test("a persistent stun skips First and Follow-up; all skipped encounters terminate without recursion", async () => {
  const combat = setup();
  for (const entry of combat.turns) entry.actor.flags.cypher.generalEffects = [{ id: "stun", kind: "stunned" }];
  await combat.startCombat(); assert.equal(combat.combatant, undefined);
  assert.equal(getRoundFlow(combat).cursor, 4);
  await combat.nextTurn(); assert.equal(combat.round, 2);
});

test("a saved shield skip retries failed flag cleanup before advancing to another round", async () => {
  const combat = setup(); await planCombatRound(combat, []);
  const actor = combat.turns[0].actor, update = actor.update;
  actor.flags.cypher.shieldTurnLossPending = true;
  actor.update = async () => { throw Error("write failed"); };
  await assert.rejects(combat.startCombat(), /write failed/);
  assert.equal(combat.combatant.id, "medium");
  assert.deepEqual(getRoundFlow(combat).shieldLosses, [{ combatantId: "fast", revision: 0 }]);
  actor.update = update; await combat.nextTurn();
  assert.equal(actor.flags.cypher.shieldTurnLossPending, false);
});

test("rewinding presentation never recreates a completed action or increments the turn clock", async () => {
  const combat = setup(); await planCombatRound(combat, []); await combat.startCombat();
  await combat.nextTurn(); const before = structuredClone(combat.flags.cypher.turnRevisions);
  await combat.previousTurn();
  assert.equal(roundActionContext(combat.combatant.actor).kind, null);
  assert.deepEqual(combat.flags.cypher.turnRevisions, before);
});

test("planning and progression reject a player and deleted combatants are skipped", async () => {
  const combat = setup(); game.user.isGM = false;
  assert.equal(await planCombatRound(combat, []), false);
  await combat.startCombat(); assert.equal(combat.round, 0);
  game.user.isGM = true; await combat.startCombat();
  combat.combatants.delete("fast"); await combat.nextTurn();
  assert.equal(combat.combatant.id, "medium");
});


test("advancing after a rewind returns to the saved present without rebuilding spent phases", async () => {
  const combat = setup(); await combat.startCombat();
  await combat.nextTurn(); await combat.nextTurn(); await combat.nextTurn();
  await consumeRoundAction(roundActionContext(combat.combatant.actor, { minorActivity: true }));
  const present = getRoundFlow(combat).cursor;
  await combat.previousTurn(); await combat.previousTurn();
  await combat.nextTurn();
  assert.equal(getRoundFlow(combat).cursor, present);
  assert.equal(roundActionContext(combat.combatant.actor, { minorActivity: true }).kind, null);
  assert.equal(getRoundFlow(combat).rewindAnchor, null);
});

test("cleanup of a previously skipped shield loss cannot clear a later shield hit", async () => {
  const combat = setup(); await planCombatRound(combat, []);
  const actor = combat.turns[0].actor;
  actor.flags.cypher.shieldTurnLossPending = true;
  actor.flags.cypher.shieldTurnLossRevision = 1;
  await combat.startCombat();
  actor.flags.cypher.shieldTurnLossPending = true;
  actor.flags.cypher.shieldTurnLossRevision = 2;
  await combat.nextTurn();
  assert.equal(actor.flags.cypher.shieldTurnLossPending, true);
});


test("stale or overlapping usage requests cannot overwrite a spent minor activity", async () => {
  const combat = setup(); await planCombatRound(combat, []); await combat.startCombat();
  const actor = combat.combatant.actor, stale = roundActionContext(actor);
  assert.equal(await consumeRoundAction(roundActionContext(actor, { minorActivity: true })), true);
  assert.equal(await consumeRoundAction(stale), false);
  const results = await Promise.all([consumeRoundAction(roundActionContext(actor)), consumeRoundAction(roundActionContext(actor))]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(actor.flags.cypher.roundActionUsage.activity, true);
});


test("a spent action or minor activity cannot be held as an unspent waiting turn", async () => {
  for (const options of [{}, { minorActivity: true }]) {
    const combat = setup(); await planCombatRound(combat, []); await combat.startCombat();
    await consumeRoundAction(roundActionContext(combat.combatant.actor, options));
    assert.equal(await waitCombatTurn(combat), false);
    assert.equal(combat.combatant.id, "fast");
  }
});

test("deleting a combatant from next-round declarations cannot freeze round progression", async () => {
  const combat = setup(); await planCombatRound(combat, []); await combat.startCombat();
  await planCombatRound(combat, [{ combatantId: "slow", mode: "last", confirmed: true }]);
  combat.combatants.delete("slow"); combat.turns = combat.turns.filter(entry => entry.id !== "slow");
  await combat.nextTurn(); await combat.nextTurn(); await combat.nextTurn();
  assert.equal(combat.round, 2);
  assert.equal(combat.combatant.id, "fast");
});


test("completing a preparatory slot grants next-round First timing without granting a second action", async () => {
  const combat = setup();
  await planCombatRound(combat, [{ combatantId: "slow", mode: "prepare", confirmed: true }]);
  await combat.startCombat(); await combat.nextTurn(); await combat.nextTurn();
  assert.equal(roundActionContext(combat.combatant.actor).kind, null);
  await combat.nextTurn();
  assert.equal(combat.round, 2); assert.equal(combat.combatant.id, "slow");
  assert.equal(getRoundFlow(combat).queue[0].readied, true);
  assert.equal(await consumeRoundAction(roundActionContext(combat.combatant.actor,
    { isAttack: true, actionTiming: "lastAction" })), true);
  assert.equal(roundActionContext(combat.combatant.actor, { isAttack: true, actionTiming: "lastAction" }).kind, null);
});


test("explicit next-round navigation also reconciles a saved shield-skip checkpoint", async () => {
  const combat = setup(); await planCombatRound(combat, []);
  const actor = combat.turns[0].actor, update = actor.update;
  actor.flags.cypher.shieldTurnLossPending = true;
  actor.update = async () => { throw Error("flag cleanup failed"); };
  await assert.rejects(combat.startCombat(), /flag cleanup failed/);
  actor.update = update;
  await combat.nextRound();
  assert.equal(actor.flags.cypher.shieldTurnLossPending, false);
  assert.equal(combat.combatant.id, "fast");
});
