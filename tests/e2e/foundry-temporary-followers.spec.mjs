/** Temporary bodies, Duplicate backlash and recompiled companions against real Foundry documents. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function source(page, pcId, key, language = "en", identity = null) {
  return page.evaluate(async ({ pcId, key, language, identity }) => {
    const pack = game.packs.get(`cypher.abilities-${language}`);
    const index = await pack.getIndex({ fields: ["system.key", "flags.cypherFoundry.crd"] });
    const entry = index.find(entry => entry.system.key === key && (!identity
      || (entry.flags.cypherFoundry.crd.sourceLogicalId ?? entry.flags.cypherFoundry.crd.logicalId) === identity));
    if (!entry) throw Error(`Source not found: ${key}/${identity}`);
    const data = (await pack.getDocument(entry._id)).toObject(); delete data._id;
    return (await game.actors.get(pcId).createEmbeddedDocuments("Item", [data]))[0].id;
  }, { pcId, key, language, identity });
}
async function submit(page, input) {
  await page.locator(input).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(input)).toHaveCount(0);
}

test("temporary followers: EN/FR light/dark corpse controls preserve synthetic Health and recoveries end help", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const ids = await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const pc = await Actor.create({ name: "E2E necromancer", type: "pc", system: { tier: 6, stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } });
        const body = await Actor.create({ name: `E2E corpse ${language} ${theme}`, type: "npc", system: { level: 1, health: { value: 6, max: 6 } } });
        const scene = await globalThis.Scene.create({ name: "E2E temporary corpse scene", active: false });
        const [token] = await scene.createEmbeddedDocuments("Token", [{ name: body.name, actorId: body.id, actorLink: false, delta: { system: { health: { value: 3 } } } }]);
        await scene.view(); canvas.tokens.get(token.id).setTarget(true, { releaseOthers: true });
        return { pc: pc.id, base: body.id, npcUuid: token.actor.uuid, name: body.name };
      }, { language, theme, original });
      const itemId = await source(page, ids.pc, "basic-necromancy", language, "ability.basic-necromancy-455f4fa10b45");
      await page.evaluate(async ids => { const sheet = game.actors.get(ids.pc).sheet; await sheet.render({ force: true }); sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 }); }, ids);
      await page.locator(`[data-action="promptTemporaryFollower"][data-item-id="${itemId}"]`).press("Enter");
      // The world template and its actual synthetic token are distinct choices.
      await page.getByRole("checkbox", { name: `${ids.name} (1)`, exact: true }).last().check();
      await page.locator('input[name="range"]').check(); await page.locator('input[name="eligible"]').check();
      await submit(page, 'input[name="range"]');
      await expect.poll(() => page.evaluate(id => Object.values(game.actors.get(id).flags.cypher.temporaryUses ?? {}).at(-1)?.state, ids.pc)).toBe("complete");
      expect(await page.evaluate(async ids => ({ pool: game.actors.get(ids.pc).system.stats.intellect.pool.value,
        actual: (await fromUuid(ids.npcUuid)).system.health.value, base: game.actors.get(ids.base).system.health.value }), ids)).toEqual({ pool: 18, actual: 3, base: 6 });
      await page.reload(); await waitForFoundryReady(page);
      const ended = await page.evaluate(async ids => {
        const pc = game.actors.get(ids.pc), service = await import("/systems/cypher/module/applications/follower-service.mjs");
        await pc.rollRecovery("hour", { completed: true });
        return { assets: (await service.followerTaskPlan(pc)).assets, canAct: await service.followerCanAct(await fromUuid(ids.npcUuid)),
          actual: (await fromUuid(ids.npcUuid)).system.health.value };
      }, ids);
      expect(ended).toEqual({ assets: 0, canAct: false, actual: 3 });
    }
  } finally { await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original); }
});

test("temporary followers: Duplicate copies and loot survive kill attribution, reload and a paid attack correction", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E duplicator", type: "pc", system: { tier: 6, effort: 3, xp: 5, stats: { might: { pool: { value: 20, max: 20 }, edge: 1 } } } });
    const copy = await Actor.create({ name: "E2E instance", type: "npc", system: { level: 2, armor: 3, health: { value: 6, max: 6 } } });
    const recipient = await Actor.create({ name: "E2E copied armor recipient", type: "pc" });
    await pc.createEmbeddedDocuments("Item", [{ name: "Original blade", type: "attack", system: { attackType: "medium", damage: 4 } },
      { name: "Original cypher", type: "cypher", system: { cypherType: "manifest", level: 1 } },
      { name: "Original armor", type: "armor", system: { category: "heavy", equipped: true, freelyUsable: true } }]);
    const scene = await globalThis.Scene.create({ name: "E2E Duplicate scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: copy.id, actorLink: true, name: copy.name }]); await scene.view();
    return { pc: pc.id, copy: copy.id, recipient: recipient.id, scene: scene.id, token: token.id };
  });
  const itemId = await source(page, ids.pc, "duplicate");
  const instance = await page.evaluate(async ({ ids, itemId }) => {
    const pc = game.actors.get(ids.pc), copy = game.actors.get(ids.copy);
    if (!await game.cypher.temporaryFollowers.summonTemporaryFollowers(pc, itemId, { confirmed: true, inRange: true, eligible: true, targets: [{ npcUuid: copy.uuid }] })) throw Error("Duplicate rejected");
    await copy.createEmbeddedDocuments("Item", [{ name: "Loot acquired later", type: "equipment" }]);
    const armor = copy.items.find(item => item.type === "armor"), data = armor.toObject(); delete data._id;
    await game.actors.get(ids.recipient).createEmbeddedDocuments("Item", [data]);
    await armor.delete();
    return { types: copy.items.map(item => item.type).sort(), recordId: Object.keys(pc.flags.cypher.temporaryFollowers)[0] };
  }, { ids, itemId });
  expect(instance.types).toEqual(["attack", "equipment"]);
  await setDiceUniform(page, 0.175); // 17 adds one damage: nine minus three Armor kills the six-Health copy.
  const messageId = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), copy = game.actors.get(ids.copy);
    await pc.rollTask({ stat: "might", isAttack: true, baseDamage: 8, difficulty: 3, targetActor: copy, followerChoices: [] });
    return game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === pc.uuid).id;
  }, ids);
  expect(await page.evaluate(ids => ({ hp: game.actors.get(ids.copy).system.health.value,
    wound: game.actors.get(ids.pc).system.wounds.moderate.current, visible: canvas.tokens.get(ids.token).isVisible,
    armor: game.actors.get(ids.recipient).system.armor.category }), ids))
    .toEqual({ hp: 0, wound: 1, visible: false, armor: "none" });
  await page.evaluate(async ids => game.actors.get(ids.pc).update({ "system.wounds.minor.current": 1 }), ids);
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.075); // 19 with a minor effect: eight minus three Armor leaves five damage.
  const restored = await page.evaluate(async ({ ids, messageId }) => {
    await game.scenes.get(ids.scene).view();
    const pc = game.actors.get(ids.pc), copy = game.actors.get(ids.copy);
    await pc.rerollMessage(game.messages.get(messageId), { chooseSpecialEffect: async () => "minor" });
    const read = await import("/systems/cypher/module/applications/temporary-follower-read.mjs");
    return { hp: copy.system.health.value, moderate: pc.system.wounds.moderate.current, minor: pc.system.wounds.minor.current,
      xp: pc.system.xp, copies: copy.items.filter(item => read.temporaryEquipmentUsable(item)).length, visible: canvas.tokens.get(ids.token).isVisible,
      armor: game.actors.get(ids.recipient).system.armor.category };
  }, { ids, messageId });
  expect(restored).toEqual({ hp: 1, moderate: 0, minor: 1, xp: 4, copies: 2, visible: true, armor: "heavy" });
  await page.evaluate(async ids => game.actors.get(ids.pc).rollRecovery("tenMinutes", { completed: true }), ids);
  await expect.poll(() => page.evaluate(ids => canvas.tokens.get(ids.token).isVisible, ids)).toBe(false);
  expect(await page.evaluate(ids => game.actors.get(ids.recipient).system.armor.category, ids)).toBe("none");
  const loot = await page.evaluate(async ids => {
    const copy = game.actors.get(ids.copy); await copy.sheet.render({ force: true });
    const read = await import("/systems/cypher/module/applications/temporary-follower-read.mjs");
    return copy.items.filter(item => read.temporaryEquipmentUsable(item)).map(item => item.name);
  }, ids);
  expect(loot).toEqual(["Loot acquired later"]);
});

test("temporary followers: failed recompilation, natural-20 paid reroll, reboot and ten-hour expiry", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => ({ pc: (await Actor.create({ name: "E2E compiler", type: "pc", system: { tier: 6, xp: 3,
    stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } })).id,
    machine: (await Actor.create({ name: "E2E controlled machine", type: "npc", system: { level: 3, health: { value: 9, max: 9 } } })).id }));
  const itemId = await source(page, ids.pc, "recompile-machine"); await setDiceUniform(page, 0.925);
  const failed = await page.evaluate(async ({ ids, itemId }) => {
    const pc = game.actors.get(ids.pc), machine = game.actors.get(ids.machine);
    const result = await game.cypher.temporaryFollowers.recompileTemporaryFollower(pc, itemId, { npcUuid: machine.uuid, confirmed: true, machine: true, inRange: true, rebootRounds: 3 });
    return { success: result.success, pool: pc.system.stats.intellect.pool.value, messageId: game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === pc.uuid).id };
  }, { ids, itemId });
  expect(failed.success).toBe(false); expect(failed.pool).toBe(13);
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
  const paid = await page.evaluate(async ({ ids, messageId }) => {
    const pc = game.actors.get(ids.pc), machine = game.actors.get(ids.machine);
    await pc.rerollMessage(game.messages.get(messageId));
    const record = Object.values(pc.flags.cypher.temporaryFollowers)[0];
    await pc.sheet.render({ force: true });
    return { xp: pc.system.xp, pool: pc.system.stats.intellect.pool.value, health: machine.system.health.value, state: record.state, recordId: record.id };
  }, { ids, messageId: failed.messageId });
  expect(paid).toMatchObject({ xp: 2, pool: 20, health: 9, state: "rebooting" });
  await page.locator(`[data-action="promptTemporaryReboot"][data-record-id="${paid.recordId}"]`).press("Enter");
  await submit(page, 'input[name="rounds"]');
  await expect.poll(() => page.evaluate(({ ids, id }) => game.actors.get(ids.pc).flags.cypher.temporaryFollowers[id].state, { ids, id: paid.recordId })).toBe("active");
  const expired = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), machine = game.actors.get(ids.machine), service = await import("/systems/cypher/module/applications/follower-service.mjs");
    await game.time.advance(100000);
    const before = (await service.followerTaskPlan(pc)).assets;
    await pc.rollRecovery("tenHours", { completed: true });
    return { before, after: (await service.followerTaskPlan(pc)).assets, independent: await service.followerCanAct(machine), health: machine.system.health.value };
  }, ids);
  expect(expired).toEqual({ before: 1, after: 0, independent: true, health: 9 });
});
