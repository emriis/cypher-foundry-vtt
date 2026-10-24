/** Actual grips, source prerequisites and conflict refusal in a disposable Foundry world. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function gripDialog(page, id, held, hands) {
  await page.locator(`.equipment-hands [data-action="promptEquipmentUse"][data-item-id="${id}"]`).press("Enter");
  const form = page.locator('input[name="hands"]').locator("xpath=ancestor::form");
  await form.locator('input[name="held"]').setChecked(held);
  await form.locator('input[name="hands"]').fill(String(hands));
  await form.locator('button[type="submit"]').press("Enter");
  await expect(page.locator('input[name="hands"]')).toHaveCount(0);
}

test("equipment hands: EN/FR and both themes refuse conflicts without unequipping and persist grips", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const ids = await page.evaluate(async ({ original, language, theme }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const actor = await Actor.create({ name: `E2E hands ${language} ${theme}`, type: "pc" });
        const weapon = (await actor.createEmbeddedDocuments("Item", [{ name: "E2E heavy weapon", type: "attack",
          system: { attackType: "heavy", stat: "might", damage: 6, freelyUsable: true } }]))[0];
        const shield = (await actor.createEmbeddedDocuments("Item", [{ name: "E2E shield", type: "shield", system: { equipped: true } }]))[0];
        await actor.sheet.render({ force: true }); actor.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return { actor: actor.id, weapon: weapon.id, shield: shield.id };
      }, { original, language, theme });
      await expect(page.locator(".equipment-hands h3")).toContainText(language === "fr" ? "Mains et préparation" : "Hands and weapon setup");
      await page.locator(`.equipment-hands [data-item-id="${ids.weapon}"] button`).press("Enter");
      await page.locator('input[name="hands"]').press("Escape");
      await expect(page.locator('input[name="hands"]')).toHaveCount(0);
      expect(await page.evaluate(ids => game.actors.get(ids.actor).items.get(ids.weapon).flags.cypher?.equipmentUse ?? null, ids)).toBeNull();
      await gripDialog(page, ids.weapon, true, 2);
      expect(await page.evaluate(ids => game.actors.get(ids.actor).items.get(ids.shield).system.equipped, ids)).toBe(true);
      expect(await page.evaluate(ids => game.actors.get(ids.actor).items.get(ids.weapon).flags.cypher?.equipmentUse ?? null, ids)).toBeNull();
      await gripDialog(page, ids.shield, false, 1);
      await gripDialog(page, ids.weapon, true, 2);
      await expect.poll(() => page.evaluate(ids => game.actors.get(ids.actor).items.get(ids.weapon).flags.cypher?.equipmentUse?.hands, ids)).toBe(2);
      expect(await page.locator(".equipment-hands").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      await page.reload(); await waitForFoundryReady(page);
      expect(await page.evaluate(ids => ({ held: game.actors.get(ids.actor).items.get(ids.weapon).flags.cypher.equipmentUse.held,
        equipped: game.actors.get(ids.actor).items.get(ids.shield).system.equipped, count: game.actors.get(ids.actor).items.size }), ids))
        .toEqual({ held: true, equipped: false, count: 2 });
    }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original);
  }
});

test("equipment hands: synthetic tripod crew survives reload and current inability blocks costs", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.425);
  const ids = await page.evaluate(async () => {
    const base = await Actor.create({ name: "E2E crew base", type: "pc" });
    const target = await Actor.create({ name: "E2E crew target", type: "npc", system: { level: 3, health: { value: 20, max: 20 } } });
    const scene = await globalThis.Scene.create({ name: "E2E crew scene", active: false });
    const tokens = await scene.createEmbeddedDocuments("Token", [
      { name: "E2E gunner", actorId: base.id, actorLink: false }, { name: "E2E operator", actorId: base.id, actorLink: false }
    ]);
    const actor = tokens[0].actor;
    await actor.update({ "system.stats.might.pool.value": 10, "system.stats.might.pool.max": 10, "system.effort": 3 });
    const [weapon] = await actor.createEmbeddedDocuments("Item", [{ name: "E2E mounted weapon", type: "attack", system: {
      attackType: "heavy", damage: 6, stat: "might", freelyUsable: true, mechanics: { requiresTripod: true, requiredOperators: 2 } } }]);
    const { configureEquipmentUse } = await import("/systems/cypher/module/applications/equipment-hands-service.mjs");
    await configureEquipmentUse(weapon, { held: true, hands: 2 });
    const refused = await weapon.rollAttack({ target, effortLevels: 1 });
    if (refused !== null || actor.system.stats.might.pool.value !== 10) throw Error("Missing setup spent resources");
    await configureEquipmentUse(weapon, { held: true, hands: 2, deployed: true, operators: [tokens[1].actor.uuid] });
    return { base: base.id, scene: scene.id, gunner: tokens[0].id, operator: tokens[1].id, weapon: weapon.id, target: target.id };
  });
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.425);
  const result = await page.evaluate(async ids => {
    const scene = game.scenes.get(ids.scene), actor = scene.tokens.get(ids.gunner).actor;
    const weapon = actor.items.get(ids.weapon), operator = scene.tokens.get(ids.operator).actor;
    const hit = await weapon.rollAttack({ target: game.actors.get(ids.target), effortLevels: 1, difficulty: 3 });
    await operator.update({ "flags.cypher.generalEffects": [{ id: "incapacitated", kind: "unconscious" }] });
    const refused = await weapon.rollAttack({ target: game.actors.get(ids.target), effortLevels: 1 });
    return { success: hit?.success, pool: actor.system.stats.might.pool.value, refused,
      health: game.actors.get(ids.target).system.health.value, baseItems: game.actors.get(ids.base).items.size };
  }, ids);
  expect(result).toEqual({ success: true, pool: 7, refused: null, health: 14, baseItems: 0 });
});

test("equipment hands: a later two-handed grip prevents a paid reroll from equipping an old thrown shield", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.975);
  const ids = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E catch hands", type: "pc", system: { xp: 5 } });
    const target = await Actor.create({ name: "E2E catch target", type: "npc", system: { level: 3 } });
    const [ability] = await actor.createEmbeddedDocuments("Item", [{ name: "E2E Throw Shield", type: "ability", system: { key: "throw-shield" } }]);
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ name: "E2E thrown shield", type: "shield", system: { equipped: true } }]);
    const { executeShieldAbility } = await import("/systems/cypher/module/applications/shield-attack-service.mjs");
    await executeShieldAbility(ability, { shieldId: shield.id, targets: [target], rangeConfirmed: true, catchOptions: {} });
    const card = game.messages.contents.findLast(message => message.flags.cypher?.shieldReturn);
    const [weapon] = await actor.createEmbeddedDocuments("Item", [{ name: "E2E two-handed grip", type: "attack", system: { attackType: "heavy" } }]);
    const { configureEquipmentUse } = await import("/systems/cypher/module/applications/equipment-hands-service.mjs");
    await configureEquipmentUse(weapon, { held: true, hands: 2 });
    return { actor: actor.id, shield: shield.id, card: card.id };
  });
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.425);
  const result = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.actor), message = game.messages.get(ids.card);
    await actor.rerollMessage(message);
    return { equipped: actor.items.get(ids.shield).system.equipped,
      inHand: actor.items.get(ids.shield).system.inHand, stale: message.flags.cypher.shieldReturn.stale, xp: actor.system.xp };
  }, ids);
  expect(result).toEqual({ equipped: false, inHand: false, stale: true, xp: 4 });
});
