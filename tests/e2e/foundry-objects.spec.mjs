/** CRD Damage to Objects: real sheets, material declarations and persisted target attribution. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

test("objects: EN/FR sheets in both themes persist authoring and explicit damage/reset actions", async ({ e2ePage: page }) => {
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
        const actor = await Actor.create({ name: "E2E material window", type: "object", system: { originalLevel: 2, material: "glass" } });
        await actor.sheet.render({ force: true }); actor.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return actor.id;
      }, { language, theme, original });
      const sheet = page.locator(".cypher.sheet.actor.object");
      await expect(sheet.locator('[data-action="damageObject"]')).toHaveText(language === "fr" ? "Appliquer des dégâts bruts" : "Apply raw damage");
      await sheet.locator('input[name="system.material"]').fill("E2E glass");
      await sheet.locator('input[name="system.material"]').press("Tab");
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.material, id)).toBe("E2E glass");
      await sheet.locator('[data-action="damageObject"]').press("Enter");
      await page.locator('input[name="damage"]').fill("100");
      await page.locator('input[name="damage"]').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.status, id)).toBe("broken");
      expect(await page.evaluate(id => game.actors.get(id).system.destructionDamage, id)).toBe(0);
      await sheet.locator('[data-action="resetObject"]').press("Enter");
      await page.locator('dialog[open] button[data-action="no"]').press("Enter");
      await expect(page.locator('dialog[open] button[data-action="no"]')).toHaveCount(0);
      expect(await page.evaluate(id => game.actors.get(id).system.status, id)).toBe("broken");
      await sheet.locator('[data-action="resetObject"]').press("Enter");
      await page.locator('dialog[open] button[data-action="yes"]').press("Enter");
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.status, id)).toBe("functional");
      const overflow = await sheet.evaluate(element => element.scrollWidth > element.clientWidth + 1);
      expect(overflow).toBe(false);
      await page.reload(); await waitForFoundryReady(page);
      expect(await page.evaluate(id => ({ material: game.actors.get(id).system.material, status: game.actors.get(id).system.status }), id))
        .toEqual({ material: "E2E glass", status: "functional" });
      await page.evaluate(async id => { await game.actors.get(id).delete(); }, id);
    }
  } finally {
    await page.evaluate(async original => {
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});

test("objects: weapon attacks break then destroy a synthetic door without changing its base Actor", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.275); // d20 = 15, no special damage.
  const result = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E object attacker", type: "pc" });
    const [weapon] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E door tool", type: "attack",
      flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 2 } } },
      system: { damage: 7, freelyUsable: true } }]);
    const base = await Actor.create({ name: "E2E steel door", type: "object", system: { originalLevel: 6, material: "steel" } });
    const scene = await globalThis.Scene.create({ name: "E2E object tokens", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    const door = token.actor, levels = [], statuses = [];
    for (let i = 0; i < 4; i++) {
      await weapon.rollAttack({ target: door, difficulty: 0, assetSteps: 2,
        objectInteraction: { method: "physicalTool", toolHardEnough: true } });
      levels.push(door.system.level); statuses.push(door.system.status);
    }
    return { levels, statuses, destruction: door.system.destructionDamage, base: base.system.level,
      stillExists: Boolean(scene.tokens.get(token.id)), health: door.system.health ?? null };
  });
  expect(result).toEqual({ levels: [5, 3, 0, 0], statuses: ["functional", "functional", "broken", "destroyed"],
    destruction: 6, base: 6, stillExists: true, health: null });
});

test("objects: the PC weapon dialog fixes difficulty and requires explicit tool compatibility before spending", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E material dialog", type: "pc", system: {
      stats: { might: { pool: { value: 20, max: 20 }, edge: 0 } } } });
    const [weapon] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E physical tool", type: "attack",
      flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 2 } } },
      system: { damage: 7, freelyUsable: true } }]);
    const object = await Actor.create({ name: "E2E dialog door", type: "object", system: { originalLevel: 3, material: "E2E steel" } });
    const scene = await globalThis.Scene.create({ name: "E2E material dialog scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: object.id, actorLink: false, x: 100, y: 100 }]);
    await scene.view(); canvas.tokens.get(token.id).setTarget(true, { releaseOthers: true });
    await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
    return { pc: pc.id, weapon: weapon.id, scene: scene.id, token: token.id };
  });
  const attack = page.locator(`[data-action="rollAttack"][data-item-id="${ids.weapon}"]`);
  await attack.press("Enter");
  await expect(page.locator('input[name="difficulty"]')).toHaveValue("3");
  await expect(page.locator('input[name="difficulty"]')).toHaveAttribute("readonly", "");
  await page.locator('input[name="effort"]').fill("1");
  await page.locator('select[name="objectMethod"]').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator('select[name="objectMethod"]')).toHaveCount(0);
  expect(await page.evaluate(ids => game.actors.get(ids.pc).system.stats.might.pool.value, ids)).toBe(20);
  await attack.press("Enter");
  await page.locator('select[name="toolHardEnough"]').selectOption("yes");
  await page.locator('select[name="objectMethod"]').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect.poll(() => page.evaluate(ids => game.scenes.get(ids.scene).tokens.get(ids.token).actor.system.status, ids)).toBe("broken");
});

test("objects: persisted XP rerolls correct the last hit, preserve later edits and use real monomolecular mechanics", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.925); // d20 = 2.
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E object reroll", type: "pc", system: { xp: 5, effort: 2,
      stats: { might: { pool: { value: 20, max: 20 }, edge: 0 } } } });
    const pack = game.packs.get("cypher.equipment-en");
    const index = await pack.getIndex({ fields: ["system.mechanics.cutsThroughMaterialsLevel"] });
    const entry = index.find(entry => entry.system?.mechanics?.cutsThroughMaterialsLevel === 6);
    if (!entry) throw Error("Missing CRD cutting weapon");
    const source = (await pack.getDocument(entry._id)).toObject(); delete source._id;
    source.flags = { ...source.flags, cypher: { ...source.flags?.cypher, equipmentUse: { version: 1, held: true, hands: 1 } } };
    const [blade] = await pc.createEmbeddedDocuments("Item", [source]);
    const object = await Actor.create({ name: "E2E cutter target", type: "object", system: { originalLevel: 6 } });
    await blade.rollAttack({ target: object, effortLevels: 1, objectInteraction: { method: "physicalTool" } });
    const message = game.messages.contents.findLast(message => message.flags.cypher?.objectConsequences?.targetUuid === object.uuid);
    return { pc: pc.id, target: object.id, message: message.id };
  });
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.275);
  const corrected = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), target = game.actors.get(ids.target);
    await pc.rerollMessage(game.messages.get(ids.message));
    return { damage: target.system.levelDamage, cuts: game.messages.get(ids.message).flags.cypher.objectConsequences.cuts,
      xp: pc.system.xp, pool: pc.system.stats.might.pool.value };
  }, ids);
  expect(corrected.damage).toBeGreaterThan(0); expect(corrected.cuts).toBe(true); expect(corrected.xp).toBe(4);
  await page.evaluate(async ids => { await game.actors.get(ids.target).update({ "system.material": "changed" }); }, ids);
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
  const later = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), target = game.actors.get(ids.target);
    await pc.rerollMessage(game.messages.get(ids.message), { chooseSpecialEffect: async () => "damage" });
    return { damage: target.system.levelDamage, state: game.messages.get(ids.message).flags.cypher.objectConsequences.state,
      xp: pc.system.xp, pool: pc.system.stats.might.pool.value };
  }, ids);
  expect(later.damage).toBe(corrected.damage); expect(later.state).toBe("manual"); expect(later.xp).toBe(3);
  expect(later.pool).toBe(20); // The natural-20 cost exception remains independent of target reconciliation.
});
