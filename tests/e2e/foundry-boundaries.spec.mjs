/** Exercise real authorization, synthetic identities and socket-persisted state. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { joinAsGamemaster, waitForFoundryReady } from "./foundry-session.mjs";

test("an attack updates only its actual unlinked token Actor and survives a fresh client load", async ({ e2ePage: page }) => {
  const ids = await page.evaluate(async () => {
    const attacker = await Actor.create({ name: "E2E Cypher synthetic attacker", type: "pc" });
    const base = await Actor.create({ name: "E2E Cypher synthetic base", type: "npc", system: { health: { value: 10, max: 10 }, armor: 0 } });
    const scene = await globalThis.Scene.create({ name: "E2E synthetic boundary", active: false });
    try {
      const tokens = await scene.createEmbeddedDocuments("Token", [0, 1].map(index => ({
        name: `E2E target ${index}`, actorId: base.id, actorLink: false, x: index * 100, y: 0
      })));
      const target = tokens[0].actor;
      if (!target?.isToken || target === base) throw new Error("Expected a real synthetic Actor");
      const { rollTask } = await import("/systems/cypher/module/applications/task-service.mjs");
      const result = await rollTask(attacker, { isAttack: true, difficulty: 0, baseDamage: 4, targetActor: target });
      if (!result) throw new Error("Synthetic attack was rejected");
      return { scene: scene.id, base: base.id, attacker: attacker.id, tokens: tokens.map(token => token.id),
        health: [target.system.health.value, tokens[1].actor.system.health.value, base.system.health.value] };
    } catch (error) { await scene.delete(); await base.delete(); await attacker.delete(); throw error; }
  });
  try {
    expect(ids.health).toEqual([6, 10, 10]);
    await page.reload();
    await waitForFoundryReady(page);
    const health = await page.evaluate(ids => {
      const scene = game.scenes.get(ids.scene);
      return [...ids.tokens.map(id => scene.tokens.get(id).actor.system.health.value), game.actors.get(ids.base).system.health.value];
    }, ids);
    expect(health).toEqual([6, 10, 10]);
  } finally {
    await page.evaluate(async ids => {
      await game.scenes.get(ids.scene)?.delete();
      for (const id of [ids.base, ids.attacker]) await game.actors.get(id)?.delete();
    }, ids);
  }
});

test("an owner player can pay for a task but cannot spend resources against an unauthorized target", async ({ e2ePage: page, browser }) => {
  const ids = await page.evaluate(async () => {
    const user = await globalThis.User.create({ name: "e2e-owner", role: CONST.USER_ROLES.PLAYER, password: "" });
    const pc = await Actor.create({ name: "E2E Cypher player", type: "pc", ownership: { default: 0, [user.id]: 3 },
      system: { stats: { might: { pool: { value: 10, max: 10 }, edge: 0 } } } });
    const forbidden = await Actor.create({ name: "E2E Cypher forbidden", type: "npc", ownership: { default: 0 } });
    return { user: user.id, pc: pc.id, forbidden: forbidden.id };
  });
  const context = await browser.newContext();
  const player = await context.newPage();
  const errors = [];
  player.on("pageerror", error => errors.push(error.message));
  try {
    await joinAsGamemaster(player, "e2e-owner");
    const result = await player.evaluate(async ids => {
      const pc = game.actors.get(ids.pc), target = game.actors.get(ids.forbidden);
      const { rollTask } = await import("/systems/cypher/module/applications/task-service.mjs");
      const rejected = await rollTask(pc, { isAttack: true, targetActor: target, difficulty: 0, effortLevels: 1, baseDamage: 4 });
      const before = pc.system.stats.might.pool.value;
      const accepted = await rollTask(pc, { difficulty: 0, effortLevels: 1 });
      return { gm: game.user.isGM, ownsPC: pc.isOwner, ownsTarget: target.isOwner,
        rejected: rejected === null, accepted: Boolean(accepted), before, after: pc.system.stats.might.pool.value };
    }, ids);
    expect(result).toEqual({ gm: false, ownsPC: true, ownsTarget: false, rejected: true, accepted: true, before: 10, after: 7 });
    await expect.poll(() => page.evaluate(id => game.actors.get(id).system.stats.might.pool.value, ids.pc)).toBe(7);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await page.evaluate(async ids => {
      for (const id of [ids.pc, ids.forbidden]) await game.actors.get(id)?.delete();
      await game.users.get(ids.user)?.delete();
    }, ids);
  }
});
