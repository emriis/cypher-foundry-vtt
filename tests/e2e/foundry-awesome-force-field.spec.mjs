/** Actual field activation, optional shattering, persisted barriers and synthetic containment. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function source(page, actorId, key = "awesome-force-field", language = "en") {
  return page.evaluate(async ({ actorId, key, language }) => {
    const pack = game.packs.get(`cypher.abilities-${language}`), index = await pack.getIndex({ fields: ["system.key"] });
    const row = index.find(entry => entry.system.key === key);
    if (!row) throw Error(`Missing source: ${key}`);
    const data = (await pack.getDocument(row._id)).toObject(); delete data._id;
    return (await game.actors.get(actorId).createEmbeddedDocuments("Item", [data]))[0].id;
  }, { actorId, key, language });
}
async function submit(page, selector = "[data-protection-dialog]") {
  await page.locator(selector).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(selector)).toHaveCount(0);
}

async function yes(page) { await page.locator('dialog[open] button[data-action="yes"]').press("Enter"); }

test("awesome field: EN/FR light/dark activation, selected Intellect Block and optional shattering", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const id = await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        return (await Actor.create({ name: `E2E awesome ${language} ${theme}`, type: "pc", system: { effort: 2,
          stats: { intellect: { pool: { value: 20, max: 20 }, edge: 2 } } } })).id;
      }, { language, theme, original });
      const item = await source(page, id, "awesome-force-field", language);
      await page.evaluate(async id => { const sheet = game.actors.get(id).sheet; await sheet.render({ force: true }); sheet.setPosition({ width: 640, height: 700 }); }, id);
      const sheet = page.locator('.cypher.sheet.actor.pc').filter({ has: page.locator(`[data-item-id="${item}"][data-action="activateAwesomeAction"]`) });
      await sheet.locator('[data-action="activateAwesomeAction"]').click(); await yes(page);
      await expect.poll(() => page.evaluate(id => Boolean(game.actors.get(id).flags.cypher?.awesomePersonal), id)).toBe(true);
      // Reload restores Foundry's generator; seed every iteration again.
      await setDiceUniform(page, 0.525);
      await sheet.locator('[data-action="rollDefense"][data-defense-type="block"]').click();
      await page.locator('select[name="blockPower"]').selectOption("awesome");
      await page.locator('input[name="difficulty"]').fill("3"); await page.locator('input[name="effort"]').fill("1");
      await page.locator('select[name="incomingSeverity"]').selectOption("major"); await submit(page, 'select[name="blockPower"]');
      await expect(page.locator('[data-awesome-shatter]')).toBeVisible(); await yes(page);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.stats.intellect.pool.value, id)).toBe(14);
      const state = await page.evaluate(id => {
        const actor = game.actors.get(id), flags = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid).flags.cypher;
        return { wound: actor.system.wounds.moderate.current, stat: flags.stat, shatter: flags.awesomeBlock.shattered };
      }, id);
      expect(state).toEqual({ wound: 0, stat: "intellect", shatter: true });
      await page.reload(); await waitForFoundryReady(page);
      await page.evaluate(async id => game.actors.get(id).sheet.render({ force: true }), id);
      await page.locator('[data-action="restoreAwesomeAction"]').click(); await yes(page);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).flags.cypher.awesomePersonal.shatteredUntil, id)).toBe(null);
      await page.evaluate(async id => game.actors.get(id).sheet.close(), id);
    }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original);
  }
});

test("awesome field: declared cube, synthetic containment, object breaking and recovery expiry", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const caster = await Actor.create({ name: "E2E barrier owner", type: "pc", system: { effort: 3, stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } });
    const base = await Actor.create({ name: "E2E barrier base", type: "npc", system: { level: 2, health: { value: 6, max: 6 } } });
    const scene = await globalThis.Scene.create({ name: "E2E barrier scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    await token.actor.update({ name: "E2E contained synthetic" }); await scene.view(); canvas.tokens.get(token.id).setTarget(true, { releaseOthers: true });
    return { caster: caster.id, base: base.id, npc: token.actor.uuid, scene: scene.id, token: token.id };
  });
  // Scene activation and drawing can overlap; wait for this actual token owner
  // before opening a dialog whose candidates come from the current scene.
  await expect.poll(() => page.evaluate(ids => ({ ready: canvas.ready, scene: canvas.scene?.id,
    npc: canvas.tokens?.get(ids.token)?.actor?.uuid }), ids)).toEqual({ ready: true, scene: ids.scene, npc: ids.npc });
  const item = await source(page, ids.caster);
  await page.evaluate(async id => game.actors.get(id).sheet.render({ force: true }), ids.caster);
  await page.locator(`[data-action="createAwesomeAction"][data-item-id="${item}"]`).click();
  await page.locator('select[name="shape"]').selectOption("cube"); await page.locator('input[name="location"]').fill("E2E declared cube");
  await page.locator('input[name="inRange"]').check();
  const occupant = page.locator(`[data-awesome-create]`).locator("xpath=ancestor::form").locator(`input[type="checkbox"][value="${ids.npc}"]`);
  await expect(occupant).toHaveCount(1); await occupant.check(); await submit(page, '[data-awesome-create]');
  await expect(page.locator('[data-action="captureAwesomeAction"]')).toBeVisible();
  await page.locator('[data-action="captureAwesomeAction"]').click(); await page.locator('input[name="effort"]').fill("1"); await submit(page, '[data-awesome-capture]');
  await expect(page.locator('[data-action="captureAwesomeAction"]')).toHaveCount(0);
  const state = await page.evaluate(async ids => {
    const caster = game.actors.get(ids.caster), npc = await fromUuid(ids.npc), field = Object.values(caster.flags.cypher.awesomeBarriers)[0];
    const read = await import("/systems/cypher/module/applications/awesome-field-read.mjs");
    await npc.sheet.render({ force: true });
    return { object: field.objectUuid, pool: caster.system.stats.intellect.pool.value, contained: read.awesomeContainments(npc).length, hp: npc.system.health.value, base: game.actors.get(ids.base).flags.cypher?.awesomeContainments ?? null };
  }, ids);
  expect(state).toMatchObject({ pool: 16, contained: 1, hp: 6, base: null });
  await expect(page.locator('[data-action="releaseAwesomeAction"]')).toBeVisible();
  await page.locator('.cypher.sheet.actor.npc [data-action="openAwesomeAction"]').click();
  await expect(page.locator('.cypher.sheet.actor.object [name="system.originalLevel"]')).toBeDisabled();
  await page.locator('.cypher.sheet.actor.object [data-action="damageObject"]').click(); await page.locator('input[name="damage"]').fill("20"); await submit(page, 'input[name="damage"]');
  await expect.poll(() => page.evaluate(async uuid => (await fromUuid(uuid)).system.levelDamage, state.object)).toBe(6);
  await expect(page.locator('[data-action="releaseAwesomeAction"]')).toHaveCount(0);
  await page.reload(); await waitForFoundryReady(page);
  const after = await page.evaluate(async ({ ids, state }) => {
    const caster = game.actors.get(ids.caster), object = await fromUuid(state.object), damage = await import("/systems/cypher/module/applications/object-service.mjs");
    await damage.damageObject(object, 6); const destroyed = object.system.destructionDamage;
    await caster.rollRecovery("tenMinutes", { completed: true });
    return { destroyed, expired: damage.objectDisplay(object).status, rejected: await damage.damageObject(object, 10) };
  }, { ids, state });
  expect(after).toEqual({ destroyed: 6, expired: "expired", rejected: false });
});

test("awesome field: paid defense reroll cancels the original wound, retains costs and later twenty refunds once", async ({ e2ePage: page }) => {
  const id = await page.evaluate(async () => (await Actor.create({ name: "E2E awesome reroll", type: "pc", system: { xp: 5, effort: 2,
    stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } })).id);
  const item = await source(page, id); await setDiceUniform(page, 0.975);
  const messageId = await page.evaluate(async ({ id, item }) => {
    const actor = game.actors.get(id); await game.cypher.forceFields.activateAwesomePersonal(actor, item, { confirmed: true });
    await actor.rollDefense("block", { difficulty: 3, awesomeField: true, incomingSeverity: "major", effortLevels: 1 });
    await actor.addWound("minor");
    return game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid).id;
  }, { id, item });
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.525);
  const result = await page.evaluate(async ({ id, messageId }) => {
    const actor = game.actors.get(id); await actor.rerollMessage(game.messages.get(messageId), { chooseFieldShatter: async () => true });
    return { pool: actor.system.stats.intellect.pool.value, minor: actor.system.wounds.minor.current, major: actor.system.wounds.major.current, xp: actor.system.xp };
  }, { id, messageId });
  expect(result).toEqual({ pool: 13, minor: 1, major: 0, xp: 4 });
  await setDiceUniform(page, 0.025);
  const refund = await page.evaluate(async ({ id, messageId }) => {
    const actor = game.actors.get(id); await actor.rerollMessage(game.messages.get(messageId)); const pool = actor.system.stats.intellect.pool.value;
    await actor.update({ "system.stats.intellect.pool.value": 18 }); await actor.rerollMessage(game.messages.get(messageId));
    return { pool, repeated: actor.system.stats.intellect.pool.value };
  }, { id, messageId });
  expect(refund).toEqual({ pool: 20, repeated: 18 });
});

test("awesome field: an already successful Block can newly shatter for free on a retained twenty", async ({ e2ePage: page }) => {
  const id = await page.evaluate(async () => (await Actor.create({ name: "E2E awesome residual twenty", type: "pc", system: { xp: 3, effort: 2,
    stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } })).id);
  const item = await source(page, id);
  const messageId = await page.evaluate(async ({ id, item }) => {
    const actor = game.actors.get(id); await game.cypher.forceFields.activateAwesomePersonal(actor, item, { confirmed: true });
    await actor.rollDefense("block", { difficulty: 3, awesomeField: true, incomingSeverity: "major", effortLevels: 1, chooseFieldShatter: async () => false });
    return game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid).id;
  }, { id, item });
  await setDiceUniform(page, 0.025);
  const state = await page.evaluate(async ({ id, messageId }) => {
    const actor = game.actors.get(id); await actor.rerollMessage(game.messages.get(messageId), { chooseFieldShatter: async () => true });
    return { wound: actor.system.wounds.moderate.current, pool: actor.system.stats.intellect.pool.value,
      shattered: Boolean(actor.flags.cypher.awesomePersonal.shatteredUntil) };
  }, { id, messageId });
  expect(state).toEqual({ wound: 0, pool: 20, shattered: true });
});
