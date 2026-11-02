/** Live protective Ability costs, recipient recoveries, synthetic Health and original-roll snapshots. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function source(page, actorId, key, language = "en") {
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

test("protection powers: EN/FR light/dark personal protections, Intellect Block and recovery expiration", async ({ e2ePage: page }) => {
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
        return (await Actor.create({ name: `E2E protected mage ${language} ${theme}`, type: "pc", system: { tier: 3,
          stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } })).id;
      }, { language, theme, original });
      const mage = await source(page, id, "mage-armor", language), debris = await source(page, id, "armoring-debris", language);
      await page.evaluate(async id => { const sheet = game.actors.get(id).sheet; await sheet.render({ force: true }); sheet.setPosition({ width: 640, height: 700 }); }, id);
      await page.locator(`[data-action="promptProtection"][data-item-id="${mage}"]`).click(); await submit(page);
      await page.locator(`[data-action="promptProtection"][data-item-id="${debris}"]`).click();
      await page.locator('input[name="debris"]').check(); await submit(page);
      await setDiceUniform(page, 0.525); // 10 succeeds against effective difficulty 2.
      await page.locator('[data-action="rollDefense"][data-defense-type="block"]').click();
      await page.locator('input[name="mageArmor"]').check(); await page.locator('input[name="difficulty"]').fill("5");
      await page.locator('select[name="incomingSeverity"]').selectOption("major"); await submit(page, 'input[name="mageArmor"]');
      const before = await page.evaluate(id => {
        const actor = game.actors.get(id), flags = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === actor.uuid).flags.cypher;
        return { stat: flags.stat, difficulty: flags.effectiveDifficulty, wound: actor.system.wounds.moderate.current, pool: actor.system.stats.intellect.pool.value };
      }, id);
      expect(before).toEqual({ stat: "intellect", difficulty: 2, wound: 1, pool: 16 });
      await page.reload(); await waitForFoundryReady(page);
      const after = await page.evaluate(async id => {
        const actor = game.actors.get(id), read = await import("/systems/cypher/module/applications/protection-power-read.mjs");
        const restored = read.liveProtections(actor).length;
        await actor.rollRecovery("tenMinutes", { completed: true }); const short = read.protectionBlockPlan(actor, true).ease;
        await actor.rollRecovery("tenHours", { completed: true });
        return { restored, short, active: read.liveProtections(actor).length };
      }, id);
      expect(after).toEqual({ restored: 2, short: 2, active: 0 });
    }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original);
  }
});

test("protection powers: dedicated Effort, actual NPC Health, separate recipient recovery and retained attack mitigation", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const caster = await Actor.create({ name: "E2E elemental caster", type: "pc", system: { effort: 2, xp: 5,
      stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } });
    const ally = await Actor.create({ name: "E2E protected ally", type: "pc" });
    const base = await Actor.create({ name: "E2E protection base", type: "npc", system: { level: 4, armor: 2, health: { value: 20, max: 20 } } });
    const scene = await globalThis.Scene.create({ name: "E2E elemental scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    await token.actor.update({ name: "E2E protected synthetic" }); await scene.view(); canvas.tokens.get(token.id).setTarget(true, { releaseOthers: true });
    return { caster: caster.id, ally: ally.id, base: base.id, npcUuid: token.actor.uuid };
  });
  const item = await source(page, ids.caster, "elemental-protection");
  await page.evaluate(async ids => game.actors.get(ids.caster).sheet.render({ force: true }), ids);
  await page.locator(`[data-action="promptProtection"][data-item-id="${item}"]`).click();
  await page.locator('input[name="incomingEnergy"]').fill("fire"); await page.locator('input[name="effectEffort"]').fill("2");
  await page.getByLabel("E2E protected ally", { exact: true }).check(); await page.getByLabel("E2E protected synthetic", { exact: true }).check();
  await page.locator('input[name="inRange"]').check(); await submit(page);
  await setDiceUniform(page, 0.525);
  const original = await page.evaluate(async ids => {
    const caster = game.actors.get(ids.caster), npc = await fromUuid(ids.npcUuid);
    await caster.rollTask({ stat: "might", difficulty: 3, isAttack: true, baseDamage: 14, targetActor: npc, incomingEnergy: "fire", followerChoices: [] });
    const message = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === caster.uuid);
    const read = await import("/systems/cypher/module/applications/protection-power-read.mjs");
    const before = { pool: caster.system.stats.intellect.pool.value, hp: npc.system.health.value, mitigation: message.flags.cypher.attackConsequences.protection };
    await caster.rollRecovery("hour", { completed: true });
    return { message: message.id, before, self: read.protectionWoundReduction(caster, "fire"), ally: read.protectionWoundReduction(game.actors.get(ids.ally), "fire"), npc: read.protectionNpcReduction(npc, "fire") };
  }, ids);
  expect(original.before).toEqual({ pool: 12, hp: 17, mitigation: 9 });
  expect([original.self, original.ally, original.npc]).toEqual([0, 3, 9]);
  await page.locator(`[data-action="npcProtectionRest"][data-recipient-uuid="${ids.npcUuid}"]`).click();
  await page.locator('dialog[open] button[data-action="yes"]').press("Enter");
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.075);
  const result = await page.evaluate(async ({ ids, original }) => {
    const caster = game.actors.get(ids.caster), npc = await fromUuid(ids.npcUuid), ally = game.actors.get(ids.ally);
    const read = await import("/systems/cypher/module/applications/protection-power-read.mjs");
    await caster.rerollMessage(game.messages.get(original.message), { chooseSpecialEffect: async () => "minor" });
    await ally.rollRecovery("hour", { completed: true });
    return { hp: npc.system.health.value, base: game.actors.get(ids.base).system.health.value, mitigation: read.protectionNpcReduction(npc, "fire"),
      ally: read.protectionWoundReduction(ally, "fire"), xp: caster.system.xp };
  }, { ids, original });
  expect(result).toEqual({ hp: 17, base: 20, mitigation: 0, ally: 0, xp: 4 });
});

test("protection powers: partial recipient write resumes after source removal and defense rerolls retain expired protection", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const caster = await Actor.create({ name: "E2E partial protection caster", type: "pc", system: { effort: 2, xp: 5,
      stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } });
    const npc = await Actor.create({ name: "E2E partial protection NPC", type: "npc", system: { level: 3, health: { value: 12, max: 12 } } });
    return { caster: caster.id, npc: npc.id };
  });
  const item = await source(page, ids.caster, "elemental-protection");
  const useId = await page.evaluate(async ({ ids, item }) => {
    const caster = game.actors.get(ids.caster), npc = game.actors.get(ids.npc), update = npc.update.bind(npc);
    npc.update = async (...args) => { await update(...args); throw Error("lost NPC protection acknowledgement"); };
    try { await game.cypher.protections.activateProtection(caster, item, { confirmed: true, inRange: true, energy: "cold", effort: 1, targetUuids: [npc.uuid] }); }
    catch (error) { if (!error.message.includes("lost NPC protection")) throw error; }
    npc.update = update;
    await npc.update({ "system.health.value": 7 });
    await game.cypher.protections.recordNpcProtectionRecovery(npc, { confirmed: true });
    await caster.items.get(item).delete();
    return Object.keys(caster.flags.cypher.protectionUses)[0];
  }, { ids, item });
  await page.reload(); await waitForFoundryReady(page);
  await page.evaluate(async ids => game.actors.get(ids.caster).sheet.render({ force: true }), ids);
  await page.locator(`[data-action="resumeProtectionAction"][data-protection-id="${useId}"]`).click();
  await expect(page.locator('[data-action="resumeProtectionAction"]')).toHaveCount(0);
  await setDiceUniform(page, 0.925);
  const message = await page.evaluate(async ({ ids, useId }) => {
    const caster = game.actors.get(ids.caster);
    await caster.rollDefense("block", { difficulty: 3, incomingSeverity: "major", incomingEnergy: "cold" });
    const message = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === caster.uuid).id;
    await game.cypher.protections.endProtection(caster, useId); await caster.update({ "system.wounds.major.current": 1 });
    return message;
  }, { ids, useId });
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
  const result = await page.evaluate(async ({ ids, message }) => {
    const caster = game.actors.get(ids.caster), npc = game.actors.get(ids.npc);
    await caster.rerollMessage(game.messages.get(message));
    const read = await import("/systems/cypher/module/applications/protection-power-read.mjs");
    return { pool: caster.system.stats.intellect.pool.value, xp: caster.system.xp, minor: caster.system.wounds.minor.current,
      major: caster.system.wounds.major.current, npcHealth: npc.system.health.value, npcProtection: read.protectionNpcReduction(npc, "cold") };
  }, { ids, message });
  expect(result).toEqual({ pool: 14, xp: 4, minor: 0, major: 1, npcHealth: 7, npcProtection: 0 });
});
