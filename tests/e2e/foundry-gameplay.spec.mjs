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

  test("executes a structured NPC Pool attack against a real PC", async ({
    e2ePage: page
  }) => {
    const pcId = await createActor(page);
    const npcId = await page.evaluate(async prefix => {
      // Start from the NPC model defaults, then persist the structured attack
      // through the real Actor document update path. This keeps the fixture
      // aligned with Foundry's registered DataModel validation.
      const actor = await Actor.create({
        name: `${prefix} NPC ${Date.now()}`,
        type: "npc",
        system: { level: 10 }
      });

      if (!actor) {
        throw new Error("Foundry did not create the minimal E2E NPC actor");
      }

      await actor.update({
        "system.level": 10,
        "system.health.max": 30,
        "system.health.value": 30,
        "system.attacks": [{
          name: "Mind Blast",
          range: "Short",
          action: "action",
          damage: {
            mode: "pool",
            amount: 4,
            severity: "",
            stat: "intellect",
            ignoresArmor: 0,
            wounds: 1
          },
          effects: [],
          description: ""
        }]
      });

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
    await form.locator('input[name="difficulty"]').fill("21");
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
        "system.stats.might.pool.value": 0,
        "system.wounds.moderate.current": 1,
        "system.recoveries.hour": false
      });
      await actor.sheet.render(true);
    }, actorId);

    await page.locator(".pc-dashboard").last().locator(
      '[data-action="rollRecovery"][data-interval="hour"]'
    ).click();

    await waitForChatMessage(page, actorId);

    await page.waitForFunction(id => {
      return game.actors.get(id)?.system.recoveries.hour === true;
    }, actorId);

    const actor = await readActor(page, actorId);
    expect(actor.recoveries.hour).toBe(true);
    expect(actor.wounds.moderate).toBe(0);
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
      await actor.usePlayerIntrusion("E2E intrusion");
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
        await attack.rollAttack({ difficulty: 0, target: npc });

        const message = [...game.messages]
          .reverse()
          .find(entry => entry.getFlag("cypher", "rollType") === "task");

        return {
          targetLevel: npc.system.level,
          targetEffects: message?.getFlag("cypher", "weaponTargetEffects")
        };
      } finally {
        await npc.delete();
        await pc.delete();
      }
    });

    expect(result.targetLevel).toBe(2);
    expect(result.targetEffects).toEqual([{
      minimumTargetLevel: 0,
      maximumTargetLevel: 2,
      effect: "loseNextAction",
      hinderSteps: 0,
      duration: "next action"
    }]);
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

        return {
          health: npc.system.health.value,
          armor: npc.system.armor
        };
      } finally {
        await npc.delete();
        await pc.delete();
      }
    });

    expect(result.armor).toBe(4);
    expect(result.health).toBe(6);
  });

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
    await page.waitForTimeout(250);

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
      const { useCypher } =
        await import("/systems/cypher/module/applications/item-service.mjs");
      await useCypher(cypher);

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
      await actor.usePlayerIntrusion("Alpha vertical-slice intrusion");
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