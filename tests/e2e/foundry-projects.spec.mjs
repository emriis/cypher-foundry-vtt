/** Real downtime controls and persistent, receipted resource-point settlement. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function submit(page, field) {
  await page.locator(field).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
}
async function confirm(page) { await page.locator('dialog[open] button[data-action="yes"]').press("Enter"); }

test("projects: EN/FR and both themes approve, wait and complete a repair without spending early", async ({ e2ePage: page }) => {
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
        const pc = await Actor.create({ name: "E2E project crafter", type: "pc", system: { resourcePoints: 5 } });
        const [skill] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E applicable crafting", type: "skill", system: { level: "trained" } }]);
        const target = await Actor.create({ name: "E2E repair window", type: "object", system: { originalLevel: 3, levelDamage: 3 } });
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return { pc: pc.id, skill: skill.id, target: target.id, targetUuid: target.uuid };
      }, { original, language, theme });
      await page.locator('[data-action="promptProject"]').press("Enter");
      await page.locator('select[name="kind"]').selectOption("repairObject"); await submit(page, 'select[name="kind"]');
      await page.locator('input[name="label"]').fill("E2E repair");
      await page.locator('input[name="hours"]').fill("1");
      await page.locator('select[name="targetUuid"]').selectOption(ids.targetUuid);
      await page.locator('select[name="skillItemId"]').selectOption(ids.skill);
      await page.locator('input[name="genreConfirmed"]').check(); await page.locator('input[name="skillAppropriate"]').check();
      await submit(page, 'input[name="hours"]');
      await expect(page.locator('input[name="hours"]')).toHaveCount(0);
      const project = await page.evaluate(ids => Object.keys(game.actors.get(ids.pc).flags.cypher.projects)[0], ids);
      const row = () => page.locator(`article[data-project-id="${project}"]`);
      expect(await page.evaluate(ids => game.actors.get(ids.pc).system.resourcePoints, ids)).toBe(5);
      await row().locator('[data-action="approveProject"]').press("Enter"); await confirm(page);
      await expect(row().locator('[data-action="approveProject"]')).toHaveCount(0);
      await expect(row().locator('[data-action="completeProject"]')).toHaveCount(0);
      await page.evaluate(async () => { await game.time.advance(3600); });
      await expect(row().locator('[data-action="completeProject"]')).toBeVisible();
      expect(await page.evaluate(ids => game.actors.get(ids.pc).system.resourcePoints, ids)).toBe(5);
      await page.reload(); await waitForFoundryReady(page);
      await page.evaluate(async ({ ids, language }) => { await game.i18n.setLanguage(language); const sheet = game.actors.get(ids.pc).sheet; await sheet.render({ force: true }); sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 }); }, { ids, language });
      await row().locator('[data-action="completeProject"]').press("Enter"); await confirm(page);
      await expect.poll(() => page.evaluate(ids => game.actors.get(ids.pc).system.resourcePoints, ids)).toBe(4);
      expect(await page.evaluate(ids => game.actors.get(ids.target).system.status, ids)).toBe("functional");
      await expect(row()).toContainText(language === "fr" ? "Achevé" : "Completed");
      expect(await row().evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.evaluate(async ids => { await game.actors.get(ids.pc).sheet.close(); }, ids);
    }
  } finally {
    await page.evaluate(async original => {
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});

test("projects: interrupted collaboration resumes after reload and charges each resource owner once", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E project principal", type: "pc", system: { resourcePoints: 5 } });
    const helper = await Actor.create({ name: "E2E project helper", type: "pc", system: { resourcePoints: 5 } });
    const service = game.cypher.projects;
    const id = await service.createProject(pc, { kind: "research", label: "E2E shared research", level: 7, durationSeconds: 1,
      contributions: [{ actorUuid: helper.uuid, amount: 2 }] });
    if (!await service.approveProject(pc, id, { confirmed: true })) throw Error("Project approval failed");
    await game.time.advance(1);
    const update = helper.update; helper.update = async () => { throw Error("E2E contribution interruption"); };
    try { await service.completeProject(pc, id, { workConfirmed: true }); }
    catch (error) { if (!error.message.includes("E2E contribution interruption")) throw error; }
    finally { helper.update = update; }
    return { pc: pc.id, helper: helper.id, id };
  });
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), helper = game.actors.get(ids.helper);
    await game.cypher.projects.resumeProject(pc, ids.id);
    await game.cypher.projects.resumeProject(pc, ids.id);
    return { principal: pc.system.resourcePoints, helper: helper.system.resourcePoints,
      state: pc.flags.cypher.projects[ids.id].state, receipts: [pc, helper].map(actor => actor.flags.cypher.resourcePointReceipts.length) };
  }, ids);
  expect(result).toEqual({ principal: 4, helper: 3, state: "completed", receipts: [1, 1] });
});

test("projects: actual cypher templates create one result; uncertain creation is reconciled without replay", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E cypher project", type: "pc", system: { resourcePoints: 10 } });
    const [skill] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E crafting", type: "skill", system: { level: "expert" } }]);
    const pack = game.packs.get("cypher.equipment-en");
    const index = await pack.getIndex({ fields: ["system.powerLevel", "system.powerLevels", "system.cypherType"] });
    const entry = index.find(entry => entry.system?.cypherType === "manifest"
      && (entry.system.powerLevel === "low" || entry.system.powerLevels?.includes("low")));
    if (!entry) throw Error("No low-power manifest source");
    const source = await pack.getDocument(entry._id), service = game.cypher.projects;
    const proposal = { label: "E2E crafted cypher", kind: "craftCypher", power: "low", sourceUuid: source.uuid,
      variantName: source.system.variants?.find(variant => variant.powerLevel === "low")?.name,
      skillItemId: skill.id, genreConfirmed: true, skillAppropriate: true, durationSeconds: 0 };
    const first = await service.createProject(pc, proposal);
    await service.approveProject(pc, first, { confirmed: true }); await service.completeProject(pc, first, { workConfirmed: true });
    const second = await service.createProject(pc, { ...proposal, label: "E2E uncertain cypher" });
    await service.approveProject(pc, second, { confirmed: true });
    const create = pc.createEmbeddedDocuments;
    pc.createEmbeddedDocuments = async () => { throw Error("E2E result interruption"); };
    try { await service.completeProject(pc, second, { workConfirmed: true }); }
    catch (error) { if (!error.message.includes("E2E result interruption")) throw error; }
    finally { pc.createEmbeddedDocuments = create; }
    return { pc: pc.id, first, second, description: source.system.description };
  });
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), service = game.cypher.projects;
    await service.resumeProject(pc, ids.second);
    const cyphers = pc.items.filter(item => item.type === "cypher");
    return { points: pc.system.resourcePoints, count: cyphers.length, description: cyphers[0].system.description,
      first: pc.flags.cypher.projects[ids.first].state, second: pc.flags.cypher.projects[ids.second].state };
  }, ids);
  expect(result).toEqual({ points: 6, count: 1, description: ids.description, first: "completed", second: "manual" });
});

test("projects: new material targets and synthetic follower restoration preserve explicit identities", async ({ e2ePage: page }) => {
  const result = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E object and follower projects", type: "pc", system: { resourcePoints: 10 } });
    const [skill] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E crafting", type: "skill", system: { level: "trained" } }]);
    const service = game.cypher.projects;
    const object = await service.createProject(pc, { label: "E2E crafted table", kind: "craftObject", level: 2,
      material: "wood", skillItemId: skill.id, genreConfirmed: true, skillAppropriate: true, durationSeconds: 0 });
    await service.approveProject(pc, object, { confirmed: true }); await service.completeProject(pc, object, { workConfirmed: true });
    const created = await fromUuid(pc.flags.cypher.projects[object].settlement.resultUuid);
    const base = await Actor.create({ name: "E2E follower base", type: "npc", system: { level: 3, health: { value: 0, max: 9 } } });
    const scene = await globalThis.Scene.create({ name: "E2E follower scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    const follower = await service.createProject(pc, { label: "E2E restore follower", kind: "restoreFollower", targetUuid: token.actor.uuid,
      followerConfirmed: true, durationSeconds: 604800 });
    await service.approveProject(pc, follower, { confirmed: true }); await game.time.advance(604800);
    await service.completeProject(pc, follower, { workConfirmed: true });
    return { points: pc.system.resourcePoints, object: { type: created.type, level: created.system.level, material: created.system.material },
      follower: token.actor.system.health.value, base: base.system.health.value };
  });
  expect(result).toEqual({ points: 7, object: { type: "object", level: 2, material: "wood" }, follower: 9, base: 0 });
});
