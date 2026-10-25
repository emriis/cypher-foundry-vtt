/** New same-task actions preserve old expenses, explicit duration and actual document identity. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function chat(page) {
  await page.evaluate(async () => { await ui.sidebar.changeTab("chat", "primary"); await ui.sidebar.expand(); });
  await page.waitForFunction(() => !document.querySelector("#chat-notifications .message[hidden], #chat-notifications .spacer"));
}
const card = (page, id) => page.locator(`#chat .chat-log [data-message-id="${id}"]`);
async function submitRetry(page) {
  await page.locator('input[name="sameTaskConfirmed"]').check();
  await page.locator('input[name="retryDuration"]').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator('input[name="retryDuration"]')).toHaveCount(0);
}

test("task retries: EN/FR and both themes preserve prior costs and enforce GM veto, cancellation and lineage", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      await setDiceUniform(page, 0.925); // d20 = 2.
      const id = await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const actor = await Actor.create({ name: "E2E task retry", type: "pc", system: { xp: 5, effort: 2,
          stats: { intellect: { pool: { value: 20, max: 20 }, edge: 0 } } } });
        await actor.sheet.render({ force: true }); actor.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return actor.id;
      }, { language, theme, original });
      await page.locator('[data-action="rollStat"][data-stat="intellect"]').first().press("Enter");
      await page.locator('input[name="difficulty"]').fill("4");
      await page.locator('input[name="effort"]').fill("1");
      await page.locator('input[name="effort"]').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
      await expect(page.locator('input[name="effort"]')).toHaveCount(0);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.stats.intellect.pool.value, id)).toBe(17);
      const source = await page.evaluate(id => game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === game.actors.get(id).uuid).id, id);
      await chat(page);
      await expect(card(page, source).locator(".cypher-task-retry-button")).toContainText(language === "fr" ? "Retenter" : "Retry");
      await expect(card(page, source).locator(".cypher-reroll-button")).toBeVisible();
      await card(page, source).locator(".cypher-task-retry-button").press("Enter");
      await page.locator('input[name="retryDuration"]').press("Escape");
      await expect(page.locator('input[name="retryDuration"]')).toHaveCount(0);
      expect(await page.evaluate(id => game.actors.get(id).system.stats.intellect.pool.value, id)).toBe(17);
      await card(page, source).locator(".cypher-task-retry-policy").press("Enter");
      await page.locator('input[name="reason"]').fill("E2E mechanism jammed");
      await page.locator('input[name="reason"]').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
      await expect(page.locator('input[name="reason"]')).toHaveCount(0);
      await expect(card(page, source).locator(".cypher-task-retry-button")).toHaveCount(0);
      await page.reload(); await waitForFoundryReady(page); await chat(page); await setDiceUniform(page, 0.925);
      expect(await page.evaluate(source => game.messages.get(source).flags.cypher.taskRetryPolicy.allowed, source)).toBe(false);
      await card(page, source).locator(".cypher-task-retry-policy").press("Enter");
      await card(page, source).locator(".cypher-task-retry-button").press("Enter");
      await page.locator('input[name="retryLabel"]').fill("E2E open this lock");
      await page.locator('input[name="retryDuration"]').fill("one action");
      await expect(page.locator('input[name="effort"]')).toHaveValue("1");
      await expect(page.locator('input[name="effort"]')).toHaveAttribute("min", "1");
      await submitRetry(page);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.stats.intellect.pool.value, id)).toBe(14);
      const second = await page.evaluate(source => game.messages.get(source).flags.cypher.taskRetry.nextMessageId, source);
      expect(await page.evaluate(({ id, source, second }) => ({ xp: game.actors.get(id).system.xp,
        die: game.messages.get(source).flags.cypher.d20, parent: game.messages.get(second).flags.cypher.taskAttempt.parentMessageId }), { id, source, second })).toEqual({ xp: 5, die: 2, parent: source });
      await expect(card(page, source).locator(".cypher-task-retry-button")).toHaveCount(0);
      await page.reload(); await waitForFoundryReady(page); await chat(page); await setDiceUniform(page, 0.225); // d20 = 16.
      await card(page, second).locator(".cypher-task-retry-button").press("Enter");
      await expect(page.locator('input[name="retryDuration"]')).toHaveAttribute("readonly", "");
      await expect(page.locator('input[name="retryDuration"]')).toHaveValue("one action");
      await submitRetry(page);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.stats.intellect.pool.value, id)).toBe(11);
      const last = await page.evaluate(second => game.messages.get(second).flags.cypher.taskRetry.nextMessageId, second);
      await expect(card(page, last).locator(".cypher-task-retry-button")).toHaveCount(0);
      await page.evaluate(async id => {
        const actor = game.actors.get(id);
        for (const message of game.messages.contents.filter(message => message.flags.cypher?.actorUuid === actor.uuid)) await message.delete();
        await actor.delete();
      }, id);
    }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original);
  }
});

test("task retries: synthetic attempts consume separate managed actions and a new twenty refunds only its own cost", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.925);
  const ids = await page.evaluate(async () => {
    const base = await Actor.create({ name: "E2E retry base", type: "pc", system: { xp: 5, effort: 2,
      stats: { intellect: { pool: { value: 20, max: 20 }, edge: 0 } } } });
    const scene = await globalThis.Scene.create({ name: "E2E retry scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    const actor = token.actor;
    await actor.rollTask({ stat: "intellect", difficulty: 4, taskLabel: "E2E lock", taskDuration: "one action" });
    const source = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid);
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", [{ actorId: base.id, tokenId: token.id, sceneId: scene.id, initiative: 10 }]);
    const flow = await import("/systems/cypher/module/applications/round-flow-service.mjs");
    await flow.planCombatRound(combat, []); await combat.startCombat();
    const options = { label: "E2E lock", duration: "one action", sameTaskConfirmed: true, effortLevels: 1 };
    const result = await actor.retryTask(source, options);
    if (!result || !actor.flags.cypher.roundActionUsage.primary) throw Error("Retry did not consume its action");
    const repeated = await actor.retryTask(result.message, options);
    if (repeated !== null || actor.system.stats.intellect.pool.value !== 17) throw Error("A retry reused the same action");
    return { base: base.id, scene: scene.id, token: token.id, combat: combat.id, second: result.message.id };
  });
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
  const result = await page.evaluate(async ids => {
    const actor = game.scenes.get(ids.scene).tokens.get(ids.token).actor, combat = game.combats.get(ids.combat);
    await combat.nextTurn();
    const roll = await actor.retryTask(game.messages.get(ids.second), { label: "E2E lock", duration: "one action", sameTaskConfirmed: true, effortLevels: 1 });
    return { success: roll.success, pool: actor.system.stats.intellect.pool.value, xp: actor.system.xp,
      basePool: game.actors.get(ids.base).system.stats.intellect.pool.value, round: combat.round, used: actor.flags.cypher.roundActionUsage.primary };
  }, ids);
  expect(result).toEqual({ success: true, pool: 17, xp: 5, basePool: 20, round: 2, used: true });
});

test("task retries: a failed publication keeps a saved checkpoint until explicit GM closure", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.925);
  const ids = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E interrupted retry", type: "pc", system: { effort: 2, stats: { intellect: { pool: { value: 20, max: 20 } } } } });
    await actor.rollTask({ stat: "intellect", difficulty: 4 });
    const source = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid);
    const original = Roll.prototype.toMessage;
    Roll.prototype.toMessage = async () => { throw Error("E2E publication interrupted"); };
    try { await actor.retryTask(source, { label: "E2E lock", duration: "one action", sameTaskConfirmed: true, effortLevels: 1 }); }
    catch (error) { if (!error.message.includes("E2E publication")) throw error; }
    finally { Roll.prototype.toMessage = original; }
    return { actor: actor.id, source: source.id };
  });
  await page.reload(); await waitForFoundryReady(page); await chat(page);
  const state = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.actor), source = game.messages.get(ids.source);
    const result = await actor.retryTask(source, { label: "E2E lock", duration: "one action", sameTaskConfirmed: true, effortLevels: 1 });
    return { result, pool: actor.system.stats.intellect.pool.value, state: source.flags.cypher.taskRetry.state };
  }, ids);
  expect(state).toEqual({ result: null, pool: 17, state: "pending" });
  await expect(card(page, ids.source).locator(".cypher-task-retry-button")).toHaveCount(0);
  await card(page, ids.source).locator(".cypher-task-retry-close").press("Enter");
  await page.locator('button[data-action="yes"]').press("Enter");
  await expect.poll(() => page.evaluate(ids => game.messages.get(ids.source).flags.cypher.taskRetry.state, ids)).toBe("closed");
  expect(await page.evaluate(ids => game.actors.get(ids.actor).system.stats.intellect.pool.value, ids)).toBe(17);
});
