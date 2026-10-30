/** Actual armor, timed capacity, turret outcomes and player-only remote sight in disposable Foundry. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { joinAsGamemaster, waitForFoundryReady } from "./foundry-session.mjs";
async function sources(page, pcId, keys, language = "en") {
  return page.evaluate(async ({ pcId, keys, language }) => {
    const pc = game.actors.get(pcId), pack = game.packs.get(`cypher.abilities-${language}`);
    const index = await pack.getIndex({ fields: ["system.key"] }), result = {};
    for (const key of keys) {
      const entry = index.find(entry => entry.system.key === key);
      if (!entry) throw Error(`Missing source ${key}`);
      const source = (await pack.getDocument(entry._id)).toObject(); delete source._id;
      [result[key]] = (await pc.createEmbeddedDocuments("Item", [source])).map(item => item.id);
    }
    return result;
  }, { pcId, keys, language });
}
async function submit(page, field) {
  await page.locator(field).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(field)).toHaveCount(0);
}

test("companion upgrades: keyboard installation, armor damage, capacity expiry and reload in EN/FR", async ({ e2ePage: page }) => {
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
        const pc = await Actor.create({ name: "E2E upgrade owner", type: "pc", system: { tier: 6, stats: { intellect: { pool: { value: 30, max: 30 }, edge: 1 } } } });
        const npc = await Actor.create({ name: "E2E upgrade automaton", type: "npc", system: { level: 2, health: { value: 6, max: 6 } } });
        return { pc: pc.id, npc: npc.id };
      }, { original, language, theme });
      const abilities = await sources(page, ids.pc, ["automaton-assistant", "automaton-armor-upgrade", "automaton-heavy-armor-upgrade", "automaton-cypher-upgrade"], language);
      await page.evaluate(async ({ ids, abilities }) => {
        const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
        if (!await game.cypher.followers.applyFollowerAbility(pc, abilities["automaton-assistant"], { confirmed: true, followers: [{ npcUuid: npc.uuid, healthPerLevel: 3 }] })) throw Error("Grant rejected");
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
      }, { ids, abilities });
      await page.locator('[data-action="promptCompanionInstall"]').press("Enter");
      await page.locator('select[name="ability"]').selectOption(abilities["automaton-armor-upgrade"]);
      await submit(page, 'select[name="ability"]');
      await expect(page.locator('[data-action="promptCompanionUpgrade"][data-binding-id]')).toHaveCount(1);
      await page.locator('[data-action="promptCompanionUpgrade"][data-binding-id]').press("Enter");
      await page.locator('input[name="immediate"]').check(); await submit(page, 'input[name="immediate"]');
      await expect.poll(() => page.evaluate(id => game.actors.get(id).system.armor.category, ids.pc)).toBe("light");
      const state = await page.evaluate(async ({ ids, abilities }) => {
        const pc = game.actors.get(ids.pc), api = game.cypher.companions, slot = Object.keys(pc.flags.cypher.followers)[0];
        const armor = pc.items.find(item => item.type === "armor"); await armor.update({ "system.blockEaseDamage": 1 });
        await api.installCompanionUpgrade(pc, abilities["automaton-heavy-armor-upgrade"], slot, { confirmed: true });
        await api.installCompanionUpgrade(pc, abilities["automaton-cypher-upgrade"], slot, { confirmed: true });
        const bindings = Object.values(pc.flags.cypher.companionUpgrades);
        await api.activateCompanionUpgrade(pc, bindings.find(entry => entry.key === "automaton-heavy-armor-upgrade").id, { confirmed: true, immediate: true });
        await api.activateCompanionUpgrade(pc, bindings.find(entry => entry.key === "automaton-cypher-upgrade").id, { confirmed: true });
        return { armor: pc.system.armor.category, damaged: armor.system.blockEaseDamage, count: pc.items.filter(item => item.type === "armor").length,
          pool: pc.system.stats.intellect.pool.value, limit: game.cypher.cyphers.cypherInventoryDisplay(pc).limit };
      }, { ids, abilities });
      expect(state).toEqual({ armor: "heavy", damaged: 1, count: 1, pool: 21, limit: 3 });
      await page.reload(); await waitForFoundryReady(page);
      await page.evaluate(async ids => game.actors.get(ids.pc).sheet.render({ force: true }), ids);
      await expect(page.locator("[data-cypher-capacity]")).toContainText("(0/3)");
      await page.evaluate(async () => game.time.advance(86400));
      await expect(page.locator("[data-cypher-capacity]")).toContainText("(0/2)");
      const expired = await page.evaluate(async ids => {
        const pc = game.actors.get(ids.pc);
        await pc.rollRecovery("hour", { completed: true });
        return { armor: pc.system.armor.category, savedLimit: pc.system.cypherLimit, limit: game.cypher.cyphers.cypherInventoryDisplay(pc).limit,
          damaged: pc.items.find(item => item.type === "armor").system.blockEaseDamage };
      }, ids);
      expect(expired).toEqual({ armor: "none", savedLimit: 2, limit: 2, damaged: 1 });
      await page.evaluate(async ids => game.actors.get(ids.pc).sheet.close(), ids);
    }
  } finally { await page.evaluate(async original => {
    await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
  }, original); }
});

test("companion upgrades: turret shots, field protection and shared PC defense persist actual consequences", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.925);
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E turret owner", type: "pc", system: { tier: 6 } });
    const npc = await Actor.create({ name: "E2E turret", type: "npc", system: { level: 2, health: { value: 6, max: 6 } } });
    const enemy = await Actor.create({ name: "E2E turret target", type: "npc", system: { armor: 1, health: { value: 20, max: 20 } } });
    const defender = await Actor.create({ name: "E2E turret defender", type: "pc" });
    return { pc: pc.id, npc: npc.id, enemy: enemy.id, defender: defender.id };
  });
  const abilities = await sources(page, ids.pc, ["automaton-assistant", "automaton-turret-upgrade", "automaton-force-field-upgrade", "automaton-flight-upgrade"]);
  const result = await page.evaluate(async ({ ids, abilities }) => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc), enemy = game.actors.get(ids.enemy), api = game.cypher.companions;
    await game.cypher.followers.applyFollowerAbility(pc, abilities["automaton-assistant"], { confirmed: true, followers: [{ npcUuid: npc.uuid, healthPerLevel: 3 }] });
    const slot = Object.keys(pc.flags.cypher.followers)[0];
    for (const key of ["automaton-turret-upgrade", "automaton-force-field-upgrade", "automaton-flight-upgrade"]) await api.installCompanionUpgrade(pc, abilities[key], slot, { confirmed: true });
    const bindings = Object.values(pc.flags.cypher.companionUpgrades);
    await api.activateCompanionUpgrade(pc, bindings.find(entry => entry.key === "automaton-force-field-upgrade").id, { confirmed: true, immediate: true, targetUuids: [enemy.uuid] });
    await api.activateCompanionUpgrade(pc, bindings.find(entry => entry.key === "automaton-turret-upgrade").id, { confirmed: true });
    await pc.update({ [`flags.cypher.followers.${slot}.mode`]: "independent" });
    const turret = api.liveCompanionEffects(pc).find(effect => effect.key === "automaton-turret-upgrade");
    const first = await api.fireAutomatonTurret(pc, turret.id, { target: enemy, confirmed: true, inRange: true, hitConfirmed: true, roundId: "a" });
    const repeated = await api.fireAutomatonTurret(pc, turret.id, { target: enemy, confirmed: true, inRange: true, hitConfirmed: true, roundId: "a" });
    const defender = game.actors.get(ids.defender);
    const shot = await api.fireAutomatonTurret(pc, turret.id, { target: defender, confirmed: true, inRange: true, roundId: "b",
      pcAttack: { damage: { mode: "wound", severity: "moderate", wounds: 1, stat: "might" } }, defenseOptions: { automaticFailure: true } });
    const message = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === defender.uuid);
    return { first, repeated, health: enemy.system.health.value, flight: api.automatonFlight(npc).enabled,
      shot, wound: defender.system.wounds.moderate.current, difficulty: message?.flags.cypher?.effectiveDifficulty };
  }, { ids, abilities });
  expect(result).toEqual({ first: true, repeated: false, health: 17, flight: false, shot: true, wound: 1, difficulty: 1 });
});

test("companion upgrades: Beast Eyes gives the owner player native vision without beast ownership and expires after reload", async ({ e2ePage: page, browser }) => {
  const ids = await page.evaluate(async () => {
    const user = await globalThis.User.create({ name: "e2e-beast-eyes", role: CONST.USER_ROLES.PLAYER, password: "" });
    const pc = await Actor.create({ name: "E2E remote viewer", type: "pc", ownership: { default: 0, [user.id]: 3 }, system: { tier: 2 } });
    const beast = await Actor.create({ name: "E2E remote beast", type: "npc", ownership: { default: 0 }, system: { level: 2, health: { value: 6, max: 6 } } });
    const scene = await globalThis.Scene.create({ name: "E2E Beast Eyes scene", active: false, tokenVision: true, width: 2000, height: 2000 });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ name: beast.name, actorId: beast.id, actorLink: true,
      x: 1000, y: 1000, sight: { enabled: false, range: 30, visionMode: "basic" } }]);
    const ready = new Promise(resolve => Hooks.once("canvasReady", resolve));
    await scene.activate(); await ready;
    return { user: user.id, pc: pc.id, beast: beast.id, scene: scene.id, tokenUuid: token.uuid };
  });
  const abilities = await sources(page, ids.pc, ["beast-companion", "beast-eyes"]);
  await page.evaluate(async ({ ids, abilities }) => {
    const pc = game.actors.get(ids.pc), beast = game.actors.get(ids.beast), api = game.cypher.companions;
    await game.cypher.followers.applyFollowerAbility(pc, abilities["beast-companion"], { confirmed: true, followers: [{ npcUuid: beast.uuid, healthPerLevel: 3 }] });
    const slot = Object.keys(pc.flags.cypher.followers)[0];
    await api.configureCompanion(pc, { confirmed: true, followerId: slot, alive: true });
    if (!await api.activateCompanionUpgrade(pc, abilities["beast-eyes"], { confirmed: true, withinRange: true, visionTokenUuid: ids.tokenUuid })) throw Error("Sensory link rejected");
  }, { ids, abilities });
  const context = await browser.newContext(), player = await context.newPage(), errors = [];
  player.on("pageerror", error => errors.push(error.message));
  try {
    await joinAsGamemaster(player, "e2e-beast-eyes");
    await expect.poll(() => player.evaluate(() => canvas.ready && canvas.tokens.placeables.some(token => token.vision?.active))).toBe(true);
    expect(await player.evaluate(ids => ({ owns: game.actors.get(ids.beast).isOwner, enabled: canvas.tokens.placeables[0].hasSight,
      saved: canvas.tokens.placeables[0].document.sight.enabled, source: canvas.tokens.placeables[0]._isVisionSource() }), ids))
      .toEqual({ owns: false, enabled: true, saved: false, source: true });
    await player.reload(); await waitForFoundryReady(player);
    await expect.poll(() => player.evaluate(() => canvas.tokens.placeables.some(token => token.vision?.active))).toBe(true);
    await page.evaluate(async ids => game.actors.get(ids.pc).rollRecovery("tenMinutes", { completed: true }), ids);
    await expect.poll(() => player.evaluate(() => canvas.tokens.placeables.some(token => token.vision?.active))).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await page.evaluate(async ids => { await game.users.get(ids.user)?.delete(); }, ids);
  }
});
