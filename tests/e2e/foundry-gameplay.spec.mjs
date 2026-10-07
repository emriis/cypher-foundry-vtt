import { test, expect } from "./foundry-session-fixture.mjs";

const ACTOR_PREFIX = "E2E Cypher";

async function createActor(page, overrides = {}) {
  return page.evaluate(async ({ prefix, overrides }) => {
    const actor = await Actor.create({
      name: `${prefix} ${Date.now()} ${Math.random().toString(16).slice(2)}`,
      type: "pc",
      system: {
        stats: {
          might: { pool: { max: 8, value: 8 }, edge: 0 },
          speed: { pool: { max: 8, value: 8 }, edge: 0 },
          intellect: { pool: { max: 8, value: 8 }, edge: 0 }
        }
      },
      ...overrides
    });
    return actor.id;
  }, { prefix: ACTOR_PREFIX, overrides });
}

async function logActorDiagnostics(page, actorId, label) {
  const diagnostics = await page.evaluate(id => {
    const actor = game.actors.get(id);
    if (!actor) {
      return { error: `Actor ${id} no longer exists` };
    }

    const sheet = actor.sheet;

    return {
      actor: {
        id: actor.id,
        type: actor.type,
        model: actor.constructor?.name,
        system: foundry.utils.deepClone(actor.system),
        schemaFields: Object.keys(actor.schema?.fields ?? {})
      },
      sheet: {
        constructor: sheet?.constructor?.name,
        template: sheet?.options?.template,
        rendered: sheet?.rendered,
        elementClasses: sheet?.element
          ? [...sheet.element.classList]
          : [],
        html: sheet?.element?.innerHTML?.slice(0, 4000) ?? null
      }
    };
  }, actorId);

  console.log(
    `[E2E actor diagnostics] ${label}:\n${JSON.stringify(
      diagnostics,
      null,
      2
    )}`
  );
}

async function readActor(page, actorId) {
  return page.evaluate(id => {
    const actor = game.actors.get(id);
    if (!actor) throw new Error(`Actor ${id} no longer exists`);

    return {
      id: actor.id,
      type: actor.type,
      xp: actor.system.xp,
      tier: actor.system.tier,
      effort: actor.system.effort,
      might: actor.system.stats.might.pool.value,
      speed: actor.system.stats.speed.pool.value,
      intellect: actor.system.stats.intellect.pool.value,
      wounds: {
        minor: actor.system.wounds.minor.current,
        moderate: actor.system.wounds.moderate.current,
        major: actor.system.wounds.major.current
      },
      recoveries: { ...actor.system.recoveries },
      advancement: actor.system.advancementSlots.map(slot => ({
        type: slot.type,
        bought: slot.bought
      }))
    };
  }, actorId);
}

async function cleanupActors(page) {
  await page.evaluate(async prefix => {
    const actors = game.actors.filter(actor => actor.name.startsWith(prefix));
    for (const actor of actors) await actor.delete();
  }, ACTOR_PREFIX);
}

async function closeActorSheet(page) {
  await page.evaluate(() => {
    for (const actor of game.actors) {
      if (actor.sheet?.rendered) actor.sheet.close();
    }
  });
}

async function waitForChatMessage(page, actorId) {
  await page.waitForFunction(id => {
    return [...game.messages].some(message =>
      message.speaker?.actor === id ||
      message.getFlag?.("cypher", "actorId") === id
    );
  }, actorId);
}

async function dismissActiveTour(page) {
  await page.evaluate(() => {
    const Tour = globalThis.foundry?.nue?.Tour;
    Tour?.activeTour?.exit();
  });
  await expect(page.locator(".tour-overlay")).toHaveCount(0);
}

async function clickRollDialog(page, values = {}) {
  await dismissActiveTour(page);

  const form = page.locator("form").filter({
    has: page.locator('input[name="difficulty"]')
  }).last();

  await expect(form).toBeVisible();
  for (const [name, value] of Object.entries(values)) {
    const field = form.locator(`[name="${name}"]`);
    if (await field.count()) {
      await field.fill(String(value));
    }
  }

  await dismissActiveTour(page);
  await form.getByRole("button").last().click();
}

test.describe("Cypher Foundry live gameplay", () => {
  test("renders a complete playable PC dashboard for a newly created actor", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.sheet.render(true);
    }, actorId);

    await logActorDiagnostics(page, actorId, "dashboard");

    await expect(page.locator(".pc-dashboard")).toBeVisible();
    await expect(page.locator(".sheet-header")).toBeVisible();
    await expect(page.locator(".pc-dashboard")).toBeVisible();
    await expect(page.locator(".pc-core-stats")).toBeVisible();
    await expect(page.locator('input[name="name"]').first()).toBeVisible();
    await expect(page.locator('[data-action="rollStat"][data-stat="might"]')).toBeVisible();
    await expect(page.locator('[data-action="rollStat"][data-stat="speed"]')).toBeVisible();
    await expect(page.locator('[data-action="rollStat"][data-stat="intellect"]')).toBeVisible();
    await expect(page.locator('[data-action="rollDefense"][data-defense-type="block"]')).toBeVisible();
    await expect(page.locator('[data-action="rollDefense"][data-defense-type="dodge"]')).toBeVisible();
    await expect(page.locator(".pc-skills")).toBeVisible();
    await expect(page.locator(".pc-abilities")).toBeVisible();
    await expect(page.locator(".pc-advancement")).toBeVisible();
    await page.evaluate(id => game.actors.get(id)?.sheet.close(), actorId);
  });

  test("executes a task roll from the real PC sheet and creates chat output", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({
        "system.stats.might.pool.value": 8,
        "system.stats.might.pool.max": 8
      });
      await actor.sheet.render(true);
    }, actorId);

    await logActorDiagnostics(page, actorId, "task roll");

    const before = await readActor(page, actorId);
    const messageCount = await page.evaluate(() => game.messages.size);

    // Rendering the first PC sheet can restart Foundry's first-world tour.
    // Dismiss it immediately before the first pointer interaction so it
    // cannot intercept the roll button.
    await dismissActiveTour(page);

    await page.locator(
      '[data-action="rollStat"][data-stat="might"]'
    ).first().click();

    await clickRollDialog(page, {
      difficulty: 1,
      effort: 0,
      assets: 0
    });

    await page.waitForFunction(
      ({ count, actorId }) =>
        game.messages.size > count &&
        [...game.messages].some(message => message.speaker?.actor === actorId),
      { count: messageCount, actorId }
    );

    const after = await readActor(page, actorId);
    expect(after.might).toBe(before.might);
  });

  test("executes a guaranteed failed Block from the real PC sheet and applies the incoming wound", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({
        "system.wounds.moderate.current": 0,
        "system.stats.might.pool.value": 8,
        "system.stats.might.pool.max": 8
      });
      await actor.sheet.render(true);
    }, actorId);

    await page.evaluate(() => {
      const Tour = globalThis.foundry?.nue?.Tour;
      Tour?.activeTour?.exit();
    });
    await expect(page.locator(".tour-overlay")).toHaveCount(0);
    await page.locator(".pc-dashboard").last().locator(
      '[data-action="rollDefense"][data-defense-type="block"]'