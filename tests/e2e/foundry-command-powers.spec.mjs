/** Real source imports, command dialogs, paid rerolls, managed timing and resource-backed ally care. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function source(page, pcId, key, language = "en") {
  return page.evaluate(async ({ pcId, key, language }) => {
    const pack = game.packs.get(`cypher.abilities-${language}`), index = await pack.getIndex({ fields: ["system.key"] });
    const row = index.find(entry => entry.system.key === key);
    if (!row) throw Error(`Missing source: ${key}`);
    const data = (await pack.getDocument(row._id)).toObject(); delete data._id;
    return (await game.actors.get(pcId).createEmbeddedDocuments("Item", [data]))[0].id;
  }, { pcId, key, language });
}
async function submit(page, selector) {
  await page.locator(selector).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(selector)).toHaveCount(0);
}

test("command powers: EN/FR light/dark Soothe dialogs, paid rerolls and companion expiry", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
  for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
    const ids = await page.evaluate(async ({ language, theme }) => {
      await game.i18n.setLanguage(language);
      const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
      const value = game.settings.get("core", setting);
      const colorScheme = { applications: theme, interface: theme };
      await game.settings.set("core", setting, setting === "uiConfig" ? { ...value, colorScheme } : colorScheme);
      const pc = await Actor.create({ name: `E2E calmer ${language} ${theme}`, type: "pc", system: { xp: 5, effort: 2,
        stats: { intellect: { pool: { value: 20, max: 20 }, edge: 1 } } } });
      const base = await Actor.create({ name: "E2E wild beast", type: "npc", system: { level: 2, health: { value: 5, max: 6 } } });
      const scene = await globalThis.Scene.create({ name: "E2E calm scene", active: false });
      const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
      await scene.view(); canvas.tokens.get(token.id).setTarget(true, { releaseOthers: true });
      return { pc: pc.id, npcUuid: token.actor.uuid, base: base.id };
    }, { language, theme });
    const item = await source(page, ids.pc, "soothe-the-savage", language);
    await source(page, ids.pc, "stronger-together", language);
    await page.evaluate(async ids => { const sheet = game.actors.get(ids.pc).sheet; await sheet.render({ force: true }); sheet.setPosition({ width: 640, height: 700 }); }, ids);
    await setDiceUniform(page, 0.925); // 2 fails against level 2.
    await page.locator(`[data-action="promptCommandPower"][data-item-id="${item}"]`).click();
    await page.locator('select[name="target"]').selectOption(ids.npcUuid);
    for (const name of ["beast", "inRange", "seesYou", "speaking"]) await page.locator(`input[name="${name}"]`).check();
    await submit(page, 'input[name="beast"]');
    const message = await page.evaluate(ids => game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === game.actors.get(ids.pc).uuid).id, ids);
    await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
    const state = await page.evaluate(async ({ ids, message }) => {
      const pc = game.actors.get(ids.pc), npc = await fromUuid(ids.npcUuid);
      await pc.rerollMessage(game.messages.get(message));
      await game.cypher.companions.configureCompanion(pc, { confirmed: true, calmedNpcUuid: npc.uuid, immediate: true, friendly: true });
      const read = await import("/systems/cypher/module/applications/command-power-read.mjs");
      const companion = await import("/systems/cypher/module/applications/companion-power-service.mjs");
      const before = { calm: read.hasActiveCalm(pc, npc), health: npc.system.health.value, baseHealth: game.actors.get(ids.base).system.health.value,
        pool: pc.system.stats.intellect.pool.value, xp: pc.system.xp, damage: (await companion.companionTaskPlan(pc, { isAttack: true })).damage };
      await pc.rollRecovery("tenMinutes", { completed: true });
      return { before, after: read.hasActiveCalm(pc, npc), damageAfter: (await companion.companionTaskPlan(pc, { isAttack: true })).damage };
    }, { ids, message });
    expect(state).toEqual({ before: { calm: true, health: 5, baseHealth: 5, pool: 20, xp: 4, damage: 2 }, after: false, damageAfter: 0 });
    await page.evaluate(async ids => game.actors.get(ids.pc).sheet.close(), ids);
  }
  } finally {
    await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original);
  }
});

test("command powers: Team-Up binding and outings survive reload; several-week care uses resource projects", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => ({ pc: (await Actor.create({ name: "E2E team-up owner", type: "pc", system: { xp: 5, resourcePoints: 5 } })).id,
    npc: (await Actor.create({ name: "E2E superhero ally", type: "npc", system: { level: 4, health: { value: 12, max: 12 } } })).id }));
  const item = await source(page, ids.pc, "team-up-ally");
  await page.evaluate(async ids => game.actors.get(ids.pc).sheet.render({ force: true }), ids);
  await page.locator(`[data-action="promptCommandPower"][data-item-id="${item}"]`).click();
  await page.locator('select[name="target"]').selectOption(`Actor.${ids.npc}`);
  await page.locator('select[name="origin"]').selectOption("ability.duplicate");
  await page.locator('textarea[name="adaptation"]').fill("Agreed NPC duplicate power");
  await page.locator('textarea[name="tasks"]').fill("Charm = 5");
  await submit(page, 'textarea[name="adaptation"]');
  await expect(page.locator('[data-command="invite"]')).toHaveCount(1);
  await setDiceUniform(page, 0.925);
  await page.locator('[data-command="invite"]').click();
  await page.locator('input[name="outing"]').fill("Patrol"); await page.locator('input[name="available"]').check();
  await submit(page, 'input[name="outing"]');
  const message = await page.evaluate(ids => game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === game.actors.get(ids.pc).uuid).id, ids);
  await page.reload(); await waitForFoundryReady(page); await setDiceUniform(page, 0.025);
  const result = await page.evaluate(async ({ ids, message }) => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc), service = game.cypher.commands;
    await pc.rerollMessage(game.messages.get(message));
    const ally = Object.values(pc.flags.cypher.teamUpAllies)[0];
    const follower = await import("/systems/cypher/module/applications/follower-service.mjs");
    const assets = (await follower.followerTaskPlan(pc, [{ id: ally.id, taskId: ally.taskLevels[0].id }])).assets;
    await pc.update({ "system.tier": 6 });
    const damage = await import("/systems/cypher/module/applications/damage-service.mjs"); await damage.applyNpcDamage(npc, 20);
    const projects = await import("/systems/cypher/module/applications/project-service.mjs");
    const proposal = { label: "Several weeks of ally care", kind: "restoreFollower", targetUuid: npc.uuid,
      followerConfirmed: true, durationSeconds: 1814400, durationSource: "Team-Up Ally: several weeks of care" };
    const rejected = await projects.createProject(pc, proposal);
    const noCare = await projects.approveProject(pc, rejected, { confirmed: true });
    const project = await projects.createProject(pc, { ...proposal, teamUpCareConfirmed: true });
    if (!await projects.approveProject(pc, project, { confirmed: true })) throw Error("Care approval rejected");
    await game.time.advance(proposal.durationSeconds);
    if (!await projects.completeProject(pc, project, { workConfirmed: true })) throw Error("Care settlement rejected");
    const afterCare = (await follower.followerTaskPlan(pc)).assets;
    await service.inviteTeamUp(pc, ally.id, { confirmed: true, available: true, label: "Return patrol" });
    await service.configureTeamUp(pc, ally.id, { endOuting: true });
    await pc.rerollMessage(game.messages.get(message));
    return { assets, level: npc.system.level, health: npc.system.health.value, points: pc.system.resourcePoints,
      noCare, afterCare, afterOldReroll: (await follower.followerTaskPlan(pc)).assets, injured: npc.flags.cypher.teamUpAlly.injured };
  }, { ids, message });
  expect(result).toEqual({ assets: 2, level: 4, health: 12, points: 3, noCare: false, afterCare: 0, afterOldReroll: 0, injured: false });
});

test("command powers: Lighting normalizes a pending Last action and promotes the next ordinary action", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => ({ pc: (await Actor.create({ name: "E2E commander", type: "pc" })).id,
    ally: (await Actor.create({ name: "E2E commanded ally", type: "pc" })).id }));
  const item = await source(page, ids.pc, "lighting-a-fire-under-them");
  const result = await page.evaluate(async ({ ids, item }) => {
    const pc = game.actors.get(ids.pc), ally = game.actors.get(ids.ally), commands = game.cypher.commands;
    const rounds = await import("/systems/cypher/module/applications/round-flow-service.mjs");
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", [{ actorId: pc.id, initiative: 20 }, { actorId: ally.id, initiative: 10 }]);
    const commanderId = combat.combatants.find(entry => entry.actorId === pc.id).id, allyId = combat.combatants.find(entry => entry.actorId === ally.id).id;
    await rounds.planCombatRound(combat, [{ combatantId: commanderId, mode: "last", confirmed: true }, { combatantId: allyId, mode: "last", confirmed: true }]);
    await combat.startCombat();
    if (!await commands.lightFire(pc, item, { targetUuid: ally.uuid, confirmed: true, ally: true, inRange: true })) throw Error("Lighting rejected");
    await combat.nextTurn();
    const phase = combat.flags.cypher.roundFlow.queue[combat.flags.cypher.roundFlow.cursor].phase;
    const action = await ally.rollTask({ difficulty: 0, rollRoutine: false, actionTiming: "lastAction" });
    const repeated = await ally.rollTask({ difficulty: 0, rollRoutine: false, actionTiming: "lastAction" });
    const exhausted = await commands.lightFire(pc, item, { targetUuid: ally.uuid, confirmed: true, ally: true, inRange: true });
    await combat.delete();
    await pc.rollRecovery("tenMinutes", { completed: true });
    await commands.lightFire(pc, item, { targetUuid: ally.uuid, confirmed: true, ally: true, inRange: true });
    const second = await globalThis.Combat.create({ scene: null, active: true });
    await second.createEmbeddedDocuments("Combatant", [{ actorId: pc.id, initiative: 20 }, { actorId: ally.id, initiative: 10 }]);
    await second.startCombat();
    const first = second.combatant.actor.id;
    const ordinary = await ally.rollTask({ difficulty: 0, rollRoutine: false, actionTiming: "action" });
    const initiatives = second.turns.map(entry => entry.initiative);
    await second.delete();
    return { phase, action: action.success, repeated, exhausted, first, ordinary: ordinary.success, initiatives, consumed: ally.flags.cypher.commandBoost.state };
  }, { ids, item });
  expect(result).toEqual({ phase: "normal", action: true, repeated: null, exhausted: false, first: ids.ally, ordinary: true, initiatives: [20, 10], consumed: "consumed" });
});
