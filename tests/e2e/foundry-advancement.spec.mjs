/** Real source grants, all-or-nothing dialog collection and tiers beyond six. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function setSlot(page, actorId, index, type, otherType = "") {
  await page.evaluate(async ({ actorId, index, type, otherType }) => {
    const actor = game.actors.get(actorId), slots = actor.system.advancementSlots.map(slot => ({ ...slot }));
    slots[index] = { type, otherType, bought: false };
    await actor.update({ "system.advancementSlots": slots });
  }, { actorId, index, type, otherType });
}
async function buy(page, index) { await page.locator(`[data-action="purchaseAdvancement"][data-slot="${index}"]`).press("Enter"); }
async function submit(page, selector) {
  const field = page.locator(selector);
  await expect(field).toBeVisible();
  await field.locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(field).toHaveCount(0);
}
async function characterWithFocus(page, tier, xp = 40) {
  return page.evaluate(async ({ tier, xp }) => {
    const actor = await Actor.create({ name: "E2E progression", type: "pc", system: { tier, xp, genre: "fantasy" } });
    const pack = game.packs.get("cypher.foci-en");
    const index = await pack.getIndex();
    const entry = index.find(item => item.name === "Abides in Stone");
    const focus = await pack.getDocument(entry._id);
    const { getInitialFocusAbilityChoices } = await import("/systems/cypher/module/applications/content-service.mjs");
    const roots = await getInitialFocusAbilityChoices(focus);
    if (!await actor.applyFocus(focus, roots.slice(0, 2).map(item => item.id))) throw Error("Focus fixture failed");
    await actor.sheet.render({ force: true }); actor.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
    return actor.id;
  }, { tier, xp });
}

for (const language of ["en", "fr"]) test(`advancement: ${language} UI in both themes resolves fourth-purchase choices before XP`, async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const key = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { key, config: foundry.utils.deepClone(game.settings.get("core", key)), language: game.i18n.lang };
  });
  try {
    for (const theme of ["light", "dark"]) {
      await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.key, original.key === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
      }, { language, theme, original });
      const id = await characterWithFocus(page, 2);
      await setSlot(page, id, 0, "effort"); await buy(page, 0);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.xp, id)).toBe(36);
      await expect(page.locator(".pc-advancement-slot.bought select").first()).toBeDisabled();
      // An ordinary form submission must retain every previously bought slot field.
      await page.waitForFunction(id => { const sheet = game.actors.get(id).sheet; return sheet.state === sheet.constructor.RENDER_STATES.RENDERED; }, id);
      await page.locator('[name="system.advancementSlots.1.type"]').selectOption("perfection");
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.advancementSlots[1].type, id)).toBe("perfection");
      await buy(page, 1); await submit(page, 'select[name="stat"]');
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.xp, id)).toBe(32);
      await setSlot(page, id, 2, "capabilities"); await buy(page, 2);
      await page.locator('input[name="might"]').fill("4"); await submit(page, 'input[name="might"]');
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.xp, id)).toBe(28);
      await setSlot(page, id, 3, "skill"); await buy(page, 3);
      await page.locator('input[name="newSkillName"]').fill("E2E Navigation"); await submit(page, 'input[name="newSkillName"]');
      await page.locator('select[name="focusAbility"]').press("Escape");
      await expect(page.locator('select[name="focusAbility"]')).toHaveCount(0);
      expect(await page.evaluate(id => ({ xp: game.actors.get(id).system.xp, tier: game.actors.get(id).system.tier,
        skill: game.actors.get(id).items.some(item => item.name === "E2E Navigation") }), id)).toEqual({ xp: 28, tier: 2, skill: false });
      await buy(page, 3); await page.locator('input[name="newSkillName"]').fill("E2E Navigation");
      await submit(page, 'input[name="newSkillName"]'); await submit(page, 'select[name="focusAbility"]'); await submit(page, 'select[name="genreAbility"]');
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.tier, id)).toBe(3);
      const result = await page.evaluate(id => {
        const actor = game.actors.get(id);
        return { xp: actor.system.xp, resources: actor.system.resourcePoints, skill: actor.items.some(item => item.name === "E2E Navigation"),
          roots: actor.flags.cypher.focusAbilityIds.length, genre: actor.items.some(item => item.flags.cypher?.grantOrigin?.kind === "genre"),
          pending: actor.flags.cypher.focusAbilityPendingTier, slots: actor.system.advancementSlots.every(slot => !slot.bought) };
      }, id);
      expect(result).toEqual({ xp: 24, resources: 4, skill: true, roots: 3, genre: true, pending: null, slots: true });
      await page.reload(); await waitForFoundryReady(page);
      expect(await page.evaluate(id => game.actors.get(id).system.tier, id)).toBe(3);
      await page.evaluate(async id => { await game.actors.get(id).delete(); }, id);
    }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.key, original.config); }, original);
  }
});

test("advancement: paid Focus and Genre choices use actual sources and a cancelled choice spends nothing", async ({ e2ePage: page }) => {
  const id = await characterWithFocus(page, 3);
  const initial = await page.evaluate(id => game.actors.get(id).flags.cypher.focusAbilityIds.length, id);
  await setSlot(page, id, 0, "other", "focus"); await buy(page, 0);
  await page.locator('select[name="focusAbility"]').press("Escape");
  await expect(page.locator('select[name="focusAbility"]')).toHaveCount(0);
  expect(await page.evaluate(id => game.actors.get(id).system.xp, id)).toBe(40);
  await buy(page, 0); await submit(page, 'select[name="focusAbility"]');
  await expect.poll(() => page.evaluate(id => game.actors.get(id).system.xp, id)).toBe(36);
  expect(await page.evaluate(id => game.actors.get(id).flags.cypher.focusAbilityIds.length, id)).toBe(initial + 1);
  // Another character exercises the alternative replacement, since only one is legal per tier.
  const second = await characterWithFocus(page, 3);
  await page.evaluate(async id => { await game.actors.get(id).sheet.close(); }, id);
  await setSlot(page, second, 0, "other", "genre"); await buy(page, 0); await submit(page, 'select[name="genreAbility"]');
  await expect.poll(() => page.evaluate(id => game.actors.get(id).system.resourcePoints, second)).toBe(2);
  expect(await page.evaluate(id => game.actors.get(id).items.filter(item => item.flags.cypher?.grantOrigin?.kind === "genre").length, second)).toBe(1);
});

test("advancement: a synthetic PC reaches tier seven and interruption checkpoints survive reload", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const base = await Actor.create({ name: "E2E progression base", type: "pc", system: { tier: 6, xp: 40, effort: 6, genre: "none" } });
    const scene = await globalThis.Scene.create({ name: "E2E progression scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    const actor = token.actor;
    await actor.update({ "system.advancementSlots": ["capabilities", "perfection", "skill", "other"].map(type => ({ type, otherType: type === "other" ? "weapons" : "", bought: type !== "other" })) });
    await actor.purchaseAdvancementSlot(3);
    if (actor.system.tier !== 7 || actor.system.resourcePoints !== 3 || base.system.tier !== 6) throw Error("Synthetic tier transition failed");
    await actor.update({ "system.advancementSlots.0.type": "skill" });
    const original = actor.createEmbeddedDocuments;
    actor.createEmbeddedDocuments = async () => { throw Error("E2E interrupted Item write"); };
    try { await actor.purchaseAdvancementSlot(0, { newSkillName: "E2E interrupted" }); } catch (error) { if (!error.message.includes("E2E interrupted")) throw error; }
    finally { actor.createEmbeddedDocuments = original; }
    return { scene: scene.id, token: token.id, base: base.id };
  });
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async ids => {
    const actor = game.scenes.get(ids.scene).tokens.get(ids.token).actor;
    const xp = actor.system.xp;
    const replay = await actor.purchaseAdvancementSlot(0, { newSkillName: "E2E interrupted" });
    await actor.sheet.render({ force: true });
    return { tier: actor.system.tier, xp, unchanged: actor.system.xp === xp, replay, pending: Boolean(actor.flags.cypher.advancementPending), base: game.actors.get(ids.base).system.tier };
  }, ids);
  expect(result).toEqual({ tier: 7, xp: 32, unchanged: true, replay: false, pending: true, base: 6 });
  await expect(page.locator('[data-action="promptAdvancementReconciliation"]')).toBeVisible();
});
