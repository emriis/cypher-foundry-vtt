/** Verify source-imported shield Abilities against real Foundry documents and sheets. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

/** Import the normalized source Ability, preserving its mechanical key. */
async function setup(page, key) {
  return page.evaluate(async key => {
    const pack = game.packs.get("cypher.abilities-en");
    const documents = await pack.getDocuments();
    const source = documents.find(item => item.system.key === key);
    if (!source) throw new Error(`Missing source Ability: ${key}`);
    const actor = await Actor.create({ name: `E2E ${key}`, type: "pc", system: {
      tier: 6, effort: 3, xp: 5,
      stats: { might: { pool: { value: 20, max: 20 } }, speed: { pool: { value: 20, max: 20 } } }
    } });
    const [ability] = await actor.createEmbeddedDocuments("Item", [source.toObject()]);
    const npc = await Actor.create({ name: "E2E shield foe", type: "npc", system: { level: 3, health: { value: 30, max: 30 } } });
    return { actor: actor.id, ability: ability.id, npc: npc.id };
  }, key);
}

test("Hidden Shield ability controls create its shield and hinder both paired attacks on the real sheet", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.425); // d20 = 12.
  const ids = await setup(page, "hidden-shield");
  const mainId = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.actor);
    const [main] = await actor.createEmbeddedDocuments("Item", [{ name: "Main melee attack", type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 1 } } },
      system: { stat: "might", attackType: "medium", damage: 4, freelyUsable: true, range: "immediate" } }]);
    await actor.sheet.render({ force: true });
    return main.id;
  }, ids);
  const use = page.locator(`[data-item-id="${ids.ability}"] [data-action="useShieldAbility"]`);
  await use.click();
  const operation = () => page.locator("form").filter({ has: page.locator('select[name="operation"]') }).last();
  await operation().locator('select[name="operation"]').selectOption("create");
  await operation().getByRole("button").last().click();
  await expect.poll(() => page.evaluate(ids => game.actors.get(ids.actor).items.filter(item => item.type === "shield").length, ids)).toBe(1);
  const shieldId = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.actor);
    const shield = actor.items.find(item => item.type === "shield");
    await shield.update({ "system.equipped": true });
    return shield.id;
  }, ids);
  await use.click();
  await operation().locator('select[name="operation"]').selectOption("paired");
  await operation().locator('select[name="mainAttackId"]').selectOption(mainId);
  await operation().locator('select[name="target0"]').selectOption({ label: "E2E shield foe" });
  await operation().locator('select[name="target1"]').selectOption({ label: "E2E shield foe" });
  await operation().locator('input[name="rangeConfirmed"]').check();
  await operation().getByRole("button").last().click();
  const rollForm = () => page.locator("form").filter({ has: page.locator('input[name="effort"]') }).last();
  await rollForm().getByRole("button").last().click();
  await expect.poll(() => page.evaluate(ids => [...game.messages].filter(message => message.flags.cypher?.abilitySource?.itemId === ids.ability).length, ids)).toBe(1);
  await rollForm().getByRole("button").last().click();
  await expect.poll(() => page.evaluate(ids => game.actors.get(ids.npc).system.health.value, ids)).toBe(24);
  const difficulties = await page.evaluate(ids => [...game.messages]
    .filter(message => message.flags.cypher?.abilitySource?.itemId === ids.ability)
    .map(message => message.flags.cypher.effectiveDifficulty), ids);
  expect(difficulties).toEqual([4, 3]);
  await page.reload();
  await waitForFoundryReady(page);
  expect(await page.evaluate(({ ids, shieldId }) => {
    const shield = game.actors.get(ids.actor).items.get(shieldId);
    return { ability: shield.system.abilityItemId, inHand: shield.system.inHand, equipped: shield.system.equipped };
  }, { ids, shieldId })).toEqual({ ability: ids.ability, inHand: true, equipped: true });
});

test("Unyielding Shield survives on a synthetic defender and automatically loses its next combat turn", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.425);
  const ids = await setup(page, "unyielding-shield");
  const result = await page.evaluate(async ids => {
    const { designateShield } = await import("/systems/cypher/module/applications/shield-lifecycle-service.mjs");
    const base = game.actors.get(ids.actor);
    await designateShield(base.items.get(ids.ability));
    const scene = await globalThis.Scene.create({ name: "E2E unyielding scene", active: false });
    const [token, npcToken] = await scene.createEmbeddedDocuments("Token", [
      { name: "Synthetic shield defender", actorId: base.id, actorLink: false, x: 0, y: 0 },
      { name: "Shield foe", actorId: ids.npc, actorLink: true, x: 100, y: 0 }
    ]);
    const actor = token.actor, shield = actor.items.find(item => item.type === "shield");
    await shield.update({ "system.equipped": true });
    const combat = await globalThis.Combat.create({ scene: scene.id, active: true });
    await combat.createEmbeddedDocuments("Combatant", [
      { tokenId: npcToken.id, actorId: ids.npc, sceneId: scene.id, initiative: 20 },
      { tokenId: token.id, actorId: base.id, sceneId: scene.id, initiative: 10 }
    ]);
    await combat.startCombat();
    await actor.rollDefense("block", { incomingSeverity: "major", shieldItemId: shield.id });
    if (shield.system.broken || !actor.flags.cypher.shieldTurnLossPending) throw new Error("Unyielding major replacement missing");
    await combat.nextTurn();
    return { scene: scene.id, token: token.id, combat: combat.id, shield: shield.id };
  }, ids);
  await expect.poll(() => page.evaluate(result => game.scenes.get(result.scene).tokens.get(result.token).actor.flags.cypher.shieldTurnLossPending, result)).toBe(false);
  expect(await page.evaluate(({ ids, result }) => {
    const actor = game.scenes.get(result.scene).tokens.get(result.token).actor;
    const shield = actor.items.get(result.shield);
    return { activeActor: game.combats.get(result.combat).combatant.actor.id,
      broken: shield.system.broken, equipped: shield.system.equipped, major: shield.system.wounds.major.current,
      baseMajor: game.actors.get(ids.actor).items.get(shield.id).system.wounds.major.current };
  }, { ids, result })).toEqual({ activeActor: ids.npc, broken: false, equipped: true, major: 1, baseMajor: 0 });
  await page.reload();
  await waitForFoundryReady(page);
  expect(await page.evaluate(result => game.scenes.get(result.scene).tokens.get(result.token).actor.items.get(result.shield).system.broken, result)).toBe(false);
});

test("Bouncing Shield applies dedicated Effort per hit, retains one hindrance and catches after reload by XP reroll", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.425);
  const ids = await setup(page, "bouncing-shield");
  const state = await page.evaluate(async ids => {
    const { executeShieldAbility } = await import("/systems/cypher/module/applications/shield-attack-service.mjs");
    const actor = game.actors.get(ids.actor);
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ name: "Bouncing shield", type: "shield", system: { equipped: true } }]);
    const other = await Actor.create({ name: "E2E second rebound target", type: "npc", system: { level: 3, health: { value: 30, max: 30 } } });
    await actor.update({ "system.stats.speed.edge": 1 });
    const result = await executeShieldAbility(actor.items.get(ids.ability), { shieldId: shield.id,
      targets: [game.actors.get(ids.npc), other, game.actors.get(ids.npc)], rangeConfirmed: true,
      rollOptions: { effectEffortLevels: 1 }, chooseCatchOptions: () => {
        CONFIG.Dice.randomUniform = () => 0.825;
        return {};
      } });
    const catchCard = [...game.messages].find(message => message.flags.cypher?.shieldReturn?.itemId === shield.id);
    return { shield: shield.id, origin: catchCard.id, pool: actor.system.stats.speed.pool.value,
      hits: result.results.length, inHand: shield.system.inHand,
      hindrances: game.actors.get(ids.npc).flags.cypher.activeWeaponEffects.length };
  }, ids);
  expect(state).toMatchObject({ pool: 11, hits: 3, inHand: false, hindrances: 1 });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425);
  expect(await page.evaluate(async ({ ids, state }) => {
    const actor = game.actors.get(ids.actor);
    await actor.rerollMessage(game.messages.get(state.origin));
    const shield = actor.items.get(state.shield);
    return { inHand: shield.system.inHand, equipped: shield.system.equipped, xp: actor.system.xp, pool: actor.system.stats.speed.pool.value };
  }, { ids, state })).toEqual({ inHand: true, equipped: true, xp: 4, pool: 11 });
});

test("Hidden Shield repair survives reload and requires the elapsed day before re-equipping", async ({ e2ePage: page }) => {
  const ids = await setup(page, "hidden-shield");
  const shieldId = await page.evaluate(async ids => {
    const lifecycle = await import("/systems/cypher/module/applications/shield-lifecycle-service.mjs");
    const actor = game.actors.get(ids.actor);
    const shield = await lifecycle.designateShield(actor.items.get(ids.ability));
    await shield.update({ "system.wounds.major.current": 1 });
    await lifecycle.startShieldWork(shield, { resourcesConfirmed: true });
    if (await lifecycle.finishShieldWork(shield, { workCompleted: true })) throw new Error("Repair completed before its day");
    return shield.id;
  }, ids);
  await page.reload();
  await waitForFoundryReady(page);
  const state = await page.evaluate(async ({ ids, shieldId }) => {
    const lifecycle = await import("/systems/cypher/module/applications/shield-lifecycle-service.mjs");
    const shield = game.actors.get(ids.actor).items.get(shieldId);
    await game.time.advance(86400);
    const completed = await lifecycle.finishShieldWork(shield, { workCompleted: true });
    return { completed, broken: shield.system.broken, equipped: shield.system.equipped, major: shield.system.wounds.major.current };
  }, { ids, shieldId });
  expect(state).toEqual({ completed: true, broken: false, equipped: false, major: 0 });
});

test("a shield catch natural 20 checkpoints its return and refunds its original point cost once", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.425);
  const ids = await setup(page, "throw-shield");
  const origin = await page.evaluate(async ids => {
    const { executeShieldAbility } = await import("/systems/cypher/module/applications/shield-attack-service.mjs");
    const actor = game.actors.get(ids.actor);
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ name: "Catch cost shield", type: "shield", system: { equipped: true } }]);
    await executeShieldAbility(actor.items.get(ids.ability), { shieldId: shield.id,
      targets: [game.actors.get(ids.npc)], rangeConfirmed: true, chooseCatchOptions: () => {
        CONFIG.Dice.randomUniform = () => 0.825;
        return { effortLevels: 1 };
      } });
    const message = [...game.messages].find(message => message.flags.cypher?.shieldReturn?.itemId === shield.id);
    return { message: message.id, shield: shield.id };
  }, ids);
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.025);
  const first = await page.evaluate(async ({ ids, origin }) => {
    const actor = game.actors.get(ids.actor);
    const result = await actor.rerollMessage(game.messages.get(origin.message));
    return { pool: actor.system.stats.speed.pool.value, xp: actor.system.xp,
      inHand: actor.items.get(origin.shield).system.inHand, refunded: result.costRefunded, state: result.shieldReturn.state };
  }, { ids, origin });
  expect(first).toEqual({ pool: 20, xp: 4, inHand: true, refunded: true, state: "resolved" });
  const second = await page.evaluate(async ({ ids, origin }) => {
    const actor = game.actors.get(ids.actor);
    await actor.update({ "system.stats.speed.pool.value": 17 });
    await actor.rerollMessage(game.messages.get(origin.message));
    return { pool: actor.system.stats.speed.pool.value, xp: actor.system.xp };
  }, { ids, origin });
  expect(second).toEqual({ pool: 17, xp: 3 });
});
