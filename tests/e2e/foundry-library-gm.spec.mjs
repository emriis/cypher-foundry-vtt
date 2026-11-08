/** GM procedures and screen paginate without executing their described actions. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

test("library GM resources: every EN/FR procedure and screen card, themes, native context and reload", async ({ e2ePage: page }) => {
  test.setTimeout(120_000);
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)),
      counts: { journals: game.journal.size, items: game.items.size, macros: game.macros.size, messages: game.messages.size } };
  });
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on("pageerror", onError);
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        await game.cypher.library.open();
        foundry.applications.instances.get("cypher-library").setPosition({ width: 480, height: 700 });
      }, { language, theme, original });
      const library = page.locator("#cypher-library");
      await library.locator(`[data-action="language"][data-language="${language}"]`).click();
      await expect(library.locator(`[data-action="language"][data-language="${language}"]`)).toHaveAttribute("aria-pressed", "true");
      await expect(library.locator('.library-gm-guides [data-key="gm-guide"]')).toHaveCount(1);
      await expect(library.locator('.library-gm-guides [data-key="gm-screen"]')).toHaveCount(1);
      await expect(library.locator('.library-chapters [data-key^="gm-"]')).toHaveCount(0);
      for (const [key, count] of [["gm-guide", 12], ["gm-screen", 8]]) {
        const button = library.locator(`[data-key="${key}"]`);
        await button.focus(); await button.press("Enter");
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await expect(library.locator('[data-action="page"]')).toHaveCount(count);
        const pages = await library.locator('[data-action="page"]').evaluateAll(nodes => nodes.map(node => node.dataset.pageId));
        for (const id of pages) {
          const current = library.locator(`[data-action="page"][data-page-id="${id}"]`);
          await current.focus(); await current.press("Enter");
          await expect(current).toHaveAttribute("aria-pressed", "true");
          await expect(library.locator(".library-editorial > section")).toHaveCount(1);
          await expect(library.locator(".library-source .content-link.broken")).toHaveCount(0);
          expect(await library.locator(".library-source").innerText()).not.toContain("CYPHER.");
          expect(await library.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
          if (key === "gm-guide" && id === pages[3] && language === "fr" && theme === "light") {
            await library.locator(".library-source > section").scrollIntoViewIfNeeded();
            await page.screenshot({ path: test.info().outputPath("library-gm-guide-fr.png") });
          }
        }
        const rule = library.locator(".library-source > section .content-link").first();
        await expect(rule).toHaveAttribute("data-uuid", new RegExp(`Compendium\\.cypher\\.rules-${language}\\.`));
        await rule.click();
        await expect.poll(() => page.evaluate(() => [...foundry.applications.instances.values()].some(app =>
          app.document?.documentName === "JournalEntry" && app.rendered))).toBe(true);
        await page.evaluate(async () => {
          for (const app of foundry.applications.instances.values()) if (app.document?.documentName === "JournalEntry" && app.rendered) await app.close();
        });
      }
    }
    expect(await page.evaluate(() => ({ journals: game.journal.size, items: game.items.size, macros: game.macros.size, messages: game.messages.size }))).toEqual(original.counts);
    await page.reload(); await waitForFoundryReady(page);
    await page.evaluate(() => game.cypher.library.open());
    await page.locator('#cypher-library [data-key="gm-guide"]').click();
    await expect(page.locator("#cypher-library .library-editorial > section")).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    page.off("pageerror", onError);
    await page.evaluate(async original => {
      await foundry.applications.instances.get("cypher-library")?.close();
      await game.i18n.setLanguage(original.language);
      await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});

test("library GM sheet entry: cancellation is read-only and selection opens the actual NPC", async ({ e2ePage: page }) => {
  const original = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E library selected NPC", type: "npc", system: { level: 3,
      attacks: [{ name: "E2E declared strike", range: "Immediate", action: "action",
        damage: { mode: "wound", severity: "major", wounds: 1, stat: "might" } }] } });
    return { uuid: actor.uuid, id: actor.id, state: actor.toObject(),
      counts: { actors: game.actors.size, items: game.items.size, messages: game.messages.size, macros: game.macros.size } };
  });
  await page.evaluate(() => game.cypher.library.open());
  const library = page.locator("#cypher-library");
  await library.locator('[data-key="gm-screen"]').click();
  await expect(library.locator('[data-key="gm-screen"]')).toHaveAttribute("aria-pressed", "true");
  await library.locator('[data-action="gmSheet"]').click();
  const dialog = page.locator(".application.dialog").filter({ has: page.locator('select[name="actor"]') });
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-action="close"]').click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(id => game.actors.get(id).sheet.rendered, original.id)).toBeFalsy();
  await library.locator('[data-action="gmSheet"]').click();
  await expect(dialog).toBeVisible();
  const value = await dialog.locator('select[name="actor"] option').evaluateAll(nodes =>
    nodes.find(node => node.textContent.includes("E2E library selected NPC")).value);
  await dialog.locator('select[name="actor"]').selectOption(value);
  await dialog.locator('button[data-action="ok"]').click();
  await expect.poll(() => page.evaluate(uuid => [...foundry.applications.instances.values()].some(app =>
    app.document?.uuid === uuid && app.rendered), original.uuid)).toBe(true);
  await expect(page.locator('[data-action="rollNpcAttack"]').first()).toBeVisible();
  expect(await page.evaluate(id => game.actors.get(id).toObject(), original.id)).toEqual(original.state);
  expect(await page.evaluate(() => ({ actors: game.actors.size, items: game.items.size,
    messages: game.messages.size, macros: game.macros.size }))).toEqual(original.counts);
});
