/** Exercise intrusion authority and persisted XP through actual Foundry documents and clients. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { joinAsGamemaster, waitForFoundryReady } from "./foundry-session.mjs";

async function setup(page) {
  return page.evaluate(async () => {
    const players = [], actors = [];
    for (const name of ["Alice", "Bob"]) {
      const user = await globalThis.User.create({ name: `E2E intrusion ${name}`, role: CONST.USER_ROLES.PLAYER });
      const actor = await Actor.create({ name: `E2E intrusion ${name}`, type: "pc", system: { xp: 5 },
        ownership: { [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
      await user.update({ character: actor.id });
      players.push(user.id); actors.push(actor.id);
    }
    return { players, actors };
  });
}

test("intrusions: player requests, GM decisions and automatic shares survive reload across clients", async ({ e2ePage: page, browser }) => {
  const data = await setup(page);
  const context = await browser.newContext();
  const tour = await page.evaluate(() => ({ origin: location.origin, progress: localStorage.getItem("core.tourProgress") }));
  await context.addInitScript(tour => {
    if (location.origin === tour.origin && tour.progress) localStorage.setItem("core.tourProgress", tour.progress);
  }, tour);
  const player = await context.newPage();
  try {
    await joinAsGamemaster(player, "E2E intrusion Alice");
    // Native chat can remain outside the viewport while the sidebar is folded.
    // Open the actual sidebar rather than clicking its duplicate notification.
    for (const client of [page, player]) await client.evaluate(async () => {
      await ui.sidebar.changeTab("chat", "primary"); await ui.sidebar.expand();
    });
    const request = await player.evaluate(async data => {
      const actor = game.actors.get(data.actors[0]);
      const card = await actor.usePlayerIntrusion("A friendly witness arrives.");
      return { id: card.id, xp: actor.system.xp, ownsRecipient: game.actors.get(data.actors[1]).isOwner };
    }, data);
    expect(request.xp).toBe(5); expect(request.ownsRecipient).toBe(false);
    const card = page.locator(`#chat .chat-log [data-message-id="${request.id}"]`);
    await expect(card.locator('[data-intrusion-action="Accept"]')).toBeInViewport();
    await card.locator('[data-intrusion-action="Accept"]').click();
    await expect.poll(() => player.evaluate(data => game.actors.get(data.actors[0]).system.xp, data)).toBe(4);
    const origin = await page.evaluate(async data => {
      const card = await game.cypher.intrusions.createGMIntrusion(game.actors.get(data.actors[0]), "The bridge breaks.");
      return card.id;
    }, data);
    await expect(player.locator(`#chat .chat-log [data-message-id="${origin}"] [data-intrusion-action="Share"]`)).toBeVisible();
    await player.locator(`#chat .chat-log [data-message-id="${origin}"] [data-intrusion-action="Share"]`).click();
    await player.locator('select[name="recipient"]').selectOption(data.players[1]);
    await player.locator('select[name="recipient"]').locator("xpath=ancestor::form").locator('button[type="submit"]').click();
    await expect.poll(() => page.evaluate(id => game.messages.get(id).flags.cypher.intrusion.state, origin)).toBe("resolved");
    await page.reload(); await waitForFoundryReady(page);
    await page.evaluate(async () => { await ui.sidebar.changeTab("chat", "primary"); await ui.sidebar.expand(); });
    expect(await page.evaluate(data => data.actors.map(id => game.actors.get(id).system.xp), data)).toEqual([5, 6]);
    const rejected = await player.evaluate(async data => (await game.actors.get(data.actors[0]).usePlayerIntrusion("A rejected coincidence.")).id, data);
    await page.locator(`#chat .chat-log [data-message-id="${rejected}"] [data-intrusion-action="Reject"]`).click();
    await expect.poll(() => page.evaluate(id => game.messages.get(id).flags.cypher.intrusion.state, rejected)).toBe("rejected");
    expect(await player.evaluate(data => game.actors.get(data.actors[0]).system.xp, data)).toBe(5);
  } finally { await context.close(); }
});

test("intrusions: natural-one declarations and next-turn reactions preserve combat action usage", async ({ e2ePage: page }) => {
  const data = await setup(page);
  await setDiceUniform(page, 0.975);
  const result = await page.evaluate(async data => {
    const actor = game.actors.get(data.actors[0]);
    await actor.rollTask({ difficulty: 1, rollRoutine: false });
    const roll = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid
      && message.flags.cypher.rollType === "task");
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", [{ actorId: actor.id, initiative: 10 }]);
    await combat.startCombat();
    const free = await game.cypher.intrusions.createGMIntrusion(actor, "A complication.", { rollMessage: roll });
    const duplicate = await game.cypher.intrusions.createGMIntrusion(actor, "Again.", { rollMessage: roll });
    const early = await actor.usePlayerIntrusion("Too early", { reactionTo: free.uuid });
    await combat.nextTurn();
    await actor.rollTask({ difficulty: 0, rollRoutine: false });
    const usage = JSON.stringify(actor.flags.cypher.roundActionUsage);
    const request = await actor.usePlayerIntrusion("Turn the complication to our advantage.", { reactionTo: free.uuid });
    await game.cypher.intrusions.resolvePlayerIntrusion(request);
    return { natural: roll.flags.cypher.d20, same: free.id === duplicate.id, early,
      xp: actor.system.xp, preserved: usage === JSON.stringify(actor.flags.cypher.roundActionUsage) };
  }, data);
  expect(result).toEqual({ natural: 1, same: true, early: null, xp: 4, preserved: true });
});

test("intrusions: localized sheet declarations and cancelled prompts work in both themes", async ({ e2ePage: page }) => {
  const data = await setup(page);
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const before = await page.evaluate(async ({ original, language, theme, data }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        await game.actors.get(data.actors[0]).sheet.render({ force: true });
        return game.messages.size;
      }, { original, language, theme, data });
      const control = page.locator('[data-action="gmIntrusion"]').first();
      await expect(control).toBeVisible();
      await control.press("Enter");
      const input = page.locator('textarea[name="description"]');
      await expect(input).toBeVisible();
      await expect(input.locator("xpath=ancestor::form")).toContainText(language === "fr" ? "Décrivez" : "Describe");
      await input.fill("A declared complication.");
      await input.locator("xpath=ancestor::form").locator('button[type="submit"]').click();
      await expect.poll(() => page.evaluate(() => game.messages.size)).toBe(before + 1);
      await page.evaluate(async data => { await game.actors.get(data.actors[0]).sheet.close(); }, data);
      const count = await page.evaluate(async data => {
        const { promptPlayerIntrusion } = await import("/systems/cypher/module/sheets/intrusion-dialogs.mjs");
        void promptPlayerIntrusion(game.actors.get(data.actors[0]));
        return game.messages.size;
      }, data);
      await expect(input).toBeVisible();
      await input.press("Escape");
      await expect(input).toHaveCount(0);
      expect(await page.evaluate(data => ({ messages: game.messages.size, xp: game.actors.get(data.actors[0]).system.xp }), data))
        .toEqual({ messages: count, xp: 5 });
    }
  } finally {
    await page.evaluate(async original => {
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});
