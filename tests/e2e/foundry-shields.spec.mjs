/** CRD / Defending / Armor and Shields: exercise real equipment and wound routing. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

for (const language of ["en", "fr"]) {
  test(`shield lifecycle from the real ${language} pack and PC sheet survives reload`, async ({ e2ePage: page }) => {
    const originalLanguage = await page.evaluate(() => game.i18n.lang);
    try {
      const ids = await page.evaluate(async language => {
        await game.i18n.setLanguage(language);
        const actor = await Actor.create({ name: `E2E ${language} shield lifecycle`, type: "pc" });
        const pack = game.packs.get(`cypher.equipment-${language}`);
        const index = await pack.getIndex();
        const entry = index.find(item => item.type === "shield");
        if (!entry) throw new Error("Missing authored shield");
        const data = (await pack.getDocument(entry._id)).toObject();
        delete data._id;
        const [shield] = await actor.createEmbeddedDocuments("Item", [data]);
        await actor.sheet.render({ force: true });
        return { actor: actor.id, shield: shield.id };
      }, language);
      const row = page.locator(`.pc-dashboard [data-item-id="${ids.shield}"]`);
      const equipped = row.locator('[data-action="toggleEquipped"]');
      await expect(equipped).not.toBeChecked();
      await equipped.check();
      await expect.poll(() => page.evaluate(ids => game.actors.get(ids.actor).items.get(ids.shield).system.equipped, ids)).toBe(true);

      const block = async (severity, useShield) => {
        await page.locator('.pc-dashboard [data-action="rollDefense"][data-defense-type="block"]').click();
        const form = page.locator("form").filter({ has: page.locator('select[name="incomingSeverity"]') }).last();
        await form.locator('select[name="incomingSeverity"]').selectOption(severity);
        await form.locator('input[name="difficulty"]').fill("0");
        await form.locator('select[name="shieldItemId"]').selectOption(useShield ? ids.shield : "");
        const count = await page.evaluate(() => game.messages.size);
        await form.getByRole("button").last().click();
        await expect.poll(() => page.evaluate(() => game.messages.size)).toBeGreaterThan(count);
        await expect(form).not.toBeVisible();
      };
      // Equipping gives an option; the player can still choose ordinary reduction.
      await block("moderate", false);
      for (let index = 0; index < 5; index++) await block("minor", true);
      const beforeLast = await page.evaluate(ids => {
        const actor = game.actors.get(ids.actor), shield = actor.items.get(ids.shield);
        return { shield: Object.values(shield.system.wounds).map(track => track.current),
          broken: shield.system.broken, equipped: shield.system.equipped,
          pc: Object.values(actor.system.wounds).map(track => track.current) };
      }, ids);
      expect(beforeLast).toEqual({ shield: [3, 2, 0], broken: false, equipped: true, pc: [1, 0, 0] });
      await block("minor", true);
      await expect(equipped).not.toBeChecked();
      await expect(equipped).toBeDisabled();
      const brokenLabel = await page.evaluate(() => game.i18n.localize("CYPHER.Shield.BrokenLabel"));
      await expect(row).toContainText(brokenLabel);

      await page.reload();
      await waitForFoundryReady(page);
      const state = await page.evaluate(async ids => {
        const actor = game.actors.get(ids.actor), shield = actor.items.get(ids.shield);
        await actor.sheet.render({ force: true });
        await shield.sheet.render({ force: true });
        return { broken: shield.system.broken, equipped: shield.system.equipped,
          shield: Object.values(shield.system.wounds).map(track => track.current),
          pc: Object.values(actor.system.wounds).map(track => track.current) };
      }, ids);
      expect(state).toEqual({ broken: true, equipped: false, shield: [3, 2, 1], pc: [1, 0, 0] });
      const itemSheet = page.locator(".cypher.sheet.item");
      await expect(itemSheet.locator('input[name="system.wounds.major.current"]')).toHaveValue("1");
      await expect(itemSheet.locator('input[name="system.equipped"]')).toBeDisabled();
      await page.evaluate(async ids => { await game.actors.get(ids.actor).items.get(ids.shield).sheet.close(); }, ids);
      await page.locator('.pc-dashboard [data-action="rollDefense"][data-defense-type="block"]').click();
      const form = page.locator("form").filter({ has: page.locator('select[name="incomingSeverity"]') }).last();
      await expect(form).toBeVisible();
      await expect(form.locator('select[name="shieldItemId"]')).toHaveCount(0);
      await page.keyboard.press("Escape");
    } finally {
      await page.evaluate(async language => { await game.i18n.setLanguage(language); }, originalLanguage);
    }
  });
}

test("shield destruction from an NPC attack affects only the selected synthetic Actor", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const base = await Actor.create({ name: "E2E shield synthetic owner", type: "pc" });
    const [shield] = await base.createEmbeddedDocuments("Item", [{ name: "Token shield", type: "shield", system: { equipped: true } }]);
    const scene = await globalThis.Scene.create({ name: "E2E shield synthetic scene", active: false });
    const tokens = await scene.createEmbeddedDocuments("Token", [0, 1].map(index => ({
      name: `E2E shield target ${index}`, actorId: base.id, actorLink: false, x: 100 * index, y: 0
    })));
    const npc = await Actor.create({ name: "E2E shield attacker", type: "npc", system: { level: 0, attacks: [{
      name: "Double impact", range: "Immediate", action: "action", damage: { mode: "wound", severity: "major", wounds: 2, stat: "might" }
    }] } });
    const result = await npc.rollNpcAttack(npc.system.attacks[0], {
      target: tokens[0].actor, defenseType: "block", shieldItemId: shield.id
    });
    if (!result?.defense.success) throw new Error("Expected successful synthetic Block");
    return { base: base.id, shield: shield.id, scene: scene.id, tokens: tokens.map(token => token.id) };
  });
  await page.reload();
  await waitForFoundryReady(page);
  const state = await page.evaluate(ids => {
    const scene = game.scenes.get(ids.scene);
    return [...ids.tokens.map(id => scene.tokens.get(id).actor), game.actors.get(ids.base)].map(actor => {
      const shield = actor.items.get(ids.shield);
      return { broken: shield.system.broken, equipped: shield.system.equipped,
        pcModerate: actor.system.wounds.moderate.current, shieldMajor: shield.system.wounds.major.current };
    });
  }, ids);
  expect(state).toEqual([
    { broken: true, equipped: false, pcModerate: 1, shieldMajor: 1 },
    { broken: false, equipped: true, pcModerate: 0, shieldMajor: 0 },
    { broken: false, equipped: true, pcModerate: 0, shieldMajor: 0 }
  ]);
});

test("the NPC sheet offers an explicit shield Block for the targeted token", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E NPC shield choice", type: "pc" });
    const [shield] = await pc.createEmbeddedDocuments("Item", [{ name: "Chosen shield", type: "shield", system: { equipped: true } }]);
    const scene = await globalThis.Scene.create({ name: "E2E NPC shield choice scene", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ name: "Shield target", actorId: pc.id,
      actorLink: true, x: 100, y: 100 }]);
    await scene.view();
    const placeable = canvas.tokens.get(token.id);
    if (!placeable) throw new Error("Missing real target token");
    placeable.setTarget(true, { releaseOthers: true });
    const npc = await Actor.create({ name: "E2E NPC shield choice attacker", type: "npc", system: {
      level: 0, attacks: [{ name: "Shield impact", range: "Immediate", action: "action",
        damage: { mode: "wound", severity: "moderate", wounds: 1, stat: "might" } }]
    } });
    await npc.sheet.render({ force: true });
    return { pc: pc.id, npc: npc.id, shield: shield.id };
  });
  await page.locator('[data-action="rollNpcAttack"][data-attack-index="0"]').click();
  const form = page.locator("form").filter({ has: page.locator('select[name="defenseType"]') }).last();
  await expect(form.locator(`option[value="shield:${ids.shield}"]`)).toHaveText(/Chosen shield/);
  await form.locator('select[name="defenseType"]').selectOption(`shield:${ids.shield}`);
  await form.getByRole("button").last().click();
  await expect.poll(() => page.evaluate(ids => game.actors.get(ids.pc).items.get(ids.shield).system.wounds.moderate.current, ids)).toBe(1);
  const state = await page.evaluate(ids => {
    const pc = game.actors.get(ids.pc);
    return Object.values(pc.system.wounds).map(track => track.current);
  }, ids);
  expect(state).toEqual([0, 0, 0]);
});
