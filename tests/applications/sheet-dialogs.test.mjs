import assert from "node:assert/strict";
import test from "node:test";
import { promptRollOptions, promptWeaponAttackCategory, promptWeaponAbility } from "../../module/sheets/dialogs.mjs";

function dialogEnvironment(result) {
  const prompts = [];
  globalThis.game = { i18n: { localize: key => key, format: key => key },
    actors: { filter: () => [] }, user: { targets: [] } };
  globalThis.CONFIG = { CYPHER: { xpCosts: { luckyShot: 1 }, attackSkillCategories: [] } };
  globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { api: { DialogV2: {
    async prompt(options) {
      prompts.push(options);
      if (result === null && options.rejectClose !== false) throw new Error("Dialog dismissed");
      return result;
    }
  } } } };
  return prompts;
}

test("Given a cancelled roll dialog, then no Actor writes occur", async () => {
  dialogEnvironment(null);
  const actor = { system: { effort: 1 }, items: { filter: () => [] },
    async update() { assert.fail("A dialog cannot persist state"); } };
  assert.equal(await promptRollOptions(actor, { isAttack: true }), null);
  assert.equal(await promptWeaponAttackCategory(), null);
  assert.equal(await promptWeaponAbility(actor, { type: "ability", system: { key: "spray" } }), null);
});

test("Given an unlinked targeted NPC, when weapon choices are accepted, then the actual synthetic Actor is preserved", async () => {
  const prompts = dialogEnvironment({ weaponId: "weapon", targetIds: ["Scene.scene.Token.token"], confirmed: true });
  const target = { id: "world-actor", isToken: true, type: "npc", name: "NPC", system: { level: 2 } };
  globalThis.game.user.targets = [{ actor: target, document: { uuid: "Scene.scene.Token.token" } }];
  const actor = { items: { filter: () => [] } };
  const selection = await promptWeaponAbility(actor, { type: "ability", name: "Spray", system: { key: "spray" } });
  assert.equal(selection.targets[0], target);
  assert.equal(selection.thrownWeaponsInReach, true);
  assert.match(prompts[0].content, /Scene.scene.Token.token/);
});
