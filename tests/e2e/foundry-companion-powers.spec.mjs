/** Live conditional support, timed attention and redirected attacks against real documents. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function submit(page, field) {
  await page.locator(field).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(field)).toHaveCount(0);
}
async function abilities(page, pcId, keys, language = "en") {
  return page.evaluate(async ({ pcId, keys, language }) => {
    const pc = game.actors.get(pcId), pack = game.packs.get(`cypher.abilities-${language}`), index = await pack.getIndex({ fields: ["system.key"] }), result = {};
    for (const key of keys) {
      const entry = index.find(entry => entry.system?.key === key);
      if (!entry) throw Error(`Missing Ability ${key}`);
      const source = (await pack.getDocument(entry._id)).toObject(); delete source._id;
      result[key] = (await pc.createEmbeddedDocuments("Item", [source]))[0].id;
    }
    return result;
  }, { pcId, keys, language });
}

test("companion powers: EN/FR light/dark proximity, NPC defenses and unconscious Betterment survive reload and recovery rerolls", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      await setDiceUniform(page, 0.525);
      const ids = await page.evaluate(async ({ original, language, theme }) => {
        await game.i18n.setLanguage(language); const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const pc = await Actor.create({ name: "E2E companion owner", type: "pc", system: { tier: 5, xp: 3, stats: { might: { pool: { value: 0, max: 20 } } } } });
        const beast = await Actor.create({ name: "E2E living companion", type: "npc", system: { level: 2, health: { value: 4, max: 6 } } });
        return { pc: pc.id, beast: beast.id };
      }, { original, language, theme });
      const source = await abilities(page, ids.pc, ["beast-companion", "stronger-together", "beast-betterment"], language);
      const slot = await page.evaluate(async ({ ids, source }) => {
        const pc = game.actors.get(ids.pc), beast = game.actors.get(ids.beast);
        if (!await game.cypher.followers.applyFollowerAbility(pc, source["beast-companion"], { confirmed: true, followers: [{ npcUuid: beast.uuid, healthPerLevel: 3 }] })) throw Error("Grant rejected");
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return Object.keys(pc.flags.cypher.followers)[0];
      }, { ids, source });
      await page.locator('[data-action="promptCompanionContext"]').press("Enter");
      await page.locator('select[name="companion"]').selectOption(`follower:${slot}`);
      await page.locator('input[name="immediate"]').check(); await submit(page, 'select[name="companion"]');
      const attack = await page.evaluate(async ids => {
        const pc = game.actors.get(ids.pc), beast = game.actors.get(ids.beast);
        const result = await pc.rollTask({ difficulty: 3, isAttack: true, baseDamage: 2, assetSteps: 2, rollRoutine: false });
        const foe = await Actor.create({ name: "E2E companion opponent", type: "pc" });
        await foe.rollTask({ difficulty: 2, isAttack: true, baseDamage: 0, targetActor: beast });
        const defense = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === foe.uuid).flags.cypher.effectiveDifficulty;
        await beast.toggleStatusEffect("unconscious", { active: true });
        const plan = await game.cypher.companions.companionTaskPlan(pc, { isAttack: true });
        return { damage: result.damage, defense, passiveDamage: plan.damage, recovery: plan.recovery };
      }, ids);
      expect(attack).toEqual({ damage: 4, defense: 3, passiveDamage: 0, recovery: 3 });
      await setDiceUniform(page, 0.995);
      await page.locator('[data-action="rollRecovery"][data-interval="hour"]').press("Enter");
      await page.locator('input[name="completed"]').check(); await submit(page, 'input[name="completed"]');
      await submit(page, 'input[name="might"]');
      const messageId = await page.evaluate(id => game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === game.actors.get(id).uuid && message.flags.cypher?.rollType === "recovery").id, ids.pc);
      expect(await page.evaluate(id => game.actors.get(id).system.stats.might.pool.value, ids.pc)).toBe(9);
      await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
      const after = await page.evaluate(async ({ ids, messageId }) => {
        const pc = game.actors.get(ids.pc); await pc.rerollMessage(game.messages.get(messageId));
        return { pool: pc.system.stats.might.pool.value, bonus: game.messages.get(messageId).flags.cypher.rollData.bonus,
          companion: (await game.cypher.companions.companionTaskPlan(pc)).recovery };
      }, { ids, messageId });
      expect(after).toEqual({ pool: 14, bonus: 3, companion: 3 });
      await page.evaluate(async id => { if (game.actors.get(id).sheet.rendered) await game.actors.get(id).sheet.close(); }, ids.pc);
    }
  } finally { await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original); }
});

test("companion powers: mounted movement uses its single asset without ordinary follower help", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => ({ pc: (await Actor.create({ name: "E2E rider", type: "pc", system: { tier: 3 } })).id,
    mount: (await Actor.create({ name: "E2E mount", type: "npc", system: { level: 3 } })).id }));
  const source = await abilities(page, ids.pc, ["mount"]);
  const result = await page.evaluate(async ({ ids, source }) => {
    const pc = game.actors.get(ids.pc), mount = game.actors.get(ids.mount);
    await game.cypher.followers.applyFollowerAbility(pc, source.mount, { confirmed: true, followers: [{ npcUuid: mount.uuid, healthPerLevel: 3 }] });
    const slot = Object.keys(pc.flags.cypher.followers)[0];
    await game.cypher.followers.configureFollower(pc, slot, { mode: "independent" });
    await game.cypher.companions.configureCompanion(pc, { followerId: slot, riding: true, confirmed: true });
    await pc.rollTask({ difficulty: 3, isAttack: true, baseDamage: 2 });
    const flags = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === pc.uuid).flags.cypher;
    return { difficulty: flags.effectiveDifficulty, mounted: flags.companionBenefits.mounted, ordinary: flags.followerHelp ?? [] };
  }, { ids, source });
  expect(result).toEqual({ difficulty: 2, mounted: true, ordinary: [] });
});

test("companion powers: timed synthetic automaton repair and an uncertain response never heal twice", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E automaton owner", type: "pc" });
    const base = await Actor.create({ name: "E2E repair automaton", type: "npc", system: { level: 2, health: { value: 4, max: 6 } } });
    const scene = await globalThis.Scene.create({ name: "E2E repair scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    await token.actor.update({ "system.health.value": 2 }); return { pc: pc.id, base: base.id, npcUuid: token.actor.uuid };
  });
  const source = await abilities(page, ids.pc, ["automaton-assistant"]);
  await page.evaluate(async ({ ids, source }) => {
    const pc = game.actors.get(ids.pc);
    await game.cypher.followers.applyFollowerAbility(pc, source["automaton-assistant"], { confirmed: true, followers: [{ npcUuid: ids.npcUuid, healthPerLevel: 3 }] });
    await pc.sheet.render({ force: true });
  }, { ids, source });
  await page.locator('[data-action="promptCompanionRepair"]').press("Enter"); await submit(page, 'input[name="minutes"]');
  await page.evaluate(async () => { await game.time.advance(180); });
  await page.locator('[data-action="finishCompanionRepair"]').press("Enter"); await page.locator('dialog[open] button[data-action="yes"]').press("Enter");
  await expect.poll(() => page.evaluate(async ids => (await fromUuid(ids.npcUuid)).system.health.value, ids)).toBe(4);
  const pending = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), npc = await fromUuid(ids.npcUuid), api = game.cypher.companions;
    const slot = Object.keys(pc.flags.cypher.followers)[0];
    await api.startAutomatonRepair(pc, slot, { durationSeconds: 180, confirmed: true }); await game.time.advance(180);
    const id = Object.values(pc.flags.cypher.companionRepairs).find(record => record.state === "working").id, update = npc.update;
    npc.update = async function(changes, options) { await update.call(this, changes, options); throw Error("E2E uncertain attention"); };
    try { await api.finishAutomatonRepair(pc, id, { workConfirmed: true }); }
    catch (error) { if (!error.message.includes("E2E uncertain attention")) throw error; }
    finally { npc.update = update; }
    await npc.update({ "system.health.value": 5 }); return id;
  }, ids);
  await page.reload(); await waitForFoundryReady(page);
  await page.evaluate(async id => { await game.actors.get(id).sheet.render({ force: true }); }, ids.pc);
  await page.locator(`[data-action="finishCompanionRepair"][data-repair-id="${pending}"]`).press("Enter");
  await page.locator('dialog[open] button[data-action="yes"]').press("Enter");
  await expect.poll(() => page.evaluate(({ ids, pending }) => game.actors.get(ids.pc).flags.cypher.companionRepairs[pending].state, { ids, pending })).toBe("complete");
  expect(await page.evaluate(async ids => ({ synthetic: (await fromUuid(ids.npcUuid)).system.health.value, base: game.actors.get(ids.base).system.health.value }), ids)).toEqual({ synthetic: 5, base: 4 });
});

test("companion powers: NPC sheet Retainer interception spends once, avoids PC wounds and resumes without replaying NPC action cleanup", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E retainer owner", type: "pc", system: { stats: { intellect: { pool: { value: 10, max: 10 }, edge: 1 } } } });
    const npc = await Actor.create({ name: "E2E retainer", type: "npc", system: { level: 2, armor: 1, health: { value: 4, max: 6 } } });
    const attacker = await Actor.create({ name: "E2E retainer attacker", type: "npc", system: { attacks: [{ name: "Retainer impact", damage: { mode: "wound", severity: "major", wounds: 1, stat: "might" } }] } });
    const scene = await globalThis.Scene.create({ name: "E2E interception scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: pc.id, actorLink: true, x: 100, y: 100 }]);
    await scene.view(); canvas.tokens.get(token.id).setTarget(true, { releaseOthers: true });
    return { pc: pc.id, npc: npc.id, attacker: attacker.id };
  });
  const source = await abilities(page, ids.pc, ["retainer"]);
  const slot = await page.evaluate(async ({ ids, source }) => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
    await game.cypher.followers.applyFollowerAbility(pc, source.retainer, { confirmed: true, followers: [{ npcUuid: npc.uuid, healthPerLevel: 3 }] });
    await game.actors.get(ids.attacker).sheet.render({ force: true }); return Object.keys(pc.flags.cypher.followers)[0];
  }, { ids, source });
  await page.locator('[data-action="rollNpcAttack"][data-attack-index="0"]').press("Enter");
  await page.locator('select[name="retainerId"]').selectOption(slot); await page.locator('input[name="retainerAmount"]').fill("5");
  await page.locator('input[name="retainerConfirmed"]').check(); await submit(page, 'select[name="retainerId"]');
  await expect.poll(() => page.evaluate(id => game.actors.get(id).system.health.value, ids.npc)).toBe(0);
  await expect.poll(() => page.evaluate(id => Object.values(game.actors.get(id).flags.cypher.retainerInterceptions)[0].state, ids.pc)).toBe("complete");
  const state = await page.evaluate(ids => ({ pool: game.actors.get(ids.pc).system.stats.intellect.pool.value,
    wounds: Object.values(game.actors.get(ids.pc).system.wounds).map(wound => wound.current),
    unconscious: game.actors.get(ids.npc).flags.cypher.generalEffects.some(effect => effect.kind === "unconscious"),
    revision: game.actors.get(ids.attacker).flags.cypher.weaponActionRevision }), ids);
  expect(state).toEqual({ pool: 9, wounds: [0, 0, 0], unconscious: true, revision: 1 });
  const pending = await page.evaluate(async ({ ids, slot }) => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc), attacker = game.actors.get(ids.attacker);
    await npc.update({ "system.health.value": 6 }); await game.cypher.followers.restoreFollowerAvailability(pc, npc.uuid);
    const update = attacker.update;
    attacker.update = async function(changes, options) { await update.call(this, changes, options); throw Error("E2E uncertain NPC cleanup"); };
    try { await attacker.rollNpcAttack(attacker.system.attacks[0], { target: pc, retainerId: slot, retainerDamage: { amount: 2, confirmed: true } }); }
    catch (error) { if (!error.message.includes("E2E uncertain NPC cleanup")) throw error; }
    finally { attacker.update = update; }
    return Object.values(pc.flags.cypher.retainerInterceptions).find(record => record.state === "pending").id;
  }, { ids, slot });
  await page.reload(); await waitForFoundryReady(page);
  await page.evaluate(async id => { await game.actors.get(id).sheet.render({ force: true }); }, ids.pc);
  await page.locator(`[data-action="resumeRetainerInterception"][data-interception-id="${pending}"]`).press("Enter");
  await expect.poll(() => page.evaluate(({ ids, pending }) => game.actors.get(ids.pc).flags.cypher.retainerInterceptions[pending].state, { ids, pending })).toBe("complete");
  expect(await page.evaluate(ids => ({ pool: game.actors.get(ids.pc).system.stats.intellect.pool.value, health: game.actors.get(ids.npc).system.health.value,
    revision: game.actors.get(ids.attacker).flags.cypher.weaponActionRevision }), ids)).toEqual({ pool: 8, health: 5, revision: 2 });
});
