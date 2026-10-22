import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";

import { waitForFoundryReady } from "./foundry-session.mjs";

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

  await test.info().attach(
    `actor-diagnostics-${label.replace(/[^a-z0-9_-]/gi, "-")}.json`,
    {
      body: JSON.stringify(diagnostics, null, 2),
      contentType: "application/json"
    }
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
  await page.evaluate(async () => {
    for (const actor of game.actors) {
      if (actor.sheet?.rendered) await actor.sheet.close();
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
  // The first-world tour may begin asynchronously after a sheet renders.
  // Retry its public exit operation until the overlay has actually gone away.
  await expect.poll(async () => {
    await page.evaluate(async () => {
      const Tour = globalThis.foundry?.nue?.Tour;
      await Tour?.activeTour?.exit();
    });
    return page.locator(".tour-overlay").count();
  }).toBe(0);
}

async function clickRollDialog(page, values = {}) {
  await dismissActiveTour(page);

  const form = page.locator("form").filter({
    has: page.locator('input[name="difficulty"]')
  }).last();

  await expect(form).toBeVisible();
  for (const [name, value] of Object.entries(values)) {
    const field = form.locator(`[name="${name}"]`);
    await expect(field, `Required roll field: ${name}`).toBeVisible();
    await field.fill(String(value));
  }

  await dismissActiveTour(page);
  const applicationId = await form.evaluate(node => node.closest(".application")?.id);
  await form.locator('button[type="submit"]').click();
  // DialogV2 resolves input before its closing animation removes the form.
  // Wait for this specific application, so a new action's dialog is not
  // confused with the previous one while both temporarily exist in the DOM.
  if (applicationId) await expect(page.locator(`[id="${applicationId}"]`)).toHaveCount(0);
}

test.describe("Cypher Foundry live gameplay", () => {
  test("retains XP and Pool when Lucky Shot is rejected from the real sheet", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    const setup = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.xp": 3, "system.stats.might.pool.value": 0 });
      const [weapon] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E cost boundary", type: "attack", system: { stat: "might", freelyUsable: true }
      }]);
      await actor.sheet.render(true);
      return { weaponId: weapon.id, warning: game.i18n.format("CYPHER.Warning.NotEnoughPool", {
        stat: game.i18n.localize("CYPHER.Stat.might")
      }) };
    }, actorId);
    await dismissActiveTour(page);
    await page.locator(`[data-action="rollAttack"][data-item-id="${setup.weaponId}"]`).first().click();
    const form = page.locator("form").filter({ has: page.locator('input[name="difficulty"]') }).last();
    await form.locator('[name="luckyShot"]').check();
    await clickRollDialog(page, { effort: 1 });
    await expect(page.getByText(setup.warning, { exact: true })).toBeVisible();
    expect(await readActor(page, actorId)).toMatchObject({ xp: 3, might: 0 });
  });

  test("rerolls a real task repeatedly from chat while retaining the best result", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    const messageId = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      if (actor.sheet.rendered) await actor.sheet.close();
      await actor.update({ "system.xp": 3 });
      await actor.rollTask({ difficulty: 1 });
      return [...game.messages].reverse().find(message => message.getFlag("cypher", "actorId") === id).id;
    }, actorId);
    await setDiceUniform(page, 0.375); // d20 = 13.
    // The fresh world's sidebar starts collapsed; open its persistent chat log.
    await page.evaluate(() => {
      ui.sidebar.changeTab("chat", "primary");
      ui.sidebar.expand();
    });
    await dismissActiveTour(page);
    // Foundry also renders a transient copy in #chat-notifications.
    const button = page.locator(`#chat .chat-log [data-message-id="${messageId}"] .cypher-reroll-button`);
    await button.click({ timeout: 10_000 });
    await expect.poll(() => page.evaluate(id => game.messages.get(id).getFlag("cypher", "d20"), messageId)).toBe(13);
    await setDiceUniform(page, 0.925); // d20 = 2; retain 13.
    await button.click({ timeout: 10_000 });
    await expect.poll(async () => (await readActor(page, actorId)).xp).toBe(1);
    expect(await page.evaluate(id => game.messages.get(id).getFlag("cypher", "d20"), messageId)).toBe(13);
  });

  test("a real depletion reroll keeps the usable outcome and persists the restored Item", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    await setDiceUniform(page, 0.925); // d6 = 1, inside depletion 1–2.
    const setup = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.xp": 3 });
      const [item] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E depletion contract", type: "artifact",
        system: { depletionDie: "d6", depletionMin: 1, depletionMax: 2 }
      }]);
      await item.rollDepletion();
      const message = [...game.messages].reverse().find(entry => entry.getFlag("cypher", "itemId") === item.id);
      if (!item.system.depleted) throw new Error("Expected initial depletion");
      return { itemId: item.id, messageId: message.id };
    }, actorId);
    await setDiceUniform(page, 0.225); // d6 = 5, a usable outcome.
    await page.evaluate(async ({ actorId, messageId }) => {
      await game.actors.get(actorId).rerollMessage(game.messages.get(messageId));
    }, { actorId, messageId: setup.messageId });
    const result = await page.evaluate(({ actorId, itemId, messageId }) => {
      const actor = game.actors.get(actorId);
      return { depleted: actor.items.get(itemId).toObject().system.depleted,
        xp: actor.system.xp, best: game.messages.get(messageId).getFlag("cypher", "originalRoll") };
    }, { actorId, ...setup });
    expect(result).toEqual({ depleted: false, xp: 2, best: 5 });
  });

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

  test("lets the player decline or keep dice on a routine task through the sheet", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.stats.might.edge": 1 });
      await actor.sheet.render(true);
    }, actorId);
    await page.locator('[data-action="rollStat"][data-stat="might"]').click();
    await page.locator('input[name="rollRoutine"]').uncheck();
    await clickRollDialog(page, { difficulty: 1, effort: 1 });
    await waitForChatMessage(page, actorId);
    const automatic = await page.evaluate(id => {
      const actor = game.actors.get(id);
      const card = [...game.messages].find(message => message.getFlag("cypher", "actorId") === id);
      return { pool: actor.system.stats.might.pool.value, d20: card.getFlag("cypher", "d20"),
        rerollable: card.getFlag("cypher", "rerollable"), rollCount: card.rolls.length };
    }, actorId);
    expect(automatic).toEqual({ pool: 6, d20: null, rerollable: false, rollCount: 0 });
    await setDiceUniform(page, 0.925); // Natural 2 still succeeds on a routine task.
    await page.locator('[data-action="rollStat"][data-stat="might"]').click();
    await expect(page.locator('input[name="rollRoutine"]')).toBeChecked();
    await clickRollDialog(page, { difficulty: 0 });
    await expect.poll(() => page.evaluate(id => [...game.messages].filter(message =>
      message.getFlag("cypher", "actorId") === id).length, actorId)).toBe(2);
    const rolled = await page.evaluate(id => [...game.messages].filter(message =>
      message.getFlag("cypher", "actorId") === id).at(-1).getFlag("cypher", "d20"), actorId);
    expect(rolled).toBe(2);
  });

  test("uses matching training once and splits Effort before choosing a nineteen attack effect", async ({ e2ePage: page }) => {
    await setDiceUniform(page, 0.05); // Natural 19.
    const actorId = await createActor(page);
    const setup = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.effort": 2, "system.stats.might.edge": 1 });
      const items = await actor.createEmbeddedDocuments("Item", [
        { name: "E2E Cypher task weapon", type: "attack", system: { attackType: "medium", damage: 4,
          stat: "might", freelyUsable: true, attackSkillCategory: "mediumBladed", equipped: true } },
        { name: "E2E Cypher task training", type: "skill", system: { level: "trained", attackCategory: "mediumBladed" } }
      ]);
      await actor.sheet.render(true);
      return { weaponId: items.find(item => item.type === "attack").id, skillId: items.find(item => item.type === "skill").id };
    }, actorId);
    await page.locator(`[data-action="rollAttack"][data-item-id="${setup.weaponId}"]`).click();
    await page.locator('select[name="skillItemId"]').selectOption(setup.skillId);
    await page.locator('input[name="damageEffort"]').fill("1");
    await clickRollDialog(page, { difficulty: 4, effort: 1 });
    await page.locator('select[name="specialEffect"]').selectOption("minor");
    await page.locator('.dialog:has(select[name="specialEffect"]) button[data-action="ok"]').click();
    await waitForChatMessage(page, actorId);
    const state = await page.evaluate(id => {
      const actor = game.actors.get(id);
      const flags = [...game.messages].find(message => message.getFlag("cypher", "actorId") === id).flags.cypher;
      return { pool: actor.system.stats.might.pool.value, difficulty: flags.effectiveDifficulty,
        damage: flags.baseDamage, choice: flags.specialEffectChoice, cost: flags.effortCost };
    }, actorId);
    expect(state).toEqual({ pool: 4, difficulty: 2, damage: 7, choice: "minor", cost: 4 });
    await page.reload();
    await page.waitForFunction(() => game.ready);
    expect((await readActor(page, actorId)).might).toBe(4);
  });

  test("checks Arc Spray resources before each new action and preserves only performed attacks", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    const result = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.stats.speed.edge": 1, "system.stats.speed.pool.value": 6 });
      const items = await actor.createEmbeddedDocuments("Item", [
        { name: "E2E Cypher sequential Arc Spray", type: "ability", system: { key: "arc-spray", cost: { stat: "speed", amount: 3 } } },
        { name: "E2E Cypher sequential weapon", type: "attack", system: { stat: "speed", attackType: "medium", damage: 4,
          freelyUsable: true, mechanics: { rapidFire: true } } }
      ]);
      const targets = [];
      for (let index = 0; index < 3; index++) targets.push(await Actor.create({
        name: `E2E Cypher sequential target ${index}`, type: "npc", system: { level: 1, armor: 0, health: { value: 20, max: 20 } }
      }));
      const { executeWeaponAbility } = await import("/systems/cypher/module/applications/weapon-ability-service.mjs");
      const outcome = await executeWeaponAbility(items.find(item => item.type === "ability"), {
        weaponId: items.find(item => item.type === "attack").id, targets, allAdjacent: true, rollOptions: { effortLevels: 1 }
      });
      return { completed: outcome.completed, count: outcome.results.length, pool: actor.system.stats.speed.pool.value,
        health: targets.map(target => target.system.health.value),
        cards: [...game.messages].filter(message => message.getFlag("cypher", "actorId") === id).length };
    }, actorId);
    expect(result).toEqual({ completed: false, count: 1, pool: 1, health: [16, 20, 20], cards: 1 });
  });

  test("persists the Superheroics Pool choice and pays its pushed wound before the sheet task", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.genre": "superhero", "system.rank": 2, "system.effort": 6,
        "system.stats.might.pool.max": 32, "system.stats.might.pool.value": 32, "system.stats.might.edge": 1 });
      await actor.createEmbeddedDocuments("Item", [{ name: "E2E Cypher Superheroics", type: "ability", system: { key: "superheroics" } }]);
      await actor.sheet.render(true);
    }, actorId);
    await page.locator('select[name="flags.cypher.superheroicsStat"]').selectOption("might");
    await page.waitForFunction(id => game.actors.get(id).getFlag("cypher", "superheroicsStat") === "might", actorId);
    await page.locator('[data-action="rollStat"][data-stat="might"]').click();
    await expect(page.locator('input[name="effort"]')).toHaveAttribute("max", "8");
    await clickRollDialog(page, { difficulty: 10, effort: 7 });
    await waitForChatMessage(page, actorId);
    expect((await readActor(page, actorId)).might).toBe(18);
    await page.locator('[data-action="rollStat"][data-stat="might"]').click();
    await page.locator('input[name="push"]').check();
    await clickRollDialog(page, { difficulty: 3 });
    await expect.poll(async () => (await readActor(page, actorId)).wounds.moderate).toBe(1);
    expect((await readActor(page, actorId)).might).toBe(18);
    await page.reload();
    await page.waitForFunction(() => game.ready);
    const persisted = await page.evaluate(id => ({ chosen: game.actors.get(id).getFlag("cypher", "superheroicsStat"),
      wound: game.actors.get(id).system.wounds.moderate.current }), actorId);
    expect(persisted).toEqual({ chosen: "might", wound: 1 });
  });

  test("one-handed hindrance applies only when selected on CRD-marked weapons", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);
    const itemIds = await page.evaluate(async actorId => {
      const actor = game.actors.get(actorId);
      await actor.update({
        "system.freeWeaponCategories": ["medium"]
      });
      const items = await actor.createEmbeddedDocuments("Item", [
        {
          name: "E2E Marked Rifle",
          type: "attack",
          system: {
            attackType: "medium",
            damage: 4,
            stat: "might",
            freelyUsable: true,
            mechanics: { hinderedWhenUsedOneHanded: true }
          }
        },
        {
          name: "E2E Unmarked Weapon",
          type: "attack",
          system: {
            attackType: "medium",
            damage: 4,
            stat: "might",
            freelyUsable: true,
            mechanics: { hinderedWhenUsedOneHanded: false }
          }
        }
      ]);
      await actor.sheet.render(true);
      // Identify fixture roles from their persisted mechanics, not batch order.
      return {
        marked: items.find(item => item.system.mechanics.hinderedWhenUsedOneHanded).id,
        unmarked: items.find(item => !item.system.mechanics.hinderedWhenUsedOneHanded).id
      };
    }, actorId);

    await dismissActiveTour(page);

    const rollAndReadDifficulty = async (itemId, oneHanded) => {
      const messageCount = await page.evaluate(() => game.messages.size);
      await page.locator(
        '[data-action="rollAttack"][data-item-id="' + itemId + '"]'
      ).first().click();

      const form = page.locator("form").filter({
        has: page.locator('input[name="difficulty"]')
      }).last();
      const oneHandedInput = form.locator('input[name="oneHanded"]');

      if (oneHanded === null) {
        await expect(oneHandedInput).toHaveCount(0);
      } else {
        await expect(oneHandedInput).toBeVisible();
        if (oneHanded) await oneHandedInput.check();
      }

      await form.locator('input[name="difficulty"]').fill("2");
      await form.getByRole("button").last().click();

      await page.waitForFunction(
        ({ count, actorId }) =>
          game.messages.size > count &&
          [...game.messages].some(message =>
            message.speaker?.actor === actorId &&
            message.getFlag("cypher", "rollType") === "task"
          ),
        { count: messageCount, actorId }
      );

      return page.evaluate(actorId => {
        const message = [...game.messages].reverse().find(candidate =>
          candidate.speaker?.actor === actorId &&
          candidate.getFlag("cypher", "rollType") === "task"
        );
        return message?.getFlag("cypher", "effectiveDifficulty");
      }, actorId);
    };

    // An unmarked weapon has no one-handed control and no extra hindrance.
    expect(await rollAndReadDifficulty(itemIds.unmarked, null)).toBe(2);
    // A marked weapon is not hindered if the player leaves the option off.
    expect(await rollAndReadDifficulty(itemIds.marked, false)).toBe(2);
    // Selecting one-handed use adds exactly one hindrance step.
    expect(await rollAndReadDifficulty(itemIds.marked, true)).toBe(3);

    await page.evaluate(id => game.actors.get(id)?.sheet.close(), actorId);
  });

  test("applies extreme-range hindrance only after explicit GM adjudication", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);
    const itemId = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.freeWeaponCategories": ["medium"] });
      const [weapon] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E Range Test Rifle",
        type: "attack",
        system: {
          attackType: "medium",
          range: "long",
          extremeRange: "",
          damage: 4,
          stat: "might",
          freelyUsable: true
        }
      }]);
      await actor.sheet.render(true);
      return weapon.id;
    }, actorId);

    await dismissActiveTour(page);

    const rollAndRead = async atExtremeRange => {
      const messageCount = await page.evaluate(() => game.messages.size);
      await page.locator(
        '[data-action="rollAttack"][data-item-id="' + itemId + '"]'
      ).first().click();

      const form = page.locator("form").filter({
        has: page.locator('input[name="difficulty"]')
      }).last();
      const extremeRangeInput = form.locator('input[name="atExtremeRange"]');
      await expect(extremeRangeInput).toBeVisible();
      if (atExtremeRange) await extremeRangeInput.check();
      await form.locator('input[name="difficulty"]').fill("2");
      await form.getByRole("button").last().click();

      await page.waitForFunction(
        ({ count, actorId }) =>
          game.messages.size > count &&
          [...game.messages].some(message =>
            message.getFlag("cypher", "actorId") === actorId &&
            message.getFlag("cypher", "rollType") === "task" &&
            message.getFlag("cypher", "isAttack") === true
          ),
        { count: messageCount, actorId }
      );

      return page.evaluate(id => {
        const message = [...game.messages].reverse().find(candidate =>
          candidate.getFlag("cypher", "actorId") === id &&
          candidate.getFlag("cypher", "rollType") === "task" &&
          candidate.getFlag("cypher", "isAttack") === true
        );
        return {
          effectiveDifficulty: message?.getFlag("cypher", "effectiveDifficulty"),
          adjudication: message?.getFlag("cypher", "weaponRangeAdjudication")
        };
      }, actorId);
    };

    const normalRange = await rollAndRead(false);
    expect(normalRange.effectiveDifficulty).toBe(2);
    expect(normalRange.adjudication).toEqual({
      range: "long",
      extremeRange: null,
      atExtremeRange: false,
      hinderSteps: 0
    });

    const extremeRange = await rollAndRead(true);
    expect(extremeRange.effectiveDifficulty).toBe(3);
    expect(extremeRange.adjudication).toEqual({
      range: "long",
      extremeRange: null,
      atExtremeRange: true,
      hinderSteps: 1
    });

    await page.evaluate(id => game.actors.get(id)?.sheet.close(), actorId);
  });

  test("switches a CRD-defined alternate weapon configuration and attacks with its category", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);
    const itemId = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      const [weapon] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E Alternate Configuration Cannon",
        type: "attack",
        system: {
          attackType: "heavy",
          damage: 6,
          stat: "might",
          freelyUsable: true,
          mechanics: {
            activeConfiguration: "primary",
            alternateConfiguration: { enabled: true, attackType: "medium", action: "action" }
          }
        }
      }]);
      await actor.sheet.render(true);
      return weapon.id;
    }, actorId);

    await dismissActiveTour(page);
    const beforeSwitchMessages = await page.evaluate(() => game.messages.size);
    await page.locator('[data-item-id="' + itemId + '"] [data-action="toggleAttackConfiguration"]').first().click();
    await page.waitForFunction(({ actorId, itemId, count }) => {
      const item = game.actors.get(actorId)?.items.get(itemId);
      return item?.system.mechanics.activeConfiguration === "alternate"
        && game.messages.size > count
        && [...game.messages].some(message =>
          message.getFlag("cypher", "rollType") === "weaponConfiguration"
          && message.getFlag("cypher", "actorId") === actorId
        );
    }, { actorId, itemId, count: beforeSwitchMessages });
    const switchResult = await page.evaluate(actorId => {
      const message = [...game.messages].reverse().find(candidate =>
        candidate.getFlag("cypher", "rollType") === "weaponConfiguration"
        && candidate.getFlag("cypher", "actorId") === actorId
      );
      return { configuration: message?.getFlag("cypher", "configuration"), actionCost: message?.getFlag("cypher", "actionCost") };
    }, actorId);
    expect(switchResult).toEqual({ configuration: "alternate", actionCost: "action" });

    const messageCount = await page.evaluate(() => game.messages.size);
    await page.locator('[data-action="rollAttack"][data-item-id="' + itemId + '"]').first().click();
    await clickRollDialog(page, { difficulty: 2, effort: 0, assets: 0 });
    await page.waitForFunction(({ count, actorId }) =>
      game.messages.size > count && [...game.messages].some(message =>
        message.getFlag("cypher", "actorId") === actorId &&
        message.getFlag("cypher", "rollType") === "task" &&
        message.getFlag("cypher", "isAttack") === true
      ), { count: messageCount, actorId });

    const result = await page.evaluate(({ actorId, itemId }) => {
      const message = [...game.messages].reverse().find(candidate =>
        candidate.getFlag("cypher", "actorId") === actorId &&
        candidate.getFlag("cypher", "rollType") === "task" &&
        candidate.getFlag("cypher", "isAttack") === true
      );
      return {
        baseDamage: message?.getFlag("cypher", "baseDamage"),
        weaponSource: message?.getFlag("cypher", "weaponSource"),
        activeConfiguration: game.actors.get(actorId)?.items.get(itemId)?.system.mechanics.activeConfiguration
      };
    }, { actorId, itemId });

    expect(result.activeConfiguration).toBe("alternate");
    expect(result.baseDamage).toBe(4);
    expect(result.weaponSource).toMatchObject({
      configuration: "alternate",
      attackType: "medium",
      actionTiming: "action"
    });
    await page.evaluate(id => game.actors.get(id)?.sheet.close(), actorId);
  });

  test("executes a structured NPC Pool attack against a real PC", async ({
    e2ePage: page
  }) => {
    const pcId = await createActor(page);
    const npcId = await page.evaluate(async prefix => {
      // Create the structured attack with the Actor so Foundry validates the
      // ArrayField as part of initial DataModel construction. Updating an
      // existing empty ArrayField through Document.update has been silently
      // leaving this fixture with no attacks in the live Foundry world.
      const actor = await Actor.create({
        name: `${prefix} NPC ${Date.now()}`,
        type: "npc",
        system: {
          level: 10,
          health: { max: 30, value: 30 },
          attacks: [{
            name: "Mind Blast",
            range: "Short",
            action: "action",
            damage: {
              mode: "pool",
              amount: 4,
              severity: "minor",
              stat: "intellect",
              ignoresArmor: 0,
              wounds: 1
            },
            effects: [],
            description: ""
          }]
        }
      });

      if (!actor) {
        throw new Error(
          "Foundry did not create the E2E NPC with its structured attack"
        );
      }

      const attack = actor.system.attacks?.[0];
      if (!attack) {
        throw new Error(
          "Foundry discarded the structured attack during NPC creation: "
          + JSON.stringify({
            type: actor.type,
            model: actor.system.constructor?.name,
            attackCount: actor.system.attacks?.length ?? null,
            system: foundry.utils.deepClone(actor.system)
          })
        );
      }

      return actor.id;
    }, ACTOR_PREFIX);

    const before = await page.evaluate(id =>
      game.actors.get(id).system.stats.intellect.pool.value,
      pcId
    );

    await page.evaluate(async ({ npcId, pcId }) => {
      const npc = game.actors.get(npcId);
      const target = game.actors.get(pcId);
      if (npc.system.level !== 10) {
        throw new Error(
          `Expected NPC level 10, received ${npc.system.level}`
        );
      }

      const attack = npc.system.attacks?.[0];
      const attackDiagnostics = {
        npcType: npc.type,
        targetType: target?.type,
        attackCount: npc.system.attacks?.length ?? null,
        attack: attack ? foundry.utils.deepClone(attack) : null
      };
      if (!attack || attack.damage?.mode !== "pool"
          || attack.damage?.stat !== "intellect"
          || attack.damage?.amount !== 4) {
        throw new Error(
          "NPC structured attack was not persisted as expected: "
          + JSON.stringify(attackDiagnostics)
        );
      }

      const result = await npc.rollNpcAttack(attack, {
        target,
        defenseType: "dodge"
      });
      if (!result || result.defense.success) {
        throw new Error(
          `Expected the level-10 NPC attack to fail the PC Dodge; `
          + `inputs=${JSON.stringify(attackDiagnostics)}; `
          + `result=${JSON.stringify(result && {
            success: result.defense?.success,
            d20: result.defense?.roll?.total,
            difficulty: result.defense?.effectiveDifficulty,
            targetNumber: result.defense?.targetNumber
          })}`
        );
      }
    }, { npcId, pcId });

    const after = await page.evaluate(id =>
      game.actors.get(id).system.stats.intellect.pool.value,
      pcId
    );

    expect(after).toBe(before - 4);
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
    ).click();

    const form = page.locator("form").filter({
      has: page.locator('select[name="incomingSeverity"]')
    }).last();

    await expect(form).toBeVisible();
    await form.locator('select[name="incomingSeverity"]').selectOption("moderate");
    // CRD standard difficulty caps at ten; its target number thirty already
    // guarantees failure without supplying an invalid out-of-range difficulty.
    await form.locator('input[name="difficulty"]').fill("10");
    await form.getByRole("button").last().click();

    await page.waitForFunction(id => {
      const actor = game.actors.get(id);
      return actor?.system.wounds.moderate.current === 1;
    }, actorId);

    const actor = await readActor(page, actorId);
    expect(actor.wounds.moderate).toBe(1);
  });

  test("uses a recovery from the real PC sheet and persists the recovery marker", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({
        "system.xp": 3,
        "system.stats.might.pool.value": 0,
        "system.stats.speed.pool.value": 5,
        "system.wounds.moderate.current": 1,
        "system.recoveries.hour": false
      });
      await actor.sheet.render(true);
    }, actorId);

    await page.locator(".pc-dashboard").last().locator(
      '[data-action="rollRecovery"][data-interval="hour"]'
    ).click();

    await page.locator('input[name="completed"]').check();
    await page.locator('.dialog button[data-action="ok"]').click();
    await expect(page.locator('input[name="might"]')).toBeVisible();
    // The shared fixture fixes d6 = 3; tier one gives four points to divide.
    await page.locator('input[name="might"]').fill("2");
    await page.locator('input[name="speed"]').fill("2");
    await page.locator('.dialog:has(input[name="might"]) button[data-action="ok"]').focus();
    await page.locator('.dialog:has(input[name="might"]) button[data-action="ok"]').press("Enter");

    await waitForChatMessage(page, actorId);

    await page.waitForFunction(id => {
      return game.actors.get(id)?.system.recoveries.hour === true;
    }, actorId);

    const actor = await readActor(page, actorId);
    expect(actor.recoveries.hour).toBe(true);
    expect(actor.wounds.moderate).toBe(0);
    expect(actor.might).toBe(2);
    expect(actor.speed).toBe(7);
    await expect(page.locator('[data-action="rollRecovery"][data-interval="hour"]')).toBeDisabled();
    const rejected = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.wounds.moderate.current": 1 });
      return { rejected: (await actor.rollRecovery("hour")) === null, wounds: actor.system.wounds.moderate.current };
    }, actorId);
    expect(rejected).toEqual({ rejected: true, wounds: 1 });

    await setDiceUniform(page, 0.05); // New total seven adds three points to the retained four.
    const messageId = await page.evaluate(async id => {
      await game.actors.get(id).sheet.close();
      ui.sidebar.changeTab("chat", "primary"); ui.sidebar.expand();
      return [...game.messages].find(message => message.getFlag("cypher", "actorId") === id
        && message.getFlag("cypher", "rollType") === "recovery").id;
    }, actorId);
    await page.locator(`#chat .chat-log [data-message-id="${messageId}"] .cypher-reroll-button`).click();
    const allocation = page.locator('.dialog:has(input[name="might"])');
    await allocation.locator('input[name="might"]').fill("2");
    await allocation.locator('input[name="speed"]').fill("1");
    await allocation.locator('button[data-action="ok"]').click();
    await expect.poll(async () => (await readActor(page, actorId)).might).toBe(4);
    const rerolled = await readActor(page, actorId);
    expect(rerolled.speed).toBe(8);
    expect(rerolled.xp).toBe(2);
    expect(rerolled.wounds.moderate).toBe(1);
    expect(rerolled.recoveries.hour).toBe(true);
  });

  test("completes long rest in any order, resets extra recoveries, and heals a major wound with its Might task", async ({ e2ePage: page }) => {
    await setDiceUniform(page, 0.05); // d6 = 6, d20 = 19; no automatic refund.
    const actorId = await createActor(page);
    const result = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      const untamed = (await game.packs.get("cypher.abilities-en").getDocuments()).find(item => item.system.key === "untamed-recovery");
      await Item.create(untamed.toObject(), { parent: actor });
      await actor.rollRecovery("action");
      await actor.rollRecovery("action", { source: "untamed-recovery" });
      const extraRejected = (await actor.rollRecovery("action", { source: "untamed-recovery" })) === null;
      await actor.update({ "system.stats.might.pool.value": 0, "system.wounds.minor.current": 2,
        "system.wounds.moderate.current": 0, "system.wounds.major.current": 1 });
      // Recovered Might funds Effort, offsetting this major wound's hindrance.
      await actor.rollRecovery("tenHours", { woundChoice: "minor", healMajor: true, majorTaskOptions: { effortLevels: 1 } });
      const reset = { ...actor.system.recoveries };
      const wounds = { minor: actor.system.wounds.minor.current, major: actor.system.wounds.major.current };
      const extraAvailable = Boolean(await actor.rollRecovery("action", { source: "untamed-recovery" }));
      await actor.rollRecovery("hour");
      return { extraRejected, reset, wounds, extraAvailable, hourUsed: actor.system.recoveries.hour };
    }, actorId);
    expect(result).toEqual({ extraRejected: true, reset: { action: false, tenMinutes: false, hour: false, tenHours: false },
      wounds: { minor: 0, major: 0 }, extraAvailable: true, hourUsed: true });
  });

  test("treats a minor wound through the sheet after confirmed time and task choices", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.wounds.minor.current": 1 });
      await actor.sheet.render(true);
    }, actorId);
    await page.locator('[data-action="treatWound"][data-severity="minor"]').click();
    await page.locator('input[name="completed"]').check();
    await page.locator('.dialog button[data-action="ok"]').click();
    await expect(page.locator('input[name="difficulty"]')).toHaveValue("0");
    await page.locator('.dialog:has(input[name="difficulty"]) button[data-action="ok"]').click();
    await expect.poll(async () => (await readActor(page, actorId)).wounds.minor).toBe(0);
    expect((await readActor(page, actorId)).might).toBe(8);
  });

  test("uses Healing Hand from its CRD card, charges escalation and persists a changed wound after reopening", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    const itemId = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      const source = (await game.packs.get("cypher.abilities-en").getDocuments()).find(item => item.system.key === "healing-hand");
      const item = await Item.create(source.toObject(), { parent: actor });
      await actor.update({ "system.wounds.moderate.current": 1 });
      await actor.sheet.render(true);
      return item.id;
    }, actorId);
    for (const severity of ["moderate", "minor"]) {
      await page.locator(`[data-item-id="${itemId}"] [data-action="useHealingHand"]`).click();
      await page.locator('select[name="severity"]').selectOption(severity);
      await page.locator('input[name="touchConfirmed"]').check();
      await page.locator('.dialog button[data-action="ok"]').click();
      await expect.poll(async () => (await readActor(page, actorId)).wounds[severity]).toBe(0);
      await expect(page.locator('input[name="touchConfirmed"]')).toHaveCount(0);
    }
    expect((await readActor(page, actorId)).intellect).toBe(5);
    await page.evaluate(async id => {
      const actor = game.actors.get(id); await actor.sheet.close(); await actor.sheet.render(true);
    }, actorId);
    await expect(page.locator('input[name="system.wounds.minor.current"]')).toHaveValue("0");
    await expect(page.locator('input[name="system.wounds.moderate.current"]')).toHaveValue("0");
  });

  test("rallies a moderate wound from the real PC sheet and charges Might", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({
        "system.stats.might.pool.value": 6,
        "system.wounds.moderate.current": 1
      });
      await actor.sheet.render(true);
    }, actorId);

    await page.locator(".pc-dashboard").last().locator(
      '[data-action="rallyWound"][data-severity="moderate"]'
    ).click();

    await page.waitForFunction(id => {
      const actor = game.actors.get(id);
      return actor?.system.wounds.moderate.current === 0;
    }, actorId);

    const actor = await readActor(page, actorId);
    expect(actor.might).toBe(1);
    expect(actor.wounds.moderate).toBe(0);
  });

  test("rallies a major superhero wound from the sheet for ten Might without Edge reduction", async ({ e2ePage: page }) => {
    const actorId = await createActor(page, { system: { genre: "superhero",
      stats: { might: { pool: { max: 12, value: 12 }, edge: 5 } } } });
    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.addWound("major");
      await actor.sheet.render(true);
    }, actorId);
    await page.locator('[data-action="rallyWound"][data-severity="major"]').click();
    await expect.poll(async () => (await readActor(page, actorId)).wounds.major).toBe(0);
    expect((await readActor(page, actorId)).might).toBe(2);
    expect(await page.evaluate(id => game.actors.get(id).statuses.has("hindered"), actorId)).toBe(false);
  });

  test("renders recovery and healing dialogs in both locales and themes at a narrow sheet width", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    const originalViewport = page.viewportSize();
    const original = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      const source = (await game.packs.get("cypher.abilities-en").getDocuments()).find(item => item.system.key === "healing-hand");
      await Item.create(source.toObject(), { parent: actor });
      await actor.update({ "system.stats.might.pool.value": 3, "system.wounds.minor.current": 1 });
      // V14 groups color preferences in uiConfig; V13 stores colorScheme directly.
      const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
      return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
    }, actorId);
    const before = await readActor(page, actorId);
    try {
      await page.setViewportSize({ width: 1024, height: 768 });
      for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
        const labels = await page.evaluate(async ({ id, language, theme, original }) => {
          await game.i18n.setLanguage(language);
          const colorScheme = { applications: theme, interface: theme };
          await game.settings.set("core", original.setting, original.setting === "uiConfig"
            ? { ...original.config, colorScheme } : colorScheme);
          const actor = game.actors.get(id);
          if (actor.sheet.rendered) await actor.sheet.close();
          await actor.sheet.render(true);
          actor.sheet.setPosition({ width: 640, height: 700, left: 0, top: 0 });
          return Object.fromEntries(["Roll.Recovery", "Healing.Treatment", "Healing.Apply", "Recovery.Apply", "Stat.might", "Roll.RollRoutine", "Roll.FreeEffort"]
            .map(key => [key, game.i18n.localize(`CYPHER.${key}`)]));
        }, { id: actorId, language, theme, original });
        const sheet = page.locator(".cypher.sheet.actor");
        // With no per-document override, ApplicationV2 inherits the body theme.
        await expect(page.locator("body")).toHaveClass(new RegExp(`theme-${theme}`));
        await expect(sheet.locator('[data-action="rollRecovery"][data-interval="hour"]')).toHaveAttribute("title", labels["Roll.Recovery"]);
        await expect(sheet.locator('[data-action="treatWound"][data-severity="minor"]')).toContainText(labels["Healing.Treatment"]);
        await expect(sheet.locator('[data-action="useHealingHand"]')).toContainText(labels["Healing.Apply"]);
        await sheet.locator('[data-action="rollRecovery"][data-interval="hour"]').click();
        await page.locator('input[name="completed"]').check();
        await page.locator('input[name="completed"]').press("Enter");
        const allocation = page.locator('.dialog:has(input[name="might"])');
        await expect(allocation.getByLabel(labels["Stat.might"], { exact: true })).toHaveValue("4");
        await expect(allocation.getByRole("button", { name: labels["Recovery.Apply"], exact: true })).toBeVisible();
        expect(await allocation.locator(".window-content").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        // Optional local screenshots stay in the caller's ignored reports directory.
        if (process.env.CYPHER_E2E_UI_CAPTURE_DIR) await page.screenshot({
          path: `${process.env.CYPHER_E2E_UI_CAPTURE_DIR}/recovery-${language}-${theme}.png`
        });
        await allocation.press("Escape");
        await expect(allocation).toHaveCount(0);
        for (const action of ["treatWound", "useHealingHand"]) {
          await sheet.locator(`[data-action="${action}"]${action === "treatWound" ? '[data-severity="minor"]' : ""}`).click();
          const dialog = page.locator('.dialog:has(select[name="target"])');
          await expect(dialog).toBeVisible();
          expect(await dialog.locator(".window-content").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
          await dialog.press("Escape");
          await expect(dialog).toHaveCount(0);
        }
        await sheet.locator('[data-action="rollStat"][data-stat="might"]').click();
        const task = page.locator('.dialog:has(input[name="freeEffort"])');
        await expect(task.getByLabel(labels["Roll.RollRoutine"], { exact: true })).toBeChecked();
        await task.getByLabel(labels["Roll.RollRoutine"], { exact: true }).press("Space");
        await expect(task.getByLabel(labels["Roll.RollRoutine"], { exact: true })).not.toBeChecked();
        await task.locator("summary").click();
        await task.getByLabel(labels["Roll.FreeEffort"], { exact: true }).fill("1");
        await task.locator('[name="freeEffortSource"]').fill("Confirmed CRD grant");
        expect(await task.locator(".window-content").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        await task.press("Escape");
        await expect(task).toHaveCount(0);
        expect(await readActor(page, actorId)).toEqual(before);
      }
    } finally {
      await page.evaluate(async original => {
        await game.settings.set("core", original.setting, original.config);
        await game.i18n.setLanguage(original.language);
      }, original);
      if (originalViewport) await page.setViewportSize(originalViewport);
    }
  });

  test("rerolls recovery and treatment from older chat cards without replaying persisted healing", async ({ e2ePage: page }) => {
    const actorId = await createActor(page);
    const result = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      const { treatWound } = await import("/systems/cypher/module/applications/healing-service.mjs");
      const lastCard = kind => [...game.messages].filter(message =>
        message.getFlag("cypher", "actorId") === id && message.getFlag("cypher", "rollType") === kind).at(-1);
      await actor.update({ "system.xp": 8, "system.stats.might.pool.value": 0 });
      await actor.rollRecovery("hour"); // Deterministic d6 = 3, total = 4.
      const recovery = lastCard("recovery");
      CONFIG.Dice.randomUniform = () => 0.375; // Total = 5; add one point.
      await actor.rerollMessage(recovery);
      const olderRecovery = lastCard("recovery");
      CONFIG.Dice.randomUniform = () => 0.05; // Total = 7; add two points.
      await actor.rerollMessage(recovery);
      CONFIG.Dice.randomUniform = () => 0.3; // Total = 6; older card still retains seven.
      await actor.rerollMessage(olderRecovery);
      const retainedRecovery = lastCard("recovery").getFlag("cypher", "originalRoll");
      await actor.update({ "system.wounds.moderate.max": 3, "system.wounds.moderate.current": 2 });
      CONFIG.Dice.randomUniform = () => 0.975; // d20 = 1; treatment fails.
      await treatWound(actor, { severity: "moderate", completed: true });
      const treatment = lastCard("task");
      CONFIG.Dice.randomUniform = () => 0.925; // d20 = 2; first paid reroll still fails.
      await actor.rerollMessage(treatment);
      const olderTreatment = lastCard("task");
      CONFIG.Dice.randomUniform = () => 0.05; // d20 = 19; removes one wound.
      await actor.rerollMessage(treatment);
      CONFIG.Dice.randomUniform = () => 0.025; // d20 = 20; cannot remove another wound.
      await actor.rerollMessage(olderTreatment);
      return { retainedRecovery, might: actor.system.stats.might.pool.value, xp: actor.system.xp,
        moderate: actor.system.wounds.moderate.current, hourUsed: actor.system.recoveries.hour };
    }, actorId);
    expect(result).toEqual({ retainedRecovery: 7, might: 7, xp: 2, moderate: 1, hourUsed: true });
  });

  test("purchases an Effort advancement through the real Actor document", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    const before = await readActor(page, actorId);
    expect(before.advancement[0].bought).toBe(false);

    const result = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({
        "system.xp": 4,
        "system.effort": 1,
        "system.advancementSlots.0.type": "effort"
      });
      await actor.purchaseAdvancementSlot(0);
      return {
        xp: actor.system.xp,
        effort: actor.system.effort,
        bought: actor.system.advancementSlots[0].bought
      };
    }, actorId);

    expect(result.xp).toBe(0);
    expect(result.effort).toBe(2);
    expect(result.bought).toBe(true);
  });

  test("applies a player intrusion through the real Actor document and persists XP", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    const result = await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({ "system.xp": 2 });
      const request = await actor.usePlayerIntrusion("E2E intrusion");
      if (actor.system.xp !== 2) throw Error("Pending intrusion spent XP before acceptance");
      await game.cypher.intrusions.resolvePlayerIntrusion(request);
      return {
        xp: actor.system.xp,
        messageCount: game.messages.size
      };
    }, actorId);

    expect(result.xp).toBe(1);
    expect(result.messageCount).toBeGreaterThan(0);

    await page.waitForFunction(id => {
      return [...game.messages].some(message =>
        message.speaker?.actor === id
      );
    }, actorId);
  });

  test("creates real armor, shield, and attack Items with their DataModels", async ({
    e2ePage: page
  }) => {
    const result = await page.evaluate(async () => {
      const actor = await Actor.create({
        name: `${"E2E Cypher"} Item DataModels ${Date.now()}`,
        type: "pc"
      });

      const [armor] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E Armor",
        type: "armor",
        system: { category: "light", equipped: true }
      }]);
      const [shield] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E Shield",
        type: "shield",
        system: { equipped: true }
      }]);
      const [attack] = await actor.createEmbeddedDocuments("Item", [{
        name: "E2E Attack",
        type: "attack",
        system: { damage: 4, stat: "might", equipped: true }
      }]);

      const data = {
        actorId: actor.id,
        armor: {
          type: armor.type,
          equipped: armor.system.equipped,
          category: armor.system.category
        },
        shield: {
          type: shield.type,
          equipped: shield.system.equipped,
          minorMax: shield.system.wounds.minor.max,
          moderateMax: shield.system.wounds.moderate.max
        },
        attack: {
          type: attack.type,
          damage: attack.system.damage,
          stat: attack.system.stat
        }
      };

      return data;
    });

    expect(result.armor).toEqual({
      type: "armor",
      equipped: true,
      category: "light"
    });
    expect(result.shield).toMatchObject({
      type: "shield",
      equipped: true,
      minorMax: 3,
      moderateMax: 2
    });
    expect(result.attack).toMatchObject({
      type: "attack",
      damage: 4,
      stat: "might"
    });
  });

  test("resolves structured weapon target effects against a real NPC", async ({
    e2ePage: page
  }) => {
    const result = await page.evaluate(async () => {
      const pc = await Actor.create({
        name: `E2E Weapon PC ${Date.now()}`,
        type: "pc",
        system: {
          stats: {
            might: { pool: { max: 8, value: 8 }, edge: 0 },
            speed: { pool: { max: 8, value: 8 }, edge: 0 },
            intellect: { pool: { max: 8, value: 8 }, edge: 0 }
          }
        }
      });
      const npc = await Actor.create({
        name: `E2E Weapon NPC ${Date.now()}`,
        type: "npc",
        system: { level: 2 }
      });

      try {
        const pack = game.packs.get("cypher.equipment-en");
        const stunstick = (await pack.getDocuments())
          .find(item => item.name === "Stunstick");

        if (!stunstick) throw new Error("Stunstick not found in equipment-en");

        const attack = await Item.create(stunstick.toObject(), { parent: pc });
        const attackResult = await attack.rollAttack({ difficulty: 0, target: npc });

        const message = [...game.messages]
          .reverse()
          .find(entry => entry.getFlag("cypher", "rollType") === "task");

        const activeEffects = foundry.utils.deepClone(
          npc.flags.cypher?.activeWeaponEffects ?? []
        );
        const blockedAttack = await npc.rollNpcAttack({
          name: "E2E follow-up",
          damage: { mode: "pool", amount: 1, stat: "might" }
        }, { target: pc, defenseType: "dodge" });
        const remainingEffects = foundry.utils.deepClone(
          npc.flags.cypher?.activeWeaponEffects ?? []
        );

        return {
          targetLevel: npc.system.level,
          attackSucceeded: attackResult?.success,
          targetEffects: message?.getFlag("cypher", "weaponTargetEffects"),
          activeEffects,
          blockedAttack: blockedAttack === null,
          remainingEffects
        };
      } finally {
        await npc.delete();
        await pc.delete();
      }
    });

    expect(result.targetLevel).toBe(2);
    expect(result.attackSucceeded).toBe(true);
    expect(result.targetEffects).toEqual([{
      minimumTargetLevel: 0,
      maximumTargetLevel: 2,
      effect: "loseNextAction",
      hinderSteps: 0,
      duration: "next action"
    }]);
    expect(result.activeEffects).toHaveLength(1);
    expect(result.activeEffects[0].effect).toBe("loseNextAction");
    expect(result.activeEffects[0].sourceItemName).toBe("Stunstick");
    expect(result.blockedAttack).toBe(true);
    expect(result.remainingEffects).toEqual([]);
  });


  test("defaults Stunstick to one round and persists the GM's optional second round from the NPC sheet", async ({ e2ePage: page }) => {
    const setup = await page.evaluate(async prefix => {
      const pc = await Actor.create({ name: `${prefix} Stunstick PC`, type: "pc" });
      const npc = await Actor.create({ name: `${prefix} Stunstick target`, type: "npc", system: { level: 3, health: { value: 20, max: 20 } } });
      // Create the real Combat before advancing its clock. Creating directly
      // at round four bypasses Foundry's previous-turn initialization.
      const combat = await foundry.documents.Combat.create({ active: true, flags: { cypher: { e2eOwned: true } } });
      await combat.activate();
      await combat.update({ round: 4 });
      const stunstick = (await game.packs.get("cypher.equipment-en").getDocuments()).find(item => item.name === "Stunstick");
      if (!stunstick) throw new Error("CRD Stunstick fixture is missing");
      const attack = await Item.create(stunstick.toObject(), { parent: pc });
      const result = await attack.rollAttack({ target: npc, difficulty: 0 });
      await attack.rollAttack({ target: npc, difficulty: 0 });
      await npc.sheet.render(true);
      return { npcId: npc.id, pcId: pc.id, attackId: attack.id, combatId: combat.id, activeCombatId: game.combat?.id,
        success: result.success, health: npc.system.health.value,
        effects: foundry.utils.deepClone(npc.flags.cypher.activeWeaponEffects) };
    }, ACTOR_PREFIX);
    expect(setup.activeCombatId).toBe(setup.combatId);
    expect(setup.success).toBe(true);
    expect(setup.health).toBe(20);
    expect(setup.effects).toHaveLength(1);
    expect(setup.effects[0].duration).toBe("a round or two");
    expect(setup.effects[0].roundCount).toBe(1);
    expect(setup.effects[0].hinderSteps).toBe(2);
    const extend = page.locator('[data-action="extendWeaponEffect"]');
    await expect(extend).toBeVisible();
    // A native button must support keyboard activation too.
    await extend.focus();
    await extend.press("Enter");
    await expect.poll(() => page.evaluate(id => game.actors.get(id).flags.cypher.activeWeaponEffects[0].roundCount, setup.npcId)).toBe(2);
    await expect(extend).toHaveCount(0);
    await page.evaluate(async ({ npcId, combatId }) => {
      const npc = game.actors.get(npcId);
      await npc.sheet.close();
      await game.combats.get(combatId).update({ round: 5 });
      await npc.sheet.render(true);
    }, setup);
    await expect(page.locator(".npc-weapon-effects")).toBeVisible();
    expect(await page.evaluate(id => game.actors.get(id).flags.cypher.activeWeaponEffects[0].roundCount, setup.npcId)).toBe(2);
    const repeated = await page.evaluate(async ({ pcId, attackId, npcId }) => {
      const npc = game.actors.get(npcId);
      await game.actors.get(pcId).items.get(attackId).rollAttack({ target: npc, difficulty: 0 });
      return { effects: foundry.utils.deepClone(npc.flags.cypher.activeWeaponEffects), health: npc.system.health.value };
    }, setup);
    expect(repeated.effects).toHaveLength(1);
    expect(repeated.effects[0].hinderSteps).toBe(2);
    expect(repeated.effects[0].roundCount).toBe(2);
    expect(repeated.health).toBe(20);
    await expect(extend).toHaveCount(0);
    await page.evaluate(async ({ combatId }) => {
      await game.combats.get(combatId).update({ round: 6 });
    }, setup);
    await expect(page.locator(".npc-weapon-effects")).toHaveCount(0);
  });

  test("persists successful weapon damage to a targeted NPC Health value", async ({
    e2ePage: page
  }) => {
    const result = await page.evaluate(async () => {
      const pc = await Actor.create({
        name: `E2E Damage PC ${Date.now()}`,
        type: "pc",
        system: {
          stats: {
            might: { pool: { max: 8, value: 8 }, edge: 0 },
            speed: { pool: { max: 8, value: 8 }, edge: 0 },
            intellect: { pool: { max: 8, value: 8 }, edge: 0 }
          }
        }
      });
      const npc = await Actor.create({
        name: `E2E Damage NPC ${Date.now()}`,
        type: "npc",
        system: {
          level: 3,
          armor: 4,
          health: { max: 10, value: 10 }
        }
      });

      try {
        const [attack] = await pc.createEmbeddedDocuments("Item", [{
          name: "E2E Armor Piercer",
          type: "attack",
          system: {
            attackType: "heavy",
            damage: 6,
            stat: "might",
            freelyUsable: true,
            mechanics: {
              twoHanded: false,
              rapidFire: false,
              ignoresPhysicalArmor: 2,
              cutsThroughMaterialsLevel: null,
              targetEffects: [],
              requiresTripod: false,
              requiredOperators: 0,
              alternateConfiguration: {
                enabled: false,
                attackType: "",
                action: ""
              }
            }
          }
        }]);

        const armorBypass = attack.system.mechanics.ignoresPhysicalArmor;
        if (armorBypass !== 2) {
          throw new Error(
            `Expected persisted Armor bypass 2, received ${armorBypass}`
          );
        }

        await attack.rollAttack({ difficulty: 0, target: npc });

        await new Promise(resolve => setTimeout(resolve, 100));

        const message = [...game.messages]
          .reverse()
          .find(entry => entry.getFlag("cypher", "actorId") === pc.id
            && entry.getFlag("cypher", "isAttack") === true);

        return {
          health: npc.system.health.value,
          armor: npc.system.armor,
          armorBypass: message?.getFlag("cypher", "armorBypass") ?? null,
          baseDamage: message?.getFlag("cypher", "baseDamage") ?? null,
          targetActorId: message?.getFlag("cypher", "targetActorId") ?? null
        };
      } finally {
        await npc.delete();
        await pc.delete();
      }
    });

    expect(result.armor).toBe(4);
    expect(result.armorBypass).toBe(2);
    expect(result.baseDamage).toBe(6);
    expect(result.targetActorId).toBeTruthy();
    expect(result.health).toBe(6);
  });

  for (const kind of ["spray", "arc-spray"]) {
    test(`executes ${kind} from the PC sheet with persisted target damage`, async ({ e2ePage: page }) => {
      // Spray needs d6 = 5; this input also gives d20 = 16 without special damage.
      await setDiceUniform(page, 0.225);
      await closeActorSheet(page);
      const actorId = await createActor(page);
      const setup = await page.evaluate(async ({ actorId, kind, prefix }) => {
        const actor = game.actors.get(actorId);
        const created = await actor.createEmbeddedDocuments("Item", [
          { name: `E2E ${kind}`, type: "ability", system: {
            key: kind, cost: { stat: "speed", amount: kind === "spray" ? 2 : 3 }
          } },
          { name: "E2E rapid-fire weapon", type: "attack", system: {
            attackType: "medium", damage: 4, stat: "speed", freelyUsable: true,
            mechanics: { rapidFire: true }, availableUses: 2
          } }
        ]);
        // Replay the valid return order observed in the failed trace: weapon
        // before Ability. Fixture roles must not depend on batch positions.
        created.sort((left, right) => Number(right.type === "attack") - Number(left.type === "attack"));
        const ability = created.find(item => item.type === "ability" && item.system.key === kind);
        const weapon = created.find(item => item.type === "attack");
        if (!ability || !weapon) {
          throw new Error("Weapon Ability fixture is missing its Ability or attack Item");
        }
        const targets = [];
        for (let index = 0; index < 3; index += 1) {
          targets.push(await Actor.create({ name: `${prefix} ${kind} target ${index}`, type: "npc",
            system: { level: 1, health: { value: 20, max: 20 }, armor: 0 } }));
        }
        await actor.sheet.render(true);
        return { abilityId: ability.id, weaponId: weapon.id, targetIds: targets.map(target => target.id) };
      }, { actorId, kind, prefix: ACTOR_PREFIX });
      // The shared afterEach fixture owns Actor cleanup, including failures.
      // A closed-page error in a local finally must not replace the UI failure.
      await dismissActiveTour(page);
      const abilityButton = page.locator(`[data-item-id="${setup.abilityId}"] [data-action="useWeaponAbility"]`);
      await expect(abilityButton).toBeVisible();
      await abilityButton.click();
      const selection = page.locator("form").filter({ has: page.locator('select[name="weaponId"]') }).last();
      await expect(selection).toBeVisible();
      await selection.locator('[name="weaponId"]').selectOption(setup.weaponId);
      for (let index = 0; index < (kind === "spray" ? 1 : 3); index += 1) {
        await selection.locator(`[name="target${index}"]`).selectOption(setup.targetIds[index]);
      }
      if (kind === "arc-spray") await selection.locator('[name="confirmed"]').check();
      await selection.getByRole("button").last().click();
      for (let index = 0; index < (kind === "spray" ? 1 : 3); index++) await clickRollDialog(page);
      await expect.poll(() => page.evaluate(({ actorId, kind }) => [...game.messages].filter(message =>
        message.getFlag("cypher", "actorId") === actorId
        && message.getFlag("cypher", "rollType") === "task"
        && message.getFlag("cypher", "abilitySource")?.kind === kind).length,
      { actorId, kind })).toBe(kind === "spray" ? 1 : 3);
      await expect.poll(() => page.evaluate(ids => ids.map(id => game.actors.get(id).system.health.value), setup.targetIds))
        .toEqual(kind === "spray" ? [17, 20, 20] : [16, 16, 16]);
      const state = await page.evaluate(({ actorId, weaponId, kind }) => {
        const actor = game.actors.get(actorId);
        return { speed: actor.system.stats.speed.pool.value,
          uses: actor.items.get(weaponId).system.availableUses,
          difficulties: [...game.messages].filter(message => message.getFlag("cypher", "actorId") === actorId
            && message.getFlag("cypher", "rollType") === "task"
            && message.getFlag("cypher", "abilitySource")?.kind === kind)
            .map(message => message.getFlag("cypher", "effectiveDifficulty")) };
      }, { actorId, weaponId: setup.weaponId, kind });
      expect(state.speed).toBe(kind === "spray" ? 6 : 5);
      expect(state.uses).toBe(kind === "spray" ? 0 : 2);
      expect(state.difficulties).toEqual(kind === "spray" ? [0] : [2, 2, 2]);
    });
  }

  test("persists actor state after the sheet is closed and reopened", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      await actor.update({
        "system.xp": 7,
        "system.stats.might.pool.value": 4,
        "system.wounds.minor.current": 1
      });
      await actor.sheet.render(true);
    }, actorId);

    await page.evaluate(id => game.actors.get(id).sheet.close(), actorId);
    await page.reload();
    await waitForFoundryReady(page);

    await page.evaluate(id => game.actors.get(id).sheet.render(true), actorId);

    const actor = await readActor(page, actorId);
    expect(actor.xp).toBe(7);
    expect(actor.might).toBe(4);
    expect(actor.wounds.minor).toBe(1);
  });
});


test("completes a player vertical slice from real CRD compendiums", async ({
  e2ePage: page
}) => {
  const actorId = await createActor(page);

  try {
    const summary = await page.evaluate(async id => {
      const getPack = name => {
        const pack = game.packs.get("cypher." + name);
        if (!pack) throw new Error("Missing compendium pack: " + name);
        return pack;
      };

      const type = (await getPack("types-en").getDocuments())
        .find(item => item.type === "type");
      const descriptors = await getPack("descriptors-en").getDocuments();
      const descriptor = descriptors.find(item =>
        item.type === "descriptor"
        && (!item.system.genres?.length
          || item.system.genres.map(value => String(value).toLowerCase())
            .includes("fantasy"))
      );
      const focus = (await getPack("foci-en").getDocuments())
        .find(item => item.type === "focus");
      const equipment = await getPack("equipment-en").getDocuments();
      const attackSource = equipment.find(item => item.type === "attack");
      const cypherSource = equipment.find(item =>
        item.type === "cypher"
        && item.system.cypherCategory !== "powerBoost"
      );

      if (!type || !descriptor || !focus || !attackSource || !cypherSource) {
        throw new Error("Player vertical slice could not find the required CRD content");
      }

      const actor = game.actors.get(id);
      const typeSkill = type.system.skillOptions?.find(value => value?.trim());
      await actor.applyType(type, {
        stat: type.system.statOptions?.[0] ?? "might",
        skillName: typeSkill
      });

      const descriptorSkill =
        descriptor.system.skillOptions?.find(value => value?.trim())
        ?? descriptor.system.grantedSkills?.[0];
      await actor.applyDescriptor(descriptor, {
        stat: descriptor.system.statOptions?.[0] ?? "might",
        skillName: descriptorSkill
      });

      const { getInitialFocusAbilityChoices } =
        await import("/systems/cypher/module/applications/content-service.mjs");
      const focusChoices = await getInitialFocusAbilityChoices(focus);
      if (focusChoices.length < 2) {
        throw new Error("Selected Focus does not expose two eligible Tier 1 choices");
      }
      await actor.applyFocus(
        focus,
        focusChoices.slice(0, 2).map(ability => ability.id)
      );

      const [attack] = await actor.createEmbeddedDocuments("Item", [attackSource.toObject()]);
      const [cypher] = await actor.createEmbeddedDocuments("Item", [cypherSource.toObject()]);
      if (!attack || !cypher) {
        throw new Error(
          "Player vertical slice failed to create the CRD Attack or Cypher item"
        );
      }
      await attack.rollAttack({ difficulty: 0 });
      const { rollCypherTable, useCypher } =
        await import("/systems/cypher/module/applications/item-service.mjs");
      await useCypher(cypher);

      const cypherTableSource = cypherSource.toObject();
      delete cypherTableSource._id;
      cypherTableSource.name = "E2E Cypher Table";
      cypherTableSource.system.depleted = false;
      cypherTableSource.system.rollTables = [{
        id: "e2e-cypher-table",
        name: "E2E Cypher Table",
        formula: "1d100",
        results: [{
          min: 1,
          max: 100,
          description: "E2E Cypher table result"
        }]
      }];
      const [tableCypher] = await actor.createEmbeddedDocuments("Item", [
        cypherTableSource
      ]);
      const messageCountBeforeCypherTable = game.messages.size;
      if (!(await rollCypherTable(tableCypher, "e2e-cypher-table"))) {
        throw new Error("Structured Cypher table could not be used");
      }
      if (game.messages.size <= messageCountBeforeCypherTable) {
        throw new Error("Cypher table use did not create chat output");
      }

      const cypherVariantSource = cypherSource.toObject();
      delete cypherVariantSource._id;
      cypherVariantSource.name = "E2E Cypher Variant";
      cypherVariantSource.system.depleted = false;
      cypherVariantSource.system.variants = [{
        name: "E2E Variant",
        powerLevel: "advanced",
        rollMin: 1,
        rollMax: 100
      }];
      const [variantCypher] = await actor.createEmbeddedDocuments("Item", [
        cypherVariantSource
      ]);
      const { rollCypherVariant } =
        await import("/systems/cypher/module/applications/item-service.mjs");
      const messageCountBeforeVariant = game.messages.size;
      if (!(await rollCypherVariant(variantCypher))) {
        throw new Error("Structured Cypher variant could not be resolved");
      }
      if (game.messages.size <= messageCountBeforeVariant) {
        throw new Error("Cypher variant resolution did not create chat output");
      }
      if (!variantCypher.system.depleted) {
        throw new Error("Cypher variant resolution did not deplete the Cypher");
      }

      const abilityPack = getPack("abilities-en");
      const abilities = await abilityPack.getDocuments();
      const tableAbilitySource = abilities.find(item =>
        item.type === "ability" && item.system.rollTables?.length
      );
      if (!tableAbilitySource) {
        throw new Error("Player vertical slice could not find an Ability with a structured table");
      }
      const [tableAbility] = await actor.createEmbeddedDocuments("Item", [
        tableAbilitySource.toObject()
      ]);
      const { rollAbilityTable } =
        await import("/systems/cypher/module/applications/ability-service.mjs");
      const messageCountBeforeAbility = game.messages.size;
      const tableId = tableAbility.system.rollTables[0].id;
      if (!(await rollAbilityTable(tableAbility, tableId))) {
        throw new Error("Structured Ability table could not be used");
      }
      if (game.messages.size <= messageCountBeforeAbility) {
        throw new Error("Ability table use did not create chat output");
      }

      await actor.addWound("moderate");
      await actor.rollRecovery("hour");

      await actor.update({
        "system.xp": 5,
        "system.advancementSlots.0.type": "effort",
        "system.advancementSlots.0.bought": false
      });
      const intrusionRequest = await actor.usePlayerIntrusion("Alpha vertical-slice intrusion");
      await game.cypher.intrusions.resolvePlayerIntrusion(intrusionRequest);
      const xpAfterIntrusion = actor.system.xp;
      await actor.purchaseAdvancementSlot(0);

      return {
        type: actor.system.type,
        descriptor: actor.system.descriptor,
        focus: actor.system.focus,
        tier: actor.system.tier,
        hasSkill: actor.items.some(item => item.type === "skill"),
        abilityCount: actor.items.filter(item => item.type === "ability").length,
        attackType: attack.type,
        cypherDepleted: cypher.system.depleted,
        cypherTableDepleted: tableCypher.system.depleted,
        cypherTableUsed: tableCypher.name,
        abilityTableUsed: tableAbility.name,
        moderateWounds: actor.system.wounds.moderate.current,
        xpAfterIntrusion,
        xp: actor.system.xp,
        advancementBought: actor.system.advancementSlots[0].bought,
        effort: actor.system.effort,
        resourcePoints: actor.system.resourcePoints
      };
    }, actorId);

    expect(summary.type).toBeTruthy();
    expect(summary.focus).toBeTruthy();
    expect(summary.hasSkill).toBe(true);
    expect(summary.abilityCount).toBeGreaterThan(0);
    expect(summary.attackType).toBe("attack");
    expect(summary.cypherDepleted).toBe(true);
    expect(summary.cypherTableDepleted).toBe(true);
    expect(summary.cypherTableUsed).toBe("E2E Cypher Table");
    expect(summary.abilityTableUsed).toBeTruthy();
    expect(summary.moderateWounds).toBe(0);
    expect(summary.xpAfterIntrusion).toBe(4);
    expect(summary.xp).toBe(0);
    expect(summary.advancementBought).toBe(true);
    expect(summary.effort).toBeGreaterThan(1);
    expect(summary.resourcePoints).toBe(1);
  } finally {
    await page.evaluate(async id => {
      const actor = game.actors.get(id);
      if (actor) await actor.delete();
    }, actorId);
  }
});
