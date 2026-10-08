import assert from "node:assert/strict";
import test from "node:test";

import {
  canApplyNpcHealthDamage,
  normalizeNpcAttackDamage,
  resolveNpcHealthDamage,
  resolveNpcAttackTargetDamage
} from "../../module/rules/npc-combat.mjs";

test("resolveNpcHealthDamage applies Armor before reducing Health", () => {
  assert.equal(resolveNpcHealthDamage(6, 2), 4);
  assert.equal(resolveNpcHealthDamage(2, 4), 0);
});

test("resolveNpcHealthDamage applies only the declared Armor bypass", () => {
  assert.equal(resolveNpcHealthDamage(6, 4, 2), 4);
  assert.equal(resolveNpcHealthDamage(6, 4, 4), 6);
  assert.equal(resolveNpcHealthDamage(6, 4, 9), 6);
});

test("normalizeNpcAttackDamage preserves wound and Pool damage metadata", () => {
  assert.deepEqual(normalizeNpcAttackDamage({
    damage: {
      mode: "wound",
      amount: 0,
      severity: "major",
      stat: "",
      ignoresArmor: 2,
      wounds: 2
    }
  }), {
    mode: "wound",
    amount: 0,
    severity: "major",
    stat: "",
    ignoresArmor: 2,
    wounds: 2
  });
});

test("only numeric NPC attacks are eligible for automatic Health damage", () => {
  assert.equal(canApplyNpcHealthDamage({
    damage: { mode: "numeric", amount: 4 }
  }), true);
  assert.equal(canApplyNpcHealthDamage({
    damage: { mode: "wound", amount: 0, severity: "major" }
  }), false);
  assert.equal(canApplyNpcHealthDamage({
    damage: { mode: "pool", amount: 4, stat: "might" }
  }), false);
});


test("NPC wound attacks resolve to a PC wound contract", () => {
  assert.deepEqual(
    resolveNpcAttackTargetDamage({
      damage: {
        mode: "wound",
        severity: "moderate",
        wounds: 2
      }
    }),
    {
      mode: "wound",
      severity: "moderate",
      wounds: 2
    }
  );
});

test("NPC Pool attacks require an explicit target stat", () => {
  assert.deepEqual(
    resolveNpcAttackTargetDamage({
      damage: {
        mode: "pool",
        amount: 4,
        stat: "speed"
      }
    }),
    {
      mode: "pool",
      amount: 4,
      stat: "speed"
    }
  );
  assert.equal(
    resolveNpcAttackTargetDamage({
      damage: { mode: "pool", amount: 4 }
    }),
    null
  );
});

test("NPC numeric attacks are not treated as PC damage", () => {
  assert.equal(
    resolveNpcAttackTargetDamage({
      damage: { mode: "numeric", amount: 6 }
    }),
    null
  );
});
