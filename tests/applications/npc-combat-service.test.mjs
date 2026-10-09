import assert from "node:assert/strict";
import test from "node:test";

globalThis.Actor = class Actor {};
globalThis.game = {
  user: { targets: new Set() },
  i18n: {
    localize: key => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  }
};
globalThis.ui = { notifications: { error() {}, warn() {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };

const { rollNpcAttack } = await import(
  "../../module/applications/npc-combat-service.mjs"
);

function createTarget() {
  const target = {
    id: "pc-1",
    type: "pc",
    system: {
      effort: 1,
      hinderSteps: 0,
      armor: { speedTaskHinder: 0 },
      stats: {
        might: { pool: { value: 8, max: 8 }, edge: 0 },
        speed: { pool: { value: 8, max: 8 }, edge: 0 },
        intellect: { pool: { value: 8, max: 8 }, edge: 0 }
      },
      wounds: {
        minor: { current: 0, max: 3 },
        moderate: { current: 0, max: 3 },
        major: { current: 0, max: 3 }
      },
      hindered: false,
      dead: false,
      customStats: []
    },
    statuses: new Set(),
    items: new Map(),
    updates: [],
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split(".");
        let cursor = this;
        for (const part of parts.slice(0, -1)) cursor = cursor[part];
        cursor[parts.at(-1)] = value;
      }
    },
    async toggleStatusEffect(status, { active }) {
      if (active) this.statuses.add(status);
      else this.statuses.delete(status);
    }
  };
  return target;
}

function setRollResult(value) {
  globalThis.Roll = class {
    async evaluate() {
      this.total = value;
      return this;
    }

    async toMessage() {
      return this;
    }
  };
}

test("failed NPC Pool attack applies its declared PC Pool damage", async () => {
  setRollResult(1);
  const target = createTarget();
  const npc = {
    type: "npc",
    system: { level: 3 }
  };

  const result = await rollNpcAttack(
    npc,
    { name: "Claw", damage: { mode: "pool", amount: 4, stat: "might" } },
    { target, defenseType: "dodge" }
  );

  assert.equal(result.defense.success, false);
  assert.equal(result.targetDamage, 4);
  assert.equal(target.system.stats.might.pool.value, 4);
  assert.equal(target.system.wounds.minor.current, 0);
});

test("failed NPC wound attack applies all declared wounds", async () => {
  setRollResult(1);
  const target = createTarget();
  const npc = {
    type: "npc",
    system: { level: 3 }
  };

  const result = await rollNpcAttack(
    npc,
    {
      name: "Bite",
      damage: { mode: "wound", severity: "moderate", wounds: 2 }
    },
    { target, defenseType: "dodge" }
  );

  assert.equal(result.defense.success, false);
  assert.equal(target.system.wounds.moderate.current, 2);
});

test("successful NPC Pool attack does not damage the PC", async () => {
  setRollResult(20);
  const target = createTarget();
  const npc = {
    type: "npc",
    system: { level: 3 }
  };

  const result = await rollNpcAttack(
    npc,
    { name: "Blast", damage: { mode: "pool", amount: 4, stat: "intellect" } },
    { target, defenseType: "dodge" }
  );

  assert.equal(result.defense.success, true);
  assert.equal(result.targetDamage, 0);
  assert.equal(target.system.stats.intellect.pool.value, 8);
});


function createNpc(activeWeaponEffects = []) {
  return {
    type: "npc",
    system: { level: 3 },
    flags: { cypher: { activeWeaponEffects } },
    updates: [],
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split(".");
        let cursor = this;
        for (const part of parts.slice(0, -1)) {
          cursor[part] ??= {};
          cursor = cursor[part];
        }
        cursor[parts.at(-1)] = value;
      }
    }
  };
}

test("a hindered NPC attacks at the reduced structured difficulty", async () => {
  setRollResult(8);
  const target = createTarget();
  const npc = createNpc([{
    id: "hindered",
    effect: "hindered",
    hinderSteps: 1,
    duration: "one round",
    combatId: "combat-1",
    combatRound: 1
  }]);
  globalThis.game.combat = { id: "combat-1", round: 1 };

  const result = await rollNpcAttack(
    npc,
    { name: "Claw", damage: { mode: "pool", amount: 4, stat: "might" } },
    { target, defenseType: "dodge" }
  );

  assert.equal(result.defense.effectiveDifficulty, 2);
});

test("an NPC that loses its next action cannot attack and consumes that effect", async () => {
  let evaluated = false;
  globalThis.Roll = class {
    async evaluate() {
      evaluated = true;
      this.total = 10;
      return this;
    }
  };
  const target = createTarget();
  const npc = createNpc([{
    id: "lost-action",
    effect: "loseNextAction",
    duration: "next action"
  }]);

  const result = await rollNpcAttack(
    npc,
    { name: "Claw", damage: { mode: "pool", amount: 4, stat: "might" } },
    { target, defenseType: "dodge" }
  );

  assert.equal(result, null);
  assert.equal(evaluated, false);
  assert.deepEqual(npc.flags.cypher.activeWeaponEffects, []);
});
