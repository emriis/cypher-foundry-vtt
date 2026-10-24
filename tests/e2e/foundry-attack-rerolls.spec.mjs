/** Real chat, synthetic target and persisted CRD attack-reroll contributions. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function openChat(page) {
  await page.evaluate(async () => { await ui.sidebar.changeTab("chat", "primary"); await ui.sidebar.expand(); });
  await page.waitForFunction(() => !document.querySelector("#chat-notifications .message[hidden], #chat-notifications .spacer"));
}

test("attack rerolls from chat correct only original synthetic target damage after reload", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825); // d20 = 4, failure.
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E attack reroll source", type: "pc", system: { xp: 5, effort: 2,
      stats: { might: { pool: { value: 10, max: 10 }, edge: 0 } } } });
    const [weapon] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E reroll weapon", type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 2 } } },
      system: { stat: "might", damage: 5, freelyUsable: true, range: "immediate" } }]);
    const base = await Actor.create({ name: "E2E attack reroll base", type: "npc",
      system: { level: 3, armor: 1, health: { value: 20, max: 20 } } });
    const scene = await globalThis.Scene.create({ name: "E2E attack reroll tokens", active: false });
    const tokens = await scene.createEmbeddedDocuments("Token", [0, 1].map(index => ({
      name: `Reroll target ${index}`, actorId: base.id, actorLink: false, x: index * 100, y: 0
    })));
    await weapon.rollAttack({ target: tokens[0].actor, difficulty: 4, effortLevels: 1 });
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === pc.id && message.flags.cypher.isAttack);
    if (!origin?.flags.cypher.attackConsequences?.targetUuid) throw Error("Missing attack attribution");
    return { pc: pc.id, base: base.id, scene: scene.id, tokens: tokens.map(token => token.id), origin: origin.id };
  });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425); // d20 = 12, success.
  await openChat(page);
  await page.locator(`#chat .chat-log [data-message-id="${ids.origin}"] .cypher-reroll-button`).click({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(ids => game.scenes.get(ids.scene).tokens.get(ids.tokens[0]).actor.system.health.value, ids)).toBe(16);
  await page.evaluate(async ids => {
    const target = game.scenes.get(ids.scene).tokens.get(ids.tokens[0]).actor;
    await target.update({ "system.health.value": 13 });
  }, ids);
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.125); // d20 = 18, two extra damage.
  const state = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc);
    await pc.rerollMessage(game.messages.get(ids.origin));
    const scene = game.scenes.get(ids.scene);
    return { health: ids.tokens.map(id => scene.tokens.get(id).actor.system.health.value),
      base: game.actors.get(ids.base).system.health.value, xp: pc.system.xp,
      pool: pc.system.stats.might.pool.value, best: game.messages.get(ids.origin).flags.cypher.d20 };
  }, ids);
  expect(state).toEqual({ health: [11, 20], base: 20, xp: 3, pool: 7, best: 18 });
});

test("attack rerolls offer the real major-effect dialog and refund a natural twenty only once", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.125); // d20 = 18, two bonus damage.
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E attack special choice", type: "pc", system: { xp: 5,
      stats: { might: { pool: { value: 10, max: 10 }, edge: 0 } } } });
    const npc = await Actor.create({ name: "E2E special target", type: "npc", system: { level: 3, armor: 1, health: { value: 20, max: 20 } } });
    const [weapon] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E special weapon", type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 2 } } },
      system: { stat: "might", damage: 5, freelyUsable: true, range: "immediate" } }]);
    await weapon.rollAttack({ target: npc, difficulty: 4, effortLevels: 1 });
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === pc.id && message.flags.cypher.isAttack);
    await npc.update({ "system.health.value": 11 }); // three unrelated damage after the six-point hit.
    return { pc: pc.id, npc: npc.id, origin: origin.id };
  });
  await setDiceUniform(page, 0.025); // d20 = 20.
  await openChat(page);
  await page.locator(`#chat .chat-log [data-message-id="${ids.origin}"] .cypher-reroll-button`).click({ timeout: 10_000 });
  const dialog = page.locator("form").filter({ has: page.locator('select[name="specialEffect"]') }).last();
  await dialog.locator('select[name="specialEffect"]').selectOption("major");
  await dialog.getByRole("button").last().click();
  await expect.poll(() => page.evaluate(id => game.messages.get(id).flags.cypher.costRefunded, ids.origin)).toBe(true);
  const first = await page.evaluate(ids => ({ health: game.actors.get(ids.npc).system.health.value,
    pool: game.actors.get(ids.pc).system.stats.might.pool.value,
    choice: game.messages.get(ids.origin).flags.cypher.specialEffectChoice }), ids);
  expect(first).toEqual({ health: 13, pool: 10, choice: "major" });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.875); // d20 = 3, retain twenty and its effect choice.
  const second = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc);
    await pc.update({ "system.stats.might.pool.value": 7 });
    const priorCard = [...game.messages].find(message => message.flags.cypher?.rerollOriginId === ids.origin);
    await pc.rerollMessage(priorCard);
    return { health: game.actors.get(ids.npc).system.health.value, pool: pc.system.stats.might.pool.value,
      xp: pc.system.xp, choice: game.messages.get(ids.origin).flags.cypher.specialEffectChoice };
  }, ids);
  expect(second).toEqual({ health: 13, pool: 7, xp: 3, choice: "major" });
});

test("attack rerolls respect persisted healing boundaries and expired target effects", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825);
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E old attack intervals", type: "pc", system: { xp: 5 } });
    const npc = await Actor.create({ name: "E2E expired attack target", type: "npc", system: { level: 3, health: { value: 20, max: 20 } } });
    await pc.rollTask({ isAttack: true, targetActor: npc, difficulty: 3, baseDamage: 0,
      weaponTargetEffects: [{ effect: "loseNextAction", duration: "next action" }] });
    const missed = [...game.messages].find(message => message.flags.cypher?.actorId === pc.id && message.flags.cypher.isAttack);
    await npc.rollNpcAttack({ damage: { mode: "pool", amount: 1, stat: "might" } }, { target: pc });
    return { pc: pc.id, npc: npc.id, missed: missed.id };
  });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425);
  const state = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
    await pc.rerollMessage(game.messages.get(ids.missed));
    if ((npc.flags.cypher.activeWeaponEffects ?? []).length) throw Error("Expired next action revived");
    await pc.rollTask({ isAttack: true, targetActor: npc, difficulty: 3, baseDamage: 4 });
    const hit = [...game.messages].reverse().find(message => message.flags.cypher?.actorId === pc.id && message.flags.cypher.isAttack);
    await npc.update({ "system.health.value": 18 });
    return { origin: hit.id, revision: npc.flags.cypher.attackHealthRevision };
  }, ids);
  expect(state.revision).toBe(1);
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.125);
  const corrected = await page.evaluate(async ids => {
    const metadata = await game.actors.get(ids.pc).rerollMessage(game.messages.get(ids.origin));
    return { health: game.actors.get(ids.npc).system.health.value, state: metadata.attackConsequences.state };
  }, { ...ids, origin: state.origin });
  expect(corrected).toEqual({ health: 18, state: "manual" });
});

test("attack rerolls apply a newly earned zero-damage weapon effect exactly once", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825);
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E rerolled stun source", type: "pc", system: { xp: 5 } });
    const npc = await Actor.create({ name: "E2E rerolled stun target", type: "npc", system: { level: 3, health: { value: 20, max: 20 } } });
    await pc.rollTask({ isAttack: true, targetActor: npc, difficulty: 3, baseDamage: 0,
      weaponTargetEffects: [{ effect: "loseNextAction", duration: "next action" }] });
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === pc.id && message.flags.cypher.isAttack);
    return { pc: pc.id, npc: npc.id, origin: origin.id };
  });
  await setDiceUniform(page, 0.425);
  const first = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
    await pc.rerollMessage(game.messages.get(ids.origin));
    return { health: npc.system.health.value, effects: npc.flags.cypher.activeWeaponEffects.length };
  }, ids);
  expect(first).toEqual({ health: 20, effects: 1 });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.125);
  const second = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
    const attack = await npc.rollNpcAttack({ damage: { mode: "pool", amount: 1, stat: "might" } }, { target: pc });
    if (attack !== null) throw Error("Stunned NPC did not lose its action");
    await pc.rerollMessage(game.messages.get(ids.origin));
    return { health: npc.system.health.value, effects: npc.flags.cypher.activeWeaponEffects.length,
      actionRevision: npc.flags.cypher.weaponActionRevision, xp: pc.system.xp };
  }, ids);
  expect(second).toEqual({ health: 20, effects: 0, actionRevision: 1, xp: 3 });
});
