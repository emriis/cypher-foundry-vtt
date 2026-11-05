/** Library pilot against real packs, native links and an ordinary player's client. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { joinAsGamemaster, waitForFoundryReady } from "./foundry-session.mjs";

async function submit(page, selector) {
  await page.locator(selector).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
}

test("library pilot: bilingual source navigation, native Skill links, themes and narrow keyboard access", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        await game.cypher.library.open();
        const app = foundry.applications.instances.get("cypher-library");
        app.setPosition({ width: 480, height: 700 });
      }, { language, theme, original });
      const library = page.locator("#cypher-library");
      await library.locator(`[data-action="language"][data-language="${language}"]`).click();
      const rule = library.locator('[data-key="task-difficulty"]');
      await rule.focus(); await rule.press("Enter");
      await expect(library.locator(".library-source")).toBeVisible();
      expect(await library.locator(".library-source").innerText()).not.toContain("CYPHER.");
      await expect(library.locator(".library-source .content-link")).toHaveAttribute("data-uuid", /Compendium\.cypher\.rules-(en|fr)\.JournalEntry\./);
      const skill = library.locator(".library-skill .content-link");
      await expect(skill).toHaveAttribute("data-uuid", new RegExp(`Compendium\\.cypher\\.skills-${language}\\.Item\\.`));
      await skill.click();
      await expect.poll(() => page.evaluate(() => [...foundry.applications.instances.values()].some(app =>
        app.document?.type === "skill" && app.rendered))).toBe(true);
      await page.evaluate(async () => {
        for (const app of foundry.applications.instances.values()) if (app.document?.type === "skill" && app.rendered) await app.close();
      });
      expect(await library.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    const counts = await page.evaluate(() => ({ journal: game.journal.size, items: game.items.size, macros: game.macros.size }));
    await page.reload(); await waitForFoundryReady(page);
    await page.evaluate(async () => { await ui.sidebar.changeTab("journal", "primary"); await ui.sidebar.expand(); });
    await page.locator(".cypher-library-button").click();
    await expect(page.locator("#cypher-library")).toBeVisible();
    expect(await page.evaluate(() => ({ journal: game.journal.size, items: game.items.size, macros: game.macros.size }))).toEqual(counts);
  } finally {
    await page.evaluate(async original => {
      await foundry.applications.instances.get("cypher-library")?.close();
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});

test("library pilot: cypher preview is ephemeral and home shortcut survives reload without duplicate creation", async ({ e2ePage: page }) => {
  const baseline = await page.evaluate(() => ({ macros: [...game.macros].map(macro => macro.id), items: game.items.size, messages: game.messages.size }));
  try {
    await page.evaluate(() => game.cypher.library.open());
    await page.locator('#cypher-library [data-action="draw"]').click();
    await page.locator('select[name="table"]').selectOption("manifest");
    await submit(page, 'select[name="table"]');
    await expect(page.locator('.dialog .content-link, .application.dialog .content-link')).toBeVisible();
    await page.locator('.dialog .content-link, .application.dialog .content-link').locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
    expect(await page.evaluate(() => ({ items: game.items.size, messages: game.messages.size }))).toEqual({ items: baseline.items, messages: baseline.messages });
    await page.locator('#cypher-library [data-action="shortcut"]').click();
    await expect.poll(() => page.evaluate(() => game.macros.find(macro => macro.flags.cypher?.libraryShortcut === 1)?.id)).toBeTruthy();
    const shortcut = await page.evaluate(() => game.macros.find(macro => macro.flags.cypher?.libraryShortcut === 1).id);
    await page.reload(); await waitForFoundryReady(page);
    await page.evaluate(id => game.macros.get(id).execute(), shortcut);
    await expect(page.locator("#cypher-library")).toBeVisible();
    await page.locator('#cypher-library [data-action="shortcut"]').click();
    expect(await page.evaluate(() => game.macros.filter(macro => macro.flags.cypher?.libraryShortcut === 1).length)).toBe(1);
  } finally {
    await page.evaluate(async baseline => {
      await foundry.applications.instances.get("cypher-library")?.close();
      for (const macro of [...game.macros]) if (!baseline.macros.includes(macro.id)) { await macro.sheet?.close(); await macro.delete(); }
    }, baseline);
  }
});

test("library pilot: ordinary player reads references and rolls, cancellation and disabled script macros remain safe", async ({ e2ePage: page, browser }) => {
  const ids = await page.evaluate(async () => {
    const user = await globalThis.User.create({ name: "E2E library player", role: CONST.USER_ROLES.PLAYER, password: "" });
    const actor = await Actor.create({ name: "E2E library PC", type: "pc", ownership: { [user.id]: 3 },
      system: { effort: 1, stats: { might: { pool: { value: 10, max: 10 }, edge: 0 } } } });
    await user.update({ character: actor.id });
    const permissions = foundry.utils.deepClone(game.settings.get("core", "permissions"));
    await game.settings.set("core", "permissions", { ...permissions, MACRO_SCRIPT: [CONST.USER_ROLES.GAMEMASTER] });
    return { user: user.id, actor: actor.id, permissions };
  });
  const context = await browser.newContext();
  const tour = await page.evaluate(() => ({ origin: location.origin, progress: localStorage.getItem("core.tourProgress") }));
  await context.addInitScript(tour => {
    if (location.origin === tour.origin && tour.progress) localStorage.setItem("core.tourProgress", tour.progress);
  }, tour);
  const player = await context.newPage(), errors = [];
  player.on("pageerror", error => errors.push(error.message));
  try {
    await joinAsGamemaster(player, "E2E library player");
    await setDiceUniform(player, 0.525);
    await player.evaluate(async id => game.actors.get(id).sheet.render({ force: true }), ids.actor);
    await player.locator('[data-action="openLibrary"]').click();
    const library = player.locator("#cypher-library");
    await library.locator('[data-key="task-difficulty"]').click();
    await expect(library.locator(".library-source")).toBeVisible();
    await library.locator(".library-skill .content-link").click();
    await expect.poll(() => player.evaluate(() => [...foundry.applications.instances.values()].some(app =>
      app.document?.type === "skill" && app.rendered))).toBe(true);
    await player.evaluate(async () => {
      for (const app of foundry.applications.instances.values()) if (app.document?.type === "skill" && app.rendered) await app.close();
    });
    await expect(library.locator('[data-action="draw"]')).toHaveCount(0);
    await expect(library.locator('[data-action="shortcut"]')).toBeDisabled();
    for (const language of ["en", "fr"]) {
      await library.locator(`[data-action="language"][data-language="${language}"]`).click();
      await library.locator('[data-key="crd-descriptors"]').click();
      await library.locator('[data-action="page"]').last().click();
      await expect(library.locator(".library-source > section .content-link")).toHaveCount(33);
      await library.locator(".library-source > section .content-link").first().click();
      await expect.poll(() => player.evaluate(() => [...foundry.applications.instances.values()].some(app =>
        app.document?.type === "descriptor" && app.rendered))).toBe(true);
      await player.evaluate(async () => {
        for (const app of foundry.applications.instances.values()) if (app.document?.type === "descriptor" && app.rendered) await app.close();
      });
    }
    await library.locator('[data-action="task"]').click();
    await submit(player, 'select[name="actor"]');
    await expect(player.locator('input[name="effort"]')).toBeVisible();
    await player.locator(".application.dialog").filter({ has: player.locator('input[name="effort"]') }).locator('[data-action="close"]').click();
    expect(await player.evaluate(id => game.actors.get(id).system.stats.might.pool.value, ids.actor)).toBe(10);
    await library.locator('[data-action="task"]').click();
    await submit(player, 'select[name="actor"]');
    await player.locator('input[name="difficulty"]').fill("0");
    await player.locator('input[name="effort"]').fill("1");
    await submit(player, 'input[name="effort"]');
    await expect.poll(() => player.evaluate(id => game.actors.get(id).system.stats.might.pool.value, ids.actor)).toBe(7);
    await player.reload(); await waitForFoundryReady(player);
    await player.evaluate(() => game.cypher.library.open());
    await expect(player.locator('#cypher-library [data-action="shortcut"]')).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await page.evaluate(async ids => { await game.settings.set("core", "permissions", ids.permissions); }, ids);
  }
});

test("library chapters: every EN/FR chapter page, native contents links and themed narrow layout", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  const keys = ["creating-your-character", "core-character", "skills", "descriptors", "contents"];
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
      for (const key of keys) {
        await library.locator(`[data-key="crd-${key}"]`).click();
        const pages = await library.locator('[data-action="page"]').evaluateAll(buttons => buttons.map(button => button.dataset.pageId));
        expect(pages.length).toBeGreaterThan(0);
        for (const id of pages) {
          const button = library.locator(`[data-action="page"][data-page-id="${id}"]`);
          await button.focus(); await button.press("Enter");
          await expect(button).toHaveAttribute("aria-pressed", "true");
          const contrast = await button.evaluate(element => {
            const style = getComputedStyle(element);
            const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
              const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
            }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
            const foreground = luminance(style.color), background = luminance(style.backgroundColor);
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
          });
          expect(contrast).toBeGreaterThanOrEqual(4.5);
          await expect(library.locator(".library-source > section")).toHaveCount(1);
          await expect(library.locator(".library-source .content-link.broken")).toHaveCount(0);
          expect(await library.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
        }
      }
      // Thematic native page links must resolve to the paired language pack.
      const link = library.locator('.library-source .content-link[data-uuid*="JournalEntryPage"]').first();
      await expect(link).toHaveAttribute("data-uuid", new RegExp(`Compendium\\.cypher\\.rules-${language}\\.`));
      await link.click();
      await expect.poll(() => page.evaluate(() => [...foundry.applications.instances.values()].some(app =>
        app.document?.documentName === "JournalEntry" && app.rendered))).toBe(true);
      await page.evaluate(async () => {
        for (const app of foundry.applications.instances.values()) if (app.document?.documentName === "JournalEntry" && app.rendered) await app.close();
      });
    }
    await page.reload(); await waitForFoundryReady(page);
    await page.evaluate(() => game.cypher.library.open());
    await page.locator('#cypher-library [data-key="crd-contents"]').click();
    await expect(page.locator("#cypher-library .library-source .content-link.broken")).toHaveCount(0);
  } finally {
    await page.evaluate(async original => {
      await foundry.applications.instances.get("cypher-library")?.close();
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});
