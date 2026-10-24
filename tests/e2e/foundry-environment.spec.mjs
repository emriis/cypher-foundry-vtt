/** Real PC hazard declarations, saved occurrences and paid defense corrections. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

test("environment: declarations, cancellation and stopping work in EN/FR and both themes", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const id = await page.evaluate(async ({ original, language, theme }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const actor = await Actor.create({ name: `E2E environment ${language} ${theme}`, type: "pc" });
        await actor.sheet.render({ force: true });
        actor.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return actor.id;
      }, { original, language, theme });
      const sheet = page.locator(".cypher.sheet.pc");
      const button = sheet.locator('[data-action="promptEnvironment"]');
      await expect(button).toHaveText(language === "fr" ? "Déclarer un danger" : "Declare a hazard");
      await button.press("Enter");
      const input = page.locator('input[name="hazardName"]');
      await expect(input).toBeVisible();
      await input.press("Escape");
      await expect(input).toHaveCount(0);
      expect(await page.evaluate(id => game.actors.get(id).flags.cypher?.environmentalExposures ?? [], id)).toEqual([]);
      await button.press("Enter");
      await input.fill("Declared heat");
      const dialog = input.locator("xpath=ancestor::form");
      await dialog.locator('select[name="severity"]').selectOption("minor");
      await dialog.locator('input[name="intervalSeconds"]').fill("30");
      expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await dialog.locator('button[type="submit"]').click();
      const apply = sheet.locator('[data-action="promptEnvironmentExposure"]');
      await expect(apply).toHaveCount(1);
      expect(await page.evaluate(id => game.actors.get(id).system.wounds.minor.current, id)).toBe(0);
      await apply.press("Enter");
      await expect.poll(() => page.evaluate(id => game.actors.get(id).flags.cypher.environmentalExposures[0].sequence, id)).toBe(1);
      expect(await page.evaluate(id => game.actors.get(id).system.wounds.minor.current, id)).toBe(1);
      await apply.press("Enter");
      const confirm = page.locator('.dialog').last();
      await expect(confirm).toBeVisible();
      await confirm.press("Escape");
      expect(await page.evaluate(id => game.actors.get(id).flags.cypher.environmentalExposures[0].sequence, id)).toBe(1);
      await sheet.locator('[data-action="endEnvironment"]').click();
      await expect(apply).toHaveCount(0);
      expect(await page.evaluate(id => game.actors.get(id).system.wounds.minor.current, id)).toBe(1);
      await page.evaluate(async id => { await game.actors.get(id).sheet.close(); }, id);
    }
  } finally {
    await page.evaluate(async original => {
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});

test("environment: synthetic defense rerolls after reload preserve later wounds, costs and next occurrence", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.975); // Natural one.
  const data = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E environment base", type: "pc" });
    const scene = await globalThis.Scene.create({ name: "E2E environment scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ name: "E2E environment synthetic", actorId: actor.id, actorLink: false }]);
    await token.actor.update({ "system.xp": 5, "system.effort": 3,
      "system.stats.might.pool.max": 10, "system.stats.might.pool.value": 10,
      "system.stats.speed.pool.max": 10, "system.stats.speed.pool.value": 10 });
    const entry = await token.actor.declareEnvironmentalExposure({ name: "Smoke", mode: "defense", stat: "might", difficulty: 3,
      severity: "moderate", poolDamage: { stat: "speed", amount: 2 }, conditions: [{ kind: "dazed" }],
      intervalSeconds: 60, noPhysicalMovement: true });
    await token.actor.resolveEnvironmentalExposure(entry.id, { expectedSequence: 0, effortLevels: 1 });
    const message = game.messages.contents.findLast(card => card.flags.cypher?.environmentalSource?.id === entry.id);
    await token.actor.addWound("minor");
    return { actor: actor.id, scene: scene.id, token: token.id, exposure: entry.id, message: message.id };
  });
  await page.reload(); await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425); // Twelve.
  const after = await page.evaluate(async data => {
    const actor = game.scenes.get(data.scene).tokens.get(data.token).actor;
    await actor.rerollMessage(game.messages.get(data.message));
    const entry = actor.flags.cypher.environmentalExposures[0];
    const stale = await actor.resolveEnvironmentalExposure(data.exposure, { expectedSequence: 0, intervalPassed: true });
    return { minor: actor.system.wounds.minor.current, moderate: actor.system.wounds.moderate.current,
      might: actor.system.stats.might.pool.value, speed: actor.system.stats.speed.pool.value, xp: actor.system.xp,
      dazed: actor.flags.cypher.generalEffects.some(effect => effect.kind === "dazed"),
      sequence: entry.sequence, state: entry.state, stale,
      baseModerate: game.actors.get(data.actor).system.wounds.moderate.current };
  }, data);
  expect(after).toEqual({ minor: 1, moderate: 0, might: 7, speed: 10, xp: 4, dazed: false,
    sequence: 1, state: "ready", stale: null, baseModerate: 0 });
});

test("environment: game time enables one repeat and explicit protection prevents only declared effects", async ({ e2ePage: page }) => {
  const data = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E environment protected", type: "pc" });
    const entry = await actor.declareEnvironmentalExposure({ name: "Cold", mode: "immediate", severity: "major",
      intervalSeconds: 30, protection: { source: "GM-adjudicated suit", woundReduction: 2 } });
    await actor.resolveEnvironmentalExposure(entry.id, { expectedSequence: 0 });
    return { actor: actor.id, entry: entry.id };
  });
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async data => {
    const actor = game.actors.get(data.actor);
    const premature = await actor.resolveEnvironmentalExposure(data.entry, { expectedSequence: 1 });
    await game.time.advance(30);
    const results = await Promise.all([actor.resolveEnvironmentalExposure(data.entry, { expectedSequence: 1 }),
      actor.resolveEnvironmentalExposure(data.entry, { expectedSequence: 1 })]);
    await actor.endEnvironmentalExposure(data.entry);
    const stopped = await actor.resolveEnvironmentalExposure(data.entry, { expectedSequence: 2, intervalPassed: true });
    return { premature, applied: results.filter(Boolean).length, minor: actor.system.wounds.minor.current,
      major: actor.system.wounds.major.current, stopped, state: actor.flags.cypher.environmentalExposures[0].state };
  }, data);
  expect(result).toEqual({ premature: null, applied: 1, minor: 2, major: 0, stopped: null, state: "ended" });
});
