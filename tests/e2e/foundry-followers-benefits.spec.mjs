/** Real follower progression and source-bound conditional benefits, including old world review. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";
async function submit(page, field) {
  await page.locator(field).locator("xpath=ancestor::form").locator('button[type="submit"]').press("Enter");
  await expect(page.locator(field)).toHaveCount(0);
}
async function confirm(page) { await page.locator('dialog[open] button[data-action="yes"]').press("Enter"); }
async function applySpecies(page, id, species, language = "en") {
  return page.evaluate(async ({ id, species, language }) => {
    const pack = game.packs.get(`cypher.descriptors-${language}`), index = await pack.getIndex({ fields: ["flags.cypherFoundry.crd.logicalId", "flags.cypherFoundry.crd.sourceLogicalId"] });
    const entry = index.find(entry => (entry.flags?.cypherFoundry?.crd?.sourceLogicalId ?? entry.flags?.cypherFoundry?.crd?.logicalId) === `descriptor.species.${species}`);
    if (!entry) throw Error(`Missing source ${species}`);
    const source = await pack.getDocument(entry._id), actor = game.actors.get(id);
    if (!await actor.applyDescriptor(source, { skillName: source.system.skillOptions[0] })) throw Error("Species application rejected");
    return source.uuid;
  }, { id, species, language });
}

test("followers: EN/FR and both themes link, choose help, progress every two tiers and retain damage after reload", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const ids = await page.evaluate(async ({ original, language, theme }) => {
        await game.i18n.setLanguage(language); const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        const pc = await Actor.create({ name: "E2E follower owner", type: "pc", system: { tier: 2 } });
        const npc = await Actor.create({ name: "E2E scout", type: "npc", system: { level: 2, health: { value: 4, max: 6 } } });
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return { pc: pc.id, npc: npc.id, npcUuid: npc.uuid };
      }, { original, language, theme });
      await page.locator('[data-action="promptFollower"]').press("Enter");
      await page.locator('select[name="npc"]').selectOption(ids.npcUuid);
      await page.locator('input[name="source"]').fill("CRD Followers / GM-confirmed grant");
      await page.locator('textarea[name="tasks"]').fill("Perception=4"); await submit(page, 'textarea[name="tasks"]');
      const slot = await page.evaluate(ids => Object.keys(game.actors.get(ids.pc).flags.cypher.followers)[0], ids);
      const row = () => page.locator(`article[data-follower-id="${slot}"]`);
      await expect(row()).toContainText(language === "fr" ? "À jour" : "Up to date");
      await page.locator('[data-action="rollStat"][data-stat="intellect"]').first().press("Enter");
      await page.locator(`select[name="follower-${slot}"]`).selectOption(await page.evaluate(({ ids, slot }) => game.actors.get(ids.pc).flags.cypher.followers[slot].taskLevels[0].id, { ids, slot }));
      await page.locator('input[name="difficulty"]').fill("5"); await submit(page, 'input[name="difficulty"]');
      expect(await page.evaluate(ids => game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === game.actors.get(ids.pc).uuid).flags.cypher.followerHelp[0].assets, ids)).toBe(1);
      await row().locator('[data-action="configureFollower"]').press("Enter");
      await page.locator('select[name="mode"]').selectOption("defense"); await submit(page, 'select[name="mode"]');
      await page.evaluate(async ids => { await game.actors.get(ids.pc).update({ "system.tier": 4 }); }, ids);
      await expect.poll(() => page.evaluate(ids => game.actors.get(ids.npc).system.level, ids)).toBe(3);
      await expect(row()).toContainText("Perception: 5");
      expect(await row().evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await row().locator('[data-action="openFollower"]').press("Enter");
      await expect(page.locator(`[data-follower-profile="${slot}"]`)).toContainText("Perception: 5");
      await page.evaluate(async ids => { await game.actors.get(ids.npc).sheet.close(); await game.actors.get(ids.npc).update({ "flags.cypher.generalEffects": [{ kind: "unconscious" }] }); }, ids);
      await expect(row()).toContainText(language === "fr" ? "Indisponible" : "Unavailable");
      expect(await page.evaluate(ids => game.cypher.followers.followerTaskPlan(game.actors.get(ids.pc)).then(plan => plan.assets), ids)).toBe(0);
      await page.evaluate(async ids => { await game.actors.get(ids.npc).update({ "flags.cypher.generalEffects": [] }); }, ids);
      await page.reload(); await waitForFoundryReady(page);
      const result = await page.evaluate(async ids => {
        const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc);
        const slot = Object.values(pc.flags.cypher.followers)[0]; await game.cypher.followers.synchronizeFollower(pc, slot.id);
        return { level: npc.system.level, health: { value: npc.system.health.value, max: npc.system.health.max }, mode: slot.mode };
      }, ids);
      expect(result).toEqual({ level: 3, health: { value: 7, max: 9 }, mode: "defense" });
    }
  } finally { await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original); }
});

test("followers: interrupted improvement and synthetic replacement retain receipts; restoration restores availability", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E interrupted follower owner", type: "pc", system: { tier: 2, resourcePoints: 5 } });
    const npc = await Actor.create({ name: "E2E interrupted follower", type: "npc", system: { level: 2, health: { value: 4, max: 6 } } });
    const api = game.cypher.followers; await api.registerFollower(pc, npc, { confirmed: true, source: "CRD Followers / GM-confirmed grant" });
    const slot = Object.values(pc.flags.cypher.followers)[0].id, update = npc.update;
    npc.update = async function(changes, options) { await update.call(this, changes, options); throw Error("E2E uncertain follower response"); };
    try { await api.configureFollower(pc, slot, { extraLevels: 1 }); }
    catch (error) { if (!error.message.includes("E2E uncertain follower response")) throw error; }
    finally { npc.update = update; }
    return { pc: pc.id, npc: npc.id, slot };
  });
  await page.reload(); await waitForFoundryReady(page);
  const result = await page.evaluate(async ids => {
    const pc = game.actors.get(ids.pc), npc = game.actors.get(ids.npc), api = game.cypher.followers;
    await api.synchronizeFollower(pc, ids.slot); const afterResume = npc.system.health.value;
    const base = await Actor.create({ name: "E2E replacement base", type: "npc", system: { level: 2, health: { value: 6, max: 6 } } });
    const scene = await globalThis.Scene.create({ name: "E2E replacement scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ actorId: base.id, actorLink: false }]);
    await api.replaceFollower(pc, ids.slot, token.actor, { confirmed: true });
    await api.configureFollower(pc, ids.slot, { available: false }); await token.actor.update({ "system.health.value": 0 });
    const project = await game.cypher.projects.createProject(pc, { label: "E2E restore linked follower", kind: "restoreFollower", targetUuid: token.actor.uuid,
      followerConfirmed: true, durationSeconds: 604800 });
    await game.cypher.projects.approveProject(pc, project, { confirmed: true }); await game.time.advance(604800);
    const restored = await game.cypher.projects.completeProject(pc, project, { workConfirmed: true });
    return { afterResume, restored, level: token.actor.system.level, health: token.actor.system.health.value,
      base: base.system.health.value, available: pc.flags.cypher.followers[ids.slot].available, points: pc.system.resourcePoints };
  }, ids);
  expect(result).toEqual({ afterResume: 7, restored: true, level: 3, health: 9, base: 6, available: true, points: 3 });
});

test("benefits: EN/FR and both themes preserve conditional training and apply structured axe and recovery bonuses", async ({ e2ePage: page }) => {
  const original = await page.evaluate(() => {
    const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
    return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
  });
  try {
    for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
      const id = await page.evaluate(async ({ language, theme, original }) => {
        await game.i18n.setLanguage(language); const colorScheme = { applications: theme, interface: theme };
        await game.settings.set("core", original.setting, original.setting === "uiConfig" ? { ...original.config, colorScheme } : colorScheme);
        return (await Actor.create({ name: "E2E conditional dwarf", type: "pc", system: { genre: "fantasy" } })).id;
      }, { language, theme, original });
      await applySpecies(page, id, "dwarf", language);
      const skill = await page.evaluate(async id => {
        const pc = game.actors.get(id), skill = pc.items.find(item => item.type === "skill");
        await pc.sheet.render({ force: true }); pc.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
        return { id: skill.id, level: skill.system.level };
      }, id);
      expect(skill.level).toBe("practiced");
      for (const active of [false, true]) {
        await page.locator('[data-action="rollStat"][data-stat="intellect"]').first().press("Enter");
        await page.locator('input[name="difficulty"]').fill("5"); await page.locator('select[name="skillItemId"]').selectOption(skill.id);
        if (active) await page.locator('input[name="benefit"][value="descriptor.species.dwarf:training"]').check();
        await submit(page, 'input[name="difficulty"]');
        expect(await page.evaluate(id => game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === game.actors.get(id).uuid).flags.cypher.effectiveDifficulty, id)).toBe(active ? 4 : 5);
      }
      const result = await page.evaluate(async id => {
        const pc = game.actors.get(id);
        const [axe] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E axe", type: "attack", flags: { cypher: { equipmentUse: { version: 1, held: true, hands: 2 } } },
          system: { attackType: "medium", damage: 4, freelyUsable: true, weaponFamily: "axes", attackSkillCategory: "mediumBladed" } }]);
        const attack = await pc.rollTask({ difficulty: 0, isAttack: true, baseDamage: 4, weaponSource: { itemId: axe.id }, rollRoutine: false });
        await pc.rollRecovery("hour");
        const recovery = game.messages.contents.findLast(message => message.flags.cypher?.rollType === "recovery" && message.flags.cypher.actorUuid === pc.uuid);
        return { damage: attack.damage, bonus: recovery.flags.cypher.rollData.bonus, base: pc.items.find(item => item.type === "skill").system.level };
      }, id);
      expect(result).toEqual({ damage: 5, bonus: 1, base: "practiced" });
      expect(await page.locator('[data-benefit-id="descriptor.species.dwarf:training"]').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.evaluate(async id => { await game.actors.get(id).sheet.close(); }, id);
    }
  } finally { await page.evaluate(async original => { await game.i18n.setLanguage(original.language); await game.settings.set("core", original.setting, original.config); }, original); }
});

test("benefits: preparation and legacy source refresh require explicit confirmations and survive reload", async ({ e2ePage: page }) => {
  const id = await page.evaluate(async () => (await Actor.create({ name: "E2E prepared prota", type: "pc", system: { genre: "sciFi" } })).id);
  await applySpecies(page, id, "prota"); await page.evaluate(async id => { await game.actors.get(id).sheet.render({ force: true }); }, id);
  await page.locator('[data-action="prepareBenefit"][data-benefit-id="descriptor.species.prota:1"]').press("Enter");
  await page.locator('input[name="scope"]').fill("E2E specific wall"); await submit(page, 'input[name="scope"]');
  expect(await page.evaluate(id => game.cypher.speciesBenefits.speciesTaskPlan(game.actors.get(id), { selected: ["descriptor.species.prota:1"] }), id)).toBeNull();
  await page.evaluate(async () => { await game.time.advance(600); });
  await page.locator('[data-action="finishBenefit"][data-benefit-id="descriptor.species.prota:1"]').press("Enter"); await confirm(page);
  await expect.poll(() => page.evaluate(id => game.actors.get(id).flags.cypher.benefitPreparations[0].state, id)).toBe("ready");
  await page.reload(); await waitForFoundryReady(page);
  expect(await page.evaluate(id => game.cypher.speciesBenefits.speciesTaskPlan(game.actors.get(id), { selected: ["descriptor.species.prota:1"] }).assets, id)).toBe(1);
  const dwarf = await page.evaluate(async () => (await Actor.create({ name: "E2E legacy dwarf", type: "pc", system: { genre: "fantasy" } })).id);
  await applySpecies(page, dwarf, "dwarf");
  const skill = await page.evaluate(async id => {
    const pc = game.actors.get(id), skill = pc.items.find(item => item.type === "skill");
    for (const item of pc.items.filter(item => item.type === "ability")) await item.unsetFlag("cypher", "ruleBenefit");
    await skill.unsetFlag("cypher", "conditionalTraining"); await skill.update({ "system.level": "trained" });
    await pc.sheet.render({ force: true }); return skill.id;
  }, dwarf);
  await page.locator('[data-action="refreshSpeciesBenefits"]').press("Enter"); await confirm(page);
  await expect.poll(() => page.evaluate(id => game.cypher.speciesBenefits.speciesBenefits(game.actors.get(id)).length, id)).toBeGreaterThan(0);
  expect(await page.evaluate(({ dwarf, skill }) => game.actors.get(dwarf).items.get(skill).system.level, { dwarf, skill })).toBe("trained");
  await page.locator('[data-action="reviewConditionalTraining"]').press("Enter"); await page.locator('select[name="skill"]').selectOption(skill);
  await page.locator('select[name="level"]').selectOption("practiced"); await page.locator('input[name="note"]').fill("GM verified species-only training");
  await submit(page, 'input[name="note"]');
  expect(await page.evaluate(({ dwarf, skill }) => game.actors.get(dwarf).items.get(skill).system.level, { dwarf, skill })).toBe("practiced");
});

test("benefits: typed species resistance survives defense rerolls and protects the PC without weakening a shield hit", async ({ e2ePage: page }) => {
  const id = await page.evaluate(async () => (await Actor.create({ name: "E2E resistant hellborn", type: "pc", system: { xp: 3, genre: "fantasy" } })).id);
  await applySpecies(page, id, "hellborn"); await setDiceUniform(page, 0.995);
  const message = await page.evaluate(async id => {
    const pc = game.actors.get(id); await pc.rollDefense("block", { difficulty: 3, incomingSeverity: "moderate", incomingDamageTags: ["fire"] });
    const message = game.messages.contents.findLast(message => message.flags.cypher?.actorUuid === pc.uuid);
    await pc.addWound("minor"); return message.id;
  }, id);
  await setDiceUniform(page, 0.025);
  const result = await page.evaluate(async ({ id, message }) => {
    const pc = game.actors.get(id); await pc.rerollMessage(game.messages.get(message));
    const corrected = pc.system.wounds.minor.current;
    const [shield] = await pc.createEmbeddedDocuments("Item", [{ name: "E2E fire shield", type: "shield", system: { equipped: true } }]);
    await pc.rollDefense("block", { difficulty: 0, incomingSeverity: "moderate", incomingDamageTags: ["fire"], shieldItemId: shield.id });
    const environment = await import("/systems/cypher/module/applications/environment-service.mjs");
    const hazard = await environment.declareEnvironmentalExposure(pc, { name: "E2E harmless flame", mode: "defense", stat: "might", difficulty: 5, severity: "minor", damageTags: ["fire"] });
    const protectedResult = await environment.resolveEnvironmentalExposure(pc, hazard.id, { expectedSequence: 0, effortLevels: 1 });
    return { corrected, xp: pc.system.xp, shield: shield.system.wounds.moderate.current, wounds: pc.system.wounds.minor.current, protected: protectedResult.protected, might: pc.system.stats.might.pool.value };
  }, { id, message });
  expect(result).toEqual({ corrected: 1, xp: 2, shield: 1, wounds: 1, protected: true, might: 8 });
});
