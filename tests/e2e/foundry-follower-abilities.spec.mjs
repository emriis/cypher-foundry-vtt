/** Actual compendium identities, permanent family choices and durable follower receipts. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function submit(page, field) {
  await page.locator(field).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(field)).toHaveCount(0);
}
async function importAbility(page, actorId, key, language) {
  return page.evaluate(async ({ actorId, key, language }) => {
    const pack = game.packs.get(`cypher.abilities-${language}`), index = await pack.getIndex({ fields: ["system.key"] });
    const entry = index.find(entry => entry.system?.key === key);
    if (!entry) throw Error(`Missing Ability ${key}`);
    const source = await pack.getDocument(entry._id), data = source.toObject(); delete data._id;
    return (await game.actors.get(actorId).createEmbeddedDocuments("Item", [data]))[0].id;
  }, { actorId, key, language });
}

test("follower abilities: EN/FR and both themes apply real grants and initial-level modifications, retain damage and persist", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const ids = await page.evaluate(async ({ original, language, theme }) => {
        await game.i18n.setLanguage(language); const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const pc = await Actor.create({ name: "E2E permanent follower owner", type: "pc", system: { tier: 2 } });
        const npc = await Actor.create({ name: "E2E permanent follower", type: "npc", system: { level: 2, health: { value: 5, max: 6 } } });
        return { pc: pc.id, npc: npc.id, uuid: npc.uuid };
      }, { original, language, theme });
      const ability = await importAbility(page, ids.pc, "basic-follower", language);
      await page.evaluate(async id => { const sheet = game.actors.get(id).sheet; await sheet.render({ force: true }); sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 }); }, ids.pc);
      await page.locator('[data-action="promptFollowerAbility"]').press("Enter");
      await page.locator('dialog[open] button[data-action="close"]').click();
      await expect(page.locator('select[name="ability"]')).toHaveCount(0);
      expect(await page.evaluate(id => Object.keys(game.actors.get(id).flags.cypher?.followers ?? {}).length, ids.pc)).toBe(0);
      await page.locator('[data-action="promptFollowerAbility"]').click();
      await page.locator('select[name="ability"]').selectOption(ability); await submit(page, 'select[name="ability"]');
      await page.locator('select[name="npc0"]').selectOption(ids.uuid);
      await page.locator('input[name="task0x1"]').fill("Perception"); await submit(page, 'input[name="task0x1"]');
      await expect.poll(() => page.evaluate(id => Object.values(game.actors.get(id).flags.cypher?.followerAbilityUses ?? {})[0]?.state, ids.pc)).toBe("complete");
      await page.evaluate(async id => { await game.actors.get(id).update({ "system.tier": 5 }); }, ids.pc);
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.level, ids.npc)).toBe(3);
      const improved = await importAbility(page, ids.pc, "improved-follower", language);
      await page.locator('[data-action="promptFollowerAbility"]').press("Enter");
      await page.locator('select[name="ability"]').selectOption(improved); await submit(page, 'select[name="ability"]');
      await page.locator('input[name="newTask0"]').fill("Stealth"); await submit(page, 'input[name="newTask0"]');
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.level, ids.npc)).toBe(4);
      expect(await page.evaluate(async id => (await game.cypher.followers.followerDisplay(game.actors.get(id)))[0].tasks.map(task => task.level), ids.pc)).toEqual([5, 5, 3]);
      await page.reload(); await waitForFoundryReady(page);
      const result = await page.evaluate(async ids => {
        const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
        await pc.update({ "system.tier": 6 }); await game.cypher.followers.synchronizeFollowers(pc);
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        const display = await game.cypher.followers.followerDisplay(pc);
        return { level: npc.system.level, max: npc.system.health.max, health: npc.system.health.value, tasks: display[0].tasks.map(task => task.level),
          slots: display.length, complete: game.cypher.followers.followerAbilityUses(pc).every(use => use.state === "complete") };
      }, ids);
      expect(result).toEqual({ level: 5, max: 15, health: 14, tasks: [6, 6, 4], slots: 1, complete: true });
      const row = page.locator('article[data-follower-id]').filter({ hasText: "E2E permanent follower" });
      await expect(row).toContainText("Stealth: 4");
      expect(await row.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.evaluate(async id => { await game.actors.get(id).sheet.close(); }, ids.pc);
    }
  } finally { await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original); }
});

test("follower abilities: a partial four-NPC grant resumes from the sheet after reload and source removal", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E pending fleet owner", type: "pc", system: { tier: 7 } });
    const fleet = [];
    for (let index = 0; index < 4; index++) fleet.push(await Actor.create({ name: `E2E pending automaton ${index}`, type: "npc", system: { level: 2, health: { max: 6, value: 4 } } }));
    return { pc: pc.id, fleet: fleet.map(npc => npc.id) };
  });
  const itemId = await importAbility(page, ids.pc, "automaton-fleet", "en");
  const pending = await page.evaluate(async ({ ids, itemId }) => {
    const pc = game.actors.get(ids.pc), fleet = ids.fleet.map(id => game.actors.get(id)), update = fleet[1].update;
    fleet[1].update = async function(changes, options) { await update.call(this, changes, options); throw Error("E2E uncertain fleet response"); };
    try {
      await game.cypher.followers.applyFollowerAbility(pc, itemId, { confirmed: true, acquiredTier: 5,
        followers: fleet.map(npc => ({ npcUuid: npc.uuid, healthPerLevel: 3 })) });
      throw Error("Expected interrupted grant");
    } catch (error) { if (!error.message.includes("E2E uncertain fleet response")) throw error; }
    finally { fleet[1].update = update; }
    const use = game.cypher.followers.followerAbilityUses(pc)[0];
    await pc.deleteEmbeddedDocuments("Item", [itemId]);
    return { id: use.id, state: use.state, slots: use.slots.length };
  }, { ids, itemId });
  expect(pending.state).toBe("pending"); expect(pending.slots).toBe(4);
  await page.reload(); await waitForFoundryReady(page);
  await page.evaluate(async id => { await game.actors.get(id).sheet.render({ force: true }); }, ids.pc);
  await page.locator(`[data-action="resumeFollowerAbility"][data-use-id="${pending.id}"]`).press("Enter");
  await expect.poll(() => page.evaluate(id => game.cypher.followers.followerAbilityUses(game.actors.get(id))[0].state, ids.pc)).toBe("complete");
  expect(await page.evaluate(ids => ({ slots: Object.keys(game.actors.get(ids.pc).flags.cypher.followers).length,
    profiles: ids.fleet.map(id => { const npc = game.actors.get(id); return [npc.system.level, npc.system.health.max, npc.system.health.value]; }) }), ids))
    .toEqual({ slots: 4, profiles: [[3, 9, 7], [3, 9, 7], [3, 9, 7], [3, 9, 7]] });
});
