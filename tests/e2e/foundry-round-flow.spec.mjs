/** Exercise persisted CRD phases through the real Combat document and rendered GM panel. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

async function setup(page) {
  return page.evaluate(async () => {
    const actors = [];
    for (const name of ["Fast", "Ordinary", "First", "Last"]) actors.push(await Actor.create({ name: `E2E round ${name}`, type: "pc" }));
    const npc = await Actor.create({ name: "E2E round target", type: "npc", system: { level: 0 } });
    const combat = await globalThis.Combat.create({ scene: null, active: true });
    await combat.createEmbeddedDocuments("Combatant", actors.map((actor, index) => ({ actorId: actor.id, initiative: 20 - index * 4 })));
    const ids = actors.map(actor => combat.combatants.find(entry => entry.actorId === actor.id).id);
    return { combat: combat.id, npc: npc.id, ids, actors: actors.map(actor => actor.id) };
  });
}

test("round flow: First, waiting, follow-up and Last survive reload without duplicate actions", async ({ e2ePage: page }) => {
  const data = await setup(page);
  const initial = await page.evaluate(async data => {
    const service = await import("/systems/cypher/module/applications/round-flow-service.mjs");
    const combat = game.combats.get(data.combat);
    await service.planCombatRound(combat, [
      { combatantId: data.ids[2], mode: "first", confirmed: true },
      { combatantId: data.ids[3], mode: "last", confirmed: true }
    ]);
    await combat.startCombat();
    const actor = combat.combatant.actor;
    const result = await actor.rollTask({ difficulty: 0, rollRoutine: false, isAttack: true,
      targetActor: game.actors.get(data.npc), weaponSource: { itemId: "declared-weapon" },
      weaponTargetEffects: [{ effect: "hindered", hinderSteps: 1, duration: "one round" }] });
    const duplicate = await actor.rollTask({ difficulty: 0, rollRoutine: false });
    return { active: combat.combatant.id, success: result.success, duplicate,
      revision: combat.flags.cypher.turnRevisions[data.ids[2]] };
  }, data);
  expect(initial).toEqual({ active: data.ids[2], success: true, duplicate: null, revision: 1 });
  await page.reload(); await waitForFoundryReady(page);
  const after = await page.evaluate(async data => {
    const service = await import("/systems/cypher/module/applications/round-flow-service.mjs");
    const combat = game.combats.get(data.combat);
    const duplicate = await combat.combatant.actor.rollTask({ difficulty: 0, rollRoutine: false });
    await combat.nextTurn();
    await service.waitCombatTurn(combat, { trigger: "door opens" });
    const ordinary = combat.combatant.id;
    const denied = await service.resumeCombatTurn(combat, data.ids[0]);
    await service.resumeCombatTurn(combat, data.ids[0], { triggerConfirmed: true });
    const resumed = combat.combatant.id;
    await combat.nextTurn(); await combat.nextTurn();
    const phase = service.getRoundFlow(combat).queue[service.getRoundFlow(combat).cursor].phase;
    const attack = await combat.combatant.actor.rollTask({ difficulty: 0, isAttack: true, rollRoutine: false });
    const minor = await combat.combatant.actor.rollTask({ difficulty: 0, minorActivity: true, rollRoutine: false });
    const firstRevision = combat.flags.cypher.turnRevisions[data.ids[2]];
    await combat.nextTurn(); const last = combat.combatant.id;
    await combat.nextTurn();
    const effects = await import("/systems/cypher/module/applications/weapon-effect-service.mjs");
    const survivesRoundChange = effects.getActiveWeaponEffects(game.actors.get(data.npc)).length;
    const restored = combat.combatant.id;
    await combat.nextTurn(); await combat.nextTurn();
    const expiredAtSourceTurn = effects.getActiveWeaponEffects(game.actors.get(data.npc)).length;
    const present = combat.combatant.id;
    await combat.previousTurn(); await combat.nextTurn();
    const returnedToPresent = combat.combatant.id === present && combat.flags.cypher.roundFlow.rewindAnchor === null;
    return { duplicate, ordinary, denied, resumed, phase, attack, minor: minor.success, firstRevision,
      last, round: combat.round, restored, survivesRoundChange, expiredAtSourceTurn, returnedToPresent };
  }, data);
  expect(after).toEqual({ duplicate: null, ordinary: data.ids[1], denied: false, resumed: data.ids[0],
    phase: "followUp", attack: null, minor: true, firstRevision: 1, last: data.ids[3], round: 2, restored: data.ids[0],
    survivesRoundChange: 1, expiredAtSourceTurn: 0, returnedToPresent: true });
});

test("round flow: GM panel declarations and keyboard controls render in both locales and themes", async ({ e2ePage: page }) => {
  const data = await setup(page);
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      await page.evaluate(async ({ original, language, theme, data }) => {
        await game.i18n.setLanguage(language);
        const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        await ui.sidebar.changeTab("combat", "primary"); await ui.sidebar.expand();
        await ui.combat.render({ force: true, combat: game.combats.get(data.combat) });
      }, { original, language, theme, data });
      await expect(page.locator(".cypher-round-button").first()).toHaveText(language === "fr" ? "Déroulement du round" : "Round sequence");
      await page.locator(".cypher-round-button").first().press("Enter");
      const panel = page.locator(".cypher-round-flow");
      await expect(panel).toBeVisible();
      await panel.locator('[data-action="plan"]').press("Enter");
      const select = page.locator(`select[data-combatant-id="${data.ids[2]}"]`);
      await expect(select).toBeVisible();
      await select.selectOption("first");
      await select.locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
      await expect(select).toHaveCount(0);
      await expect.poll(() => page.evaluate(data => game.combats.get(data.combat).flags.cypher?.roundFlow?.plans
        .find(entry => entry.combatantId === data.ids[2])?.mode, data)).toBe("first");
      await panel.locator('button[data-action="close"]').click();
      await expect(panel).toHaveCount(0);
    }
  } finally {
    await page.evaluate(async original => {
      await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config);
    }, original);
  }
});
