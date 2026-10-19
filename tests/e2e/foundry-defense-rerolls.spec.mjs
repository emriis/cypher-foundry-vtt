/** Verify defense replacement, attribution and persisted reroll origins in real Foundry. */
import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

/** The disposable world's sidebar starts collapsed; use its persistent chat log. */
async function openChat(page) {
  await page.evaluate(async () => {
    await ui.sidebar.changeTab("chat", "primary");
    await ui.sidebar.expand();
  });
  // V14 finishes transient-card animations after the message write resolves.
  // Let core move those cards before targeting the persistent sidebar button.
  await page.waitForFunction(() => !document.querySelector("#chat-notifications .message[hidden], #chat-notifications .spacer"));
  await expect.poll(async () => {
    await page.evaluate(async () => { await globalThis.foundry?.nue?.Tour?.activeTour?.exit(); });
    return page.locator(".tour-overlay").count();
  }).toBe(0);
}

test("defense rerolls from chat preserve later wounds, original costs and their origin after reload", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825); // d20 = 4.
  const actorId = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E defense reroll costs", type: "pc", system: {
      xp: 5, stats: { speed: { pool: { value: 10, max: 10 }, edge: 0 } }
    } });
    await actor.sheet.render({ force: true });
    return actor.id;
  });
  await page.locator('.pc-dashboard [data-action="rollDefense"][data-defense-type="dodge"]').click();
  const form = page.locator("form").filter({ has: page.locator('select[name="incomingSeverity"]') }).last();
  await form.locator('select[name="incomingSeverity"]').selectOption("moderate");
  await form.locator('input[name="difficulty"]').fill("4");
  await form.locator('input[name="effort"]').fill("1");
  await form.getByRole("button").last().click();
  await expect.poll(() => page.evaluate(id => game.actors.get(id).system.wounds.moderate.current, actorId)).toBe(1);
  const originId = await page.evaluate(async id => {
    const actor = game.actors.get(id);
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === id && message.flags.cypher?.defenseType === "dodge");
    if (!origin?.flags.cypher.defenseConsequences) throw new Error("Missing defense history");
    await actor.addWound("moderate");
    await actor.sheet.close();
    return origin.id;
  }, actorId);
  await setDiceUniform(page, 0.425); // d20 = 12; succeeds against recorded target 9.
  await openChat(page);
  await page.locator(`#chat .chat-log [data-message-id="${originId}"] .cypher-reroll-button`).click({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(id => game.messages.get(id).flags.cypher.defenseConsequences.state, originId)).toBe("corrected");
  const state = await page.evaluate(id => {
    const actor = game.actors.get(id);
    return { wounds: actor.system.wounds.moderate.current, xp: actor.system.xp, speed: actor.system.stats.speed.pool.value };
  }, actorId);
  expect(state).toEqual({ wounds: 1, xp: 4, speed: 7 });

  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.875); // d20 = 3; keep the earlier 12.
  const after = await page.evaluate(async ({ actorId, originId }) => {
    const actor = game.actors.get(actorId);
    await actor.addWound("moderate");
    await actor.rerollMessage(game.messages.get(originId));
    return { wounds: actor.system.wounds.moderate.current, xp: actor.system.xp,
      speed: actor.system.stats.speed.pool.value, best: game.messages.get(originId).flags.cypher.d20 };
  }, { actorId, originId });
  expect(after).toEqual({ wounds: 2, xp: 3, speed: 7, best: 12 });
});

test("a rerolled NPC Block transfers a synthetic defender's wound to its shield and persists destruction", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825);
  const ids = await page.evaluate(async () => {
    const base = await Actor.create({ name: "E2E reroll synthetic base", type: "pc", system: { xp: 5 } });
    const [shield] = await base.createEmbeddedDocuments("Item", [{ name: "Reroll shield", type: "shield", system: { equipped: true } }]);
    const scene = await globalThis.Scene.create({ name: "E2E reroll synthetic scene", active: false });
    const tokens = await scene.createEmbeddedDocuments("Token", [0, 1].map(index => ({
      name: `E2E reroll target ${index}`, actorId: base.id, actorLink: false, x: index * 100, y: 0
    })));
    const npc = await Actor.create({ name: "E2E reroll NPC", type: "npc", system: { level: 3, attacks: [{
      name: "Major wound", range: "Immediate", action: "action",
      damage: { mode: "wound", severity: "major", wounds: 1, stat: "might" }
    }] } });
    const target = tokens[0].actor;
    await npc.rollNpcAttack(npc.system.attacks[0], { target, defenseType: "block", shieldItemId: shield.id });
    await target.addWound("minor");
    const origin = [...game.messages].find(message => message.flags.cypher?.actorUuid === target.uuid && message.flags.cypher?.defenseType === "block");
    if (target.system.wounds.major.current !== 1 || !origin) throw new Error("Missing failed Block consequence");
    return { base: base.id, scene: scene.id, shield: shield.id, tokens: tokens.map(token => token.id), origin: origin.id };
  });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425);
  await openChat(page);
  await page.locator(`#chat .chat-log [data-message-id="${ids.origin}"] .cypher-reroll-button`).click({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(id => game.messages.get(id).flags.cypher.defenseConsequences.state, ids.origin)).toBe("corrected");
  await page.reload();
  await waitForFoundryReady(page);
  const state = await page.evaluate(ids => {
    const scene = game.scenes.get(ids.scene);
    return [...ids.tokens.map(id => scene.tokens.get(id).actor), game.actors.get(ids.base)].map(actor => {
      const shield = actor.items.get(ids.shield);
      return { minor: actor.system.wounds.minor.current, major: actor.system.wounds.major.current,
        shieldMajor: shield.system.wounds.major.current, equipped: shield.system.equipped, xp: actor.system.xp };
    });
  }, ids);
  expect(state).toEqual([
    { minor: 1, major: 0, shieldMajor: 1, equipped: false, xp: 4 },
    { minor: 0, major: 0, shieldMajor: 0, equipped: true, xp: 5 },
    { minor: 0, major: 0, shieldMajor: 0, equipped: true, xp: 5 }
  ]);
});

test("defense healing attribution revisions persist and protect later wounds from old rerolls", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825);
  const ids = await page.evaluate(async () => {
    const base = await Actor.create({ name: "E2E healed defense reroll", type: "pc", system: { xp: 5 } });
    const scene = await globalThis.Scene.create({ name: "E2E healed synthetic defense", active: false });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ name: "E2E healed synthetic target",
      actorId: base.id, actorLink: false, x: 0, y: 0 }]);
    const actor = token.actor;
    await actor.rollDefense("dodge", { incomingSeverity: "moderate" });
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === actor.id && message.flags.cypher?.defenseType === "dodge");
    await actor.update({ "system.wounds.moderate.current": 0 });
    await actor.addWound("moderate");
    return { actor: actor.uuid, base: base.id, origin: origin.id };
  });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425);
  const state = await page.evaluate(async ids => {
    const actor = await fromUuid(ids.actor);
    const metadata = await actor.rerollMessage(game.messages.get(ids.origin));
    return { wounds: actor.system.wounds.moderate.current, best: metadata.d20,
      state: metadata.defenseConsequences.state, revision: actor.flags.cypher.defenseRevisions.wound_moderate,
      baseRevision: game.actors.get(ids.base).flags.cypher?.defenseRevisions?.wound_moderate ?? 0 };
  }, ids);
  expect(state).toEqual({ wounds: 1, best: 12, state: "manual", revision: 1, baseRevision: 0 });
});

test("an NPC Pool-defense reroll corrects damage and wound overflow without replaying the attack", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825);
  const ids = await page.evaluate(async () => {
    const pc = await Actor.create({ name: "E2E Pool defense reroll", type: "pc", system: {
      xp: 5, stats: { might: { pool: { value: 2, max: 10 }, edge: 0 } }
    } });
    const npc = await Actor.create({ name: "E2E Pool defense attacker", type: "npc", system: { level: 3, attacks: [{
      name: "Pool attack", range: "Immediate", action: "action",
      damage: { mode: "pool", stat: "might", amount: 7, severity: "minor", wounds: 1 }
    }] } });
    await npc.rollNpcAttack(npc.system.attacks[0], { target: pc, defenseType: "dodge" });
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === pc.id && message.flags.cypher?.defenseType === "dodge");
    if (pc.system.stats.might.pool.value !== 0 || pc.system.wounds.moderate.current !== 1) throw new Error("Missing Pool damage/overflow");
    await pc.addWound("minor");
    return { pc: pc.id, origin: origin.id };
  });
  await page.reload();
  await waitForFoundryReady(page);
  await setDiceUniform(page, 0.425);
  const state = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.pc);
    await actor.rerollMessage(game.messages.get(ids.origin));
    return { pool: actor.system.stats.might.pool.value, moderate: actor.system.wounds.moderate.current,
      minor: actor.system.wounds.minor.current, xp: actor.system.xp };
  }, ids);
  expect(state).toEqual({ pool: 2, moderate: 0, minor: 1, xp: 4 });
});

test("a natural-20 defense reroll corrects wounds and refunds the original point cost exactly once", async ({ e2ePage: page }) => {
  await setDiceUniform(page, 0.825);
  const ids = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E natural-20 defense reroll", type: "pc", system: {
      xp: 5, stats: { might: { pool: { value: 10, max: 10 }, edge: 0 } }
    } });
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ name: "Natural-20 shield", type: "shield", system: { equipped: true } }]);
    await actor.rollDefense("block", { difficulty: 4, effortLevels: 1, incomingSeverity: "major", shieldItemId: shield.id });
    const origin = [...game.messages].find(message => message.flags.cypher?.actorId === actor.id && message.flags.cypher?.defenseType === "block");
    if (actor.system.stats.might.pool.value !== 7) throw new Error("Missing original Effort cost");
    return { actor: actor.id, shield: shield.id, origin: origin.id };
  });
  await setDiceUniform(page, 0.025); // d20 = 20.
  const first = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.actor);
    await actor.rerollMessage(game.messages.get(ids.origin));
    return { pool: actor.system.stats.might.pool.value, xp: actor.system.xp, major: actor.system.wounds.major.current,
      shieldMajor: actor.items.get(ids.shield).system.wounds.major.current,
      refunded: game.messages.get(ids.origin).flags.cypher.costRefunded };
  }, ids);
  expect(first).toEqual({ pool: 10, xp: 4, major: 0, shieldMajor: 1, refunded: true });
  const second = await page.evaluate(async ids => {
    const actor = game.actors.get(ids.actor);
    await actor.update({ "system.stats.might.pool.value": 7 });
    await actor.rerollMessage(game.messages.get(ids.origin));
    return { pool: actor.system.stats.might.pool.value, xp: actor.system.xp, shieldMajor: actor.items.get(ids.shield).system.wounds.major.current };
  }, ids);
  expect(second).toEqual({ pool: 7, xp: 3, shieldMajor: 1 });
});
