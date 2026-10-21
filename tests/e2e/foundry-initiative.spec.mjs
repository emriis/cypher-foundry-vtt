/** Exercise the real combat tracker, initiative dialogs and persisted reroll ownership. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function setup(page) {
  return page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E initiative base", type: "pc", system: { xp: 5,
      stats: { speed: { pool: { value: 10, max: 10 }, edge: 0 } } } });
    const npc = await Actor.create({ name: "E2E initiative foe", type: "npc", system: { level: 2 } });
    const scene = await globalThis.Scene.create({ name: "E2E initiative tokens", active: false });
    const tokens = await scene.createEmbeddedDocuments("Token", [
      { name: "Initiative PC", actorId: pc.id, actorLink: false, x: 0, y: 0 },
      { name: "Initiative sibling", actorId: pc.id, actorLink: false, x: 100, y: 0 },
      { name: "Initiative NPC", actorId: npc.id, actorLink: true, x: 200, y: 0 }
    ]);
    // Keep the encounter visible in the sidebar without opening a canvas.
    // Each combatant still resolves its explicit inactive-scene token Actor.
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", [tokens[0], tokens[2]].map(token => ({
      tokenId: token.id, actorId: token.actorId, sceneId: scene.id
    })));
    const pcCombatant = combat.combatants.find(entry => entry.actor.type === "pc");
    const npcCombatant = combat.combatants.find(entry => entry.actor.type === "npc");
    return { combat: combat.id, pc: pcCombatant.id, npc: npcCombatant.id,
      base: pc.id, scene: scene.id, token: tokens[0].id, sibling: tokens[1].id };
  });
}

async function openTracker(page) {
  await page.evaluate(async () => { await ui.sidebar.changeTab("combat", "primary"); await ui.sidebar.expand(); });
}

test("initiative tracker rolls Speed with Effort, deterministic NPCs and PC priority on ties", async ({ e2ePage: page }) => {
  const ids = await setup(page);
  await setDiceUniform(page, 0.875); // d20 = 3.
  await page.evaluate(async ids => {
    const combat = game.combats.get(ids.combat);
    if (combat.constructor.name !== "CypherCombat") throw Error("Initiative adapter not registered");
    await combat.rollNPC();
  }, ids);
  await openTracker(page);
  await page.locator(`#combat [data-combatant-id="${ids.pc}"] [data-action="rollInitiative"]`).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="effort"]') }).last();
  await expect(form.locator('input[name="difficulty"]')).toBeHidden();
  await expect(form.locator('input[name="rollRoutine"]')).toBeHidden();
  await form.locator('input[name="effort"]').fill("1");
  await form.locator('button[type="submit"]').press("Enter");
  await expect.poll(() => page.evaluate(ids => game.combats.get(ids.combat).combatants.get(ids.pc).initiative, ids)).toBe(6);
  const state = await page.evaluate(ids => {
    const combat = game.combats.get(ids.combat);
    return { order: combat.turns.map(entry => entry.id), npc: combat.combatants.get(ids.npc).initiative,
      speed: combat.combatants.get(ids.pc).actor.system.stats.speed.pool.value,
      base: game.actors.get(ids.base).system.stats.speed.pool.value,
      sibling: game.scenes.get(ids.scene).tokens.get(ids.sibling).actor.system.stats.speed.pool.value };
  }, ids);
  expect(state).toEqual({ order: [ids.pc, ids.npc], npc: 6, speed: 7, base: 10, sibling: 10 });
  await page.reload();
  await waitForFoundryReady(page);
  expect(await page.evaluate(ids => game.combats.get(ids.combat).turns.map(entry => entry.id), ids)).toEqual([ids.pc, ids.npc]);
});

test("initiative rerolls preserve the active turn and refund a natural twenty only once after reload", async ({ e2ePage: page }) => {
  const ids = await setup(page);
  await setDiceUniform(page, 0.975); // d20 = 1, PC initiative 4, below the NPC's 6.
  const originId = await page.evaluate(async ids => {
    const combat = game.combats.get(ids.combat);
    await combat.rollInitiative([ids.pc, ids.npc], { chooseOptions: async () => ({ effortLevels: 1 }) });
    await combat.startCombat();
    if (combat.combatant.id !== ids.npc) throw Error("NPC must initially precede the PC");
    // The improved PC moves ahead of this active NPC, changing its turn index.
    const actor = combat.combatants.get(ids.pc).actor;
    await actor.update({ "flags.cypher.shieldTurnLossPending": true });
    return [...game.messages].find(message => message.flags.cypher?.initiative?.combatantId === ids.pc).id;
  }, ids);
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.025); // natural twenty, retained initiative 23.
  const first = await page.evaluate(async ({ ids, originId }) => {
    const combat = game.combats.get(ids.combat), actor = combat.combatants.get(ids.pc).actor;
    await actor.rerollMessage(game.messages.get(originId));
    return { active: combat.combatant.id, score: combat.combatants.get(ids.pc).initiative,
      speed: actor.system.stats.speed.pool.value, xp: actor.system.xp,
      pendingTurn: actor.flags.cypher.shieldTurnLossPending };
  }, { ids, originId });
  expect(first).toEqual({ active: ids.npc, score: 23, speed: 10, xp: 4, pendingTurn: true });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.875);
  const second = await page.evaluate(async ({ ids, originId }) => {
    const combat = game.combats.get(ids.combat), actor = combat.combatants.get(ids.pc).actor;
    await actor.update({ "system.stats.speed.pool.value": 5 });
    const oldCard = [...game.messages].find(message => message.flags.cypher?.rerollOriginId === originId);
    await actor.rerollMessage(oldCard);
    return { active: combat.combatant.id, score: combat.combatants.get(ids.pc).initiative,
      speed: actor.system.stats.speed.pool.value, xp: actor.system.xp };
  }, { ids, originId });
  expect(second).toEqual({ active: ids.npc, score: 23, speed: 5, xp: 3 });
});

test("initiative cancellation and superseded cards leave resources and the new initiative untouched", async ({ e2ePage: page }) => {
  const ids = await setup(page);
  await openTracker(page);
  await page.locator(`#combat [data-combatant-id="${ids.pc}"] [data-action="rollInitiative"]`).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="effort"]') }).last();
  await expect(form).toBeVisible();
  const appId = await form.evaluate(node => node.closest(".application").id);
  await page.locator(`[id="${appId}"] [data-action="close"]`).click();
  await expect(page.locator(`[id="${appId}"]`)).toHaveCount(0);
  expect(await page.evaluate(ids => ({ score: game.combats.get(ids.combat).combatants.get(ids.pc).initiative,
    messages: game.messages.filter(message => message.flags.cypher?.initiative?.combatantId === ids.pc).length }), ids))
    .toEqual({ score: null, messages: 0 });
  await setDiceUniform(page, 0.425); // d20 = 12.
  const state = await page.evaluate(async ids => {
    const combat = game.combats.get(ids.combat), actor = combat.combatants.get(ids.pc).actor;
    await combat.rollInitiative(ids.pc, { chooseOptions: async () => ({}) });
    const first = [...game.messages].find(message => message.flags.cypher?.initiative?.combatantId === ids.pc);
    await combat.rollInitiative(ids.pc, { chooseOptions: async () => ({ assetSteps: 1 }) });
    const result = await actor.rerollMessage(first);
    return { rejected: result === null, score: combat.combatants.get(ids.pc).initiative,
      xp: actor.system.xp, speed: actor.system.stats.speed.pool.value };
  }, ids);
  expect(state).toEqual({ rejected: true, score: 15, xp: 5, speed: 10 });
});
