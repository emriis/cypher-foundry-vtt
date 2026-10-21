/** General-rule UI, token identity and retained consequences in real Foundry. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

test("general rules: condition and guard controls persist and render in both locales and themes", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  const id = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E general conditions", type: "pc" });
    await actor.sheet.render({ force: true });
    return actor.id;
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const labels = await page.evaluate(async ({ id, original, language, theme }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const sheet = game.actors.get(id).sheet;
        if (sheet.rendered) await sheet.close();
        await sheet.render({ force: true });
        sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return { condition: game.i18n.localize("CYPHER.General.conditions"), apply: game.i18n.localize("CYPHER.General.apply") };
      }, { id, original, language, theme });
      const sheet = page.locator(".cypher.sheet.pc");
      await expect(sheet.locator('[data-action="promptGeneralCondition"]')).toHaveText(labels.condition);
      await sheet.locator('[data-action="promptGeneralCondition"]').press("Enter");
      const dialog = page.locator('.dialog:has(select[name="condition"])');
      await expect(dialog).toBeVisible();
      expect(await dialog.locator(".window-content").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await dialog.locator('select[name="condition"]').selectOption("dazed");
      await dialog.getByRole("button", { name: labels.apply, exact: true }).click();
      await expect.poll(() => page.evaluate(id => game.actors.get(id).flags.cypher.generalEffects[0].kind, id)).toBe("dazed");
      await sheet.locator('[data-action="clearGeneralEffect"]').click();
      await expect(sheet.locator('[data-action="clearGeneralEffect"]')).toHaveCount(0);
    }
    await page.locator('.cypher.sheet.pc [data-action="toggleGuarding"]').click();
    await expect.poll(() => page.evaluate(id => game.actors.get(id).flags.cypher.generalEffects[0]?.kind, id)).toBe("guarding");
    await page.reload();
    await waitForFoundryReady(page);
    expect(await page.evaluate(id => game.actors.get(id).flags.cypher.generalEffects[0].kind, id)).toBe("guarding");
  } finally {
    await page.evaluate(async original => {
      await game.settings.set("core", original.setting, original.config);
      await game.i18n.setLanguage(original.language);
    }, original);
  }
});

test("general rules: synthetic interception and poison consequences reconcile after reload", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.975); // Natural one.
  const ids = await page.evaluate(async () => {
    const helper = await Actor.create({ name: "E2E interceptor base", type: "pc" });
    const pc = await Actor.create({ name: "E2E protected ally", type: "pc", system: { xp: 5 } });
    const npc = await Actor.create({ name: "E2E general foe", type: "npc", system: { level: 3 } });
    const scene = await globalThis.Scene.create({ name: "E2E general tokens", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ name: "E2E synthetic interceptor", actorId: helper.id, actorLink: false }]);
    await npc.rollNpcAttack({ damage: { mode: "wound", severity: "moderate", wounds: 1 } }, {
      target: pc, cooperativeMode: "take", takeAttackActor: token.actor
    });
    const interception = [...game.messages].filter(message => message.flags.cypher?.actorId === pc.id).at(-1);
    await pc.resistSpecialDamage({ kind: "poison", poolDamage: { stat: "speed", amount: 3 },
      conditions: [{ kind: "dazed" }], effortLevels: 1 });
    const poison = [...game.messages].filter(message => message.flags.cypher?.actorId === pc.id).at(-1);
    return { pc: pc.id, helper: helper.id, scene: scene.id, token: token.id, interception: interception.id, poison: poison.id };
  });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425); // Twelve, enough for both recorded defenses.
  const after = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), helper = game.scenes.get(ids.scene).tokens.get(ids.token).actor;
    await helper.addWound("minor");
    await pc.rerollMessage(game.messages.get(ids.interception));
    await pc.rerollMessage(game.messages.get(ids.poison));
    return { minor: helper.system.wounds.minor.current, moderate: helper.system.wounds.moderate.current,
      baseMinor: game.actors.get(ids.helper).system.wounds.minor.current,
      might: pc.system.stats.might.pool.value, speed: pc.system.stats.speed.pool.value,
      dazed: pc.flags.cypher.generalEffects.some(effect => effect.kind === "dazed"), xp: pc.system.xp };
  }, ids);
  expect(after).toEqual({ minor: 1, moderate: 0, baseMinor: 0, might: 5, speed: 8, dazed: false, xp: 3 });
});

test("general rules: help expires on an actual source turn and specialist damage resists ordinary recovery", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.975);
  const ids = await page.evaluate(async () => {
    const helper = await Actor.create({ name: "E2E turn helper", type: "pc" });
    const pc = await Actor.create({ name: "E2E disease target", type: "pc" });
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", [
      { actorId: helper.id, initiative: 20 }, { actorId: pc.id, initiative: 10 }
    ]);
    await combat.startCombat();
    await helper.declareCooperation(pc, { kind: "defenseHelp" });
    await combat.nextTurn();
    const { getGeneralEffects } = await import("/systems/cypher/module/applications/general-effect-service.mjs");
    const before = getGeneralEffects(pc).some(effect => effect.kind === "defenseHelp");
    await pc.resistSpecialDamage({ kind: "disease", severity: "minor", specialistRequired: true, ongoing: true });
    await pc.rollRecovery("tenMinutes");
    return { helper: helper.id, pc: pc.id, combat: combat.id, before,
      protected: pc.system.wounds.minor.current };
  });
  expect(ids.before).toBe(true);
  expect(ids.protected).toBe(1);
  await page.reload();
  await waitForFoundryReady(page);
  const after = await page.evaluate(async ids => {
    await game.combats.get(ids.combat).nextTurn();
    const { getGeneralEffects } = await import("/systems/cypher/module/applications/general-effect-service.mjs");
    return getGeneralEffects(game.actors.get(ids.pc)).some(effect => effect.kind === "defenseHelp");
  }, ids);
  expect(after).toBe(false);
});
