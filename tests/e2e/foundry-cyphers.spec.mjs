/** Common cypher lifecycle through real documents, compendiums and dashboard controls. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function submit(page, selector) {
  await page.locator(selector).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
}

test("cyphers: EN/FR and both themes stash, retrieve, consume and discard through the dashboard", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const ids = await page.evaluate(async ({ original, language, theme }) => {
        await game.i18n.setLanguage(language); const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const pc = await Actor.create({ name: "E2E cypher inventory", type: "pc" });
        const created = await pc.createEmbeddedDocuments("Item", [
          { name: "E2E physical", type: "cypher", system: { cypherType: "manifest" } },
          { name: "E2E subtle", type: "cypher", system: { cypherType: "subtle" } }]);
        const physical = created.find(item => item.name === "E2E physical"), subtle = created.find(item => item.name === "E2E subtle");
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return { pc: pc.id, physical: physical.id, subtle: subtle.id };
      }, { original, language, theme });
      const row = id => page.locator(`.pc-cypher-row[data-item-id="${id}"]`);
      await row(ids.physical).locator('[data-action="stashCypher"]').press("Enter");
      await page.locator('input[name="location"]').fill("E2E campsite"); await submit(page, 'input[name="location"]');
      await expect(row(ids.physical).locator('[data-action="useCypher"]')).toBeDisabled();
      await expect.poll(() => page.evaluate(ids => game.cypher.cyphers.cypherInventoryDisplay(game.actors.get(ids.pc)).count, ids)).toBe(1);
      await row(ids.physical).locator('[data-action="retrieveCypher"]').press("Enter");
      await page.locator('dialog[open] button[data-action="yes"]').press("Enter");
      await expect(row(ids.physical).locator('[data-action="useCypher"]')).toBeEnabled();
      await row(ids.subtle).locator('[data-action="useCypher"]').press("Enter");
      await expect(row(ids.subtle).locator('[data-action="useCypher"]')).toBeDisabled();
      await page.locator('[data-action="discardCyphers"]').press("Enter");
      await page.locator(`input[name="cypher"][value="${ids.physical}"]`).check(); await submit(page, 'input[name="cypher"]');
      await expect(row(ids.physical)).toContainText(language === "fr" ? "Abandonné" : "Discarded");
      expect(await row(ids.physical).evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.reload(); await waitForFoundryReady(page);
      const saved = await page.evaluate(ids => {
        const actor = game.actors.get(ids.pc); return { count: game.cypher.cyphers.cypherInventoryDisplay(actor).count,
          spent: actor.items.get(ids.subtle).system.depleted, custody: actor.items.get(ids.physical).flags.cypher.custody };
      }, ids);
      expect(saved).toEqual({ count: 0, spent: true, custody: "discarded" });
    }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original);
  }
});

test("cyphers: native batch creation and update enforce actual capacity, including inline Actor imports", async ({ e2ePage: page }) => {
  const result = await page.evaluate(async () => {
    const data = { name: "E2E capacity", type: "cypher", system: { cypherType: "manifest" } };
    const pc = await Actor.create({ name: "E2E native capacity", type: "pc", system: { cypherLimit: 1 } });
    const rejected = await pc.createEmbeddedDocuments("Item", [data, data]);
    const [item] = await pc.createEmbeddedDocuments("Item", [data]);
    await item.update({ "system.depleted": true });
    await pc.createEmbeddedDocuments("Item", [data]); await item.update({ "system.depleted": false });
    const inline = await Actor.create({ name: "E2E inline capacity", type: "pc", system: { cypherLimit: 1 }, items: [data, data] });
    return { rejected: rejected.length, count: pc.items.size, spent: pc.items.get(item.id).system.depleted, inline: Boolean(inline) };
  });
  expect(result).toEqual({ rejected: 0, count: 2, spent: true, inline: false });
});

test("cyphers: manifest generation fixes Teleporter power, awards once and preserves its compendium source", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E generated Teleporter", type: "pc" });
    const { CYPHER_GENERATION } = await import("/systems/cypher/module/rules/cypher-generation-catalogue.mjs");
    const entry = CYPHER_GENERATION.tables.medium.find(entry => entry.variantName === "Bounder");
    const original = CONFIG.Dice.randomUniform, values = [0.545, 1 - (entry.min - 0.5) / 100];
    CONFIG.Dice.randomUniform = () => values.shift();
    let offer;
    try { offer = await game.cypher.cyphers.drawCypher("manifest", { language: "fr" }); }
    finally { CONFIG.Dice.randomUniform = original; }
    if (values.length || offer.power !== "medium") throw Error("Generation did not follow the selected power table");
    const source = await fromUuid(offer.uuid);
    const before = JSON.stringify(source.toObject());
    const options = { requestId: "E2Eaward", confirmed: true, power: offer.power, rolls: offer.rolls };
    await game.cypher.cyphers.acquireCypher(pc, offer.uuid, options); await game.cypher.cyphers.acquireCypher(pc, offer.uuid, options);
    const item = pc.items.find(item => item.type === "cypher");
    return { pc: pc.id, item: item.id, uuid: offer.uuid, sourceUnchanged: before === JSON.stringify(source.toObject()) };
  });
  expect(ids.sourceUnchanged).toBe(true);
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), item = pc.items.get(ids.item), api = game.cypher.cyphers;
    const pending = await api.acquireCypher(pc, ids.uuid, { requestId: "cancelled", power: "medium" });
    return { count: pc.items.size, power: item.system.powerLevel, variants: item.system.variants.length,
      fixed: Boolean(item.flags.cypher.fixedVariant), receipt: pc.flags.cypher.acquisitions.E2Eaward.state, pending };
  }, ids);
  expect(result).toEqual({ count: 1, power: "medium", variants: 0, fixed: true, receipt: "applied", pending: false });
});

test("cyphers: superhero preview cancellation is free and the GM explicitly chooses Power Boost form", async ({ e2ePage: page }) => {
  const id = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E boost award", type: "pc" });
    CONFIG.Dice.randomUniform = () => 0.995;
    await pc.sheet.render({ force: true }); return pc.id;
  });
  for (const cancelled of [true, false]) {
    await page.locator('[data-action="generateCypher"]').press("Enter");
    await page.locator('select[name="table"]').selectOption("superhero"); await submit(page, 'select[name="table"]');
    await expect(page.locator('select[name="table"]')).toHaveCount(0);
    await page.locator('select[name="form"]').selectOption("manifest");
    if (cancelled) {
      await page.locator('select[name="form"]').press("Escape");
      await expect(page.locator('select[name="form"]')).toHaveCount(0);
      expect(await page.evaluate(id => game.actors.get(id).items.size, id)).toBe(0);
    } else await submit(page, 'select[name="form"]');
  }
  await expect.poll(() => page.evaluate(id => game.actors.get(id).items.size, id)).toBe(1);
  const result = await page.evaluate(id => {
    const item = game.actors.get(id).items.contents[0];
    return { category: item.system.cypherCategory, form: item.system.cypherType, level: item.system.level, spent: item.system.depleted };
  }, id);
  expect(result).toEqual({ category: "powerBoost", form: "manifest", level: null, spent: false });
});

test("cyphers: managed combat distinguishes instant activation, manifest actions and grouped native deletion", async ({ e2ePage: page }) => {
  const result = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E cypher timing", type: "pc", system: { cypherLimit: 4 } });
    const created = await pc.createEmbeddedDocuments("Item", ["subtle", "manifest", "manifest", "manifest"].map((form, i) => ({ name: `E2E timing ${i}`, type: "cypher", system: { cypherType: form } })));
    // Batch response order is not an identity contract; resolve the named inputs.
    const [subtle, manifest, first, second] = [0, 1, 2, 3].map(i => created.find(item => item.name === `E2E timing ${i}`));
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", [{ actorId: pc.id, initiative: 10 }]);
    await combat.startCombat();
    await subtle.useCypher(); const instantUsed = Boolean(pc.flags.cypher?.roundActionUsage?.primary);
    await manifest.useCypher(); const primaryUsed = Boolean(pc.flags.cypher.roundActionUsage.primary);
    const refused = await first.useCypher(); const blocked = await pc.deleteEmbeddedDocuments("Item", [first.id, second.id]);
    await combat.nextRound();
    const deleted = await pc.deleteEmbeddedDocuments("Item", [first.id, second.id]);
    return { instantUsed, primaryUsed, refused, blocked: blocked.length, deleted: deleted.length,
      used: pc.flags.cypher.roundActionUsage.primary, spent: pc.items.get(manifest.id).system.depleted };
  });
  expect(result).toEqual({ instantUsed: false, primaryUsed: true, refused: false, blocked: 0, deleted: 2, used: true, spent: true });
});

test("cyphers: interrupted physical transfer survives reload and targets the synthetic inventory only", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const source = await Actor.create({ name: "E2E transfer source", type: "pc" });
    const [item] = await source.createEmbeddedDocuments("Item", [{ name: "E2E transfer", type: "cypher" }]);
    const base = await Actor.create({ name: "E2E transfer base", type: "pc" });
    const scene = await globalThis.Scene.create({ name: "E2E transfer scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    const create = token.actor.createEmbeddedDocuments;
    token.actor.createEmbeddedDocuments = async () => { throw Error("E2E transfer interruption"); };
    try { await game.cypher.cyphers.transferCypher(item, token.actor, { confirmed: true }); }
    catch (error) { if (!error.message.includes("E2E transfer interruption")) throw error; }
    finally { token.actor.createEmbeddedDocuments = create; }
    return { source: source.id, item: item.id, base: base.id, destination: token.actor.uuid };
  });
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async ids => {
    const source = game.actors.get(ids.source), item = source.items.get(ids.item), target = await fromUuid(ids.destination), api = game.cypher.cyphers;
    const pending = item.flags.cypher.custody, refused = await api.transferCypher(item, target, { confirmed: true });
    await api.reconcileCypherTransfer(item, { transferred: false, note: "GM verified no copy was created" });
    const applied = await api.transferCypher(item, target, { confirmed: true });
    return { pending, refused, applied, custody: item.flags.cypher.custody, destination: target.items.size, base: game.actors.get(ids.base).items.size };
  }, ids);
  expect(result).toEqual({ pending: "transferring", refused: false, applied: true, custody: "transferred", destination: 1, base: 0 });
});
