import { test, expect, setDiceUniform } from "./foundry-session-fixture.mjs";
import { readFile } from "node:fs/promises";

test.describe("Cypher Foundry live runtime", () => {
  test("renders native English and French action labels and Power Shift help", async ({ e2ePage: page }) => {
    const expectedHelp = Object.fromEntries(await Promise.all(["en", "fr"].map(async language => [language,
      JSON.parse(await readFile(new URL(`../../lang/${language}.json`, import.meta.url), "utf8")).CYPHER.PowerShiftDescription
    ])));
    const original = await page.evaluate(() => {
      const setting = game.settings.settings.has("core.uiConfig") ? "uiConfig" : "colorScheme";
      return { language: game.i18n.lang, setting, config: foundry.utils.deepClone(game.settings.get("core", setting)) };
    });
    try {
      for (const language of ["en", "fr"]) for (const theme of ["light", "dark"]) {
        const result = await page.evaluate(async ({ language, theme, original }) => {
          await game.i18n.setLanguage(language);
          const colorScheme = { applications: theme, interface: theme };
          await game.settings.set("core", original.setting, original.setting === "uiConfig"
            ? { ...original.config, colorScheme } : colorScheme);
          const actor = await Actor.create({ name: `E2E Locale ${language}`, type: "pc", system: { genre: "superhero" } });
          try {
            await actor.createEmbeddedDocuments("Item", ["firstAction", "action", "lastAction"].map(action => ({
              name: `Timing ${action}`, type: "ability", system: { key: `timing-${action}`, action, enabler: false }
            })));
            await actor.sheet.render(true);
            const sheet = actor.sheet.element;
            // Match each badge to its actual Item, independently of batch order.
            const labels = Object.fromEntries(actor.items.filter(item => item.type === "ability").map(item => [
              item.system.action, sheet.querySelector(`.pc-ability-card[data-item-id="${item.id}"] .pc-action-badge`)?.textContent.trim()
            ]));
            const help = Object.fromEntries([...sheet.querySelectorAll(".power-shift-item")].map(element => [
              element.querySelector("input").name.split(".").at(-1), element.title
            ]));
            const text = sheet.textContent;
            return { language: game.i18n.lang, labels, help, missingKey: /CYPHER\.[A-Za-z]/.test(text),
              xp: sheet.querySelector('input[name="system.xp"]')?.closest("label")?.textContent.trim() };
          } finally {
            await actor.sheet.close();
            await actor.delete();
          }
        }, { language, theme, original });
        expect(result.language).toBe(language);
        expect(result.labels).toEqual(language === "fr"
          ? { firstAction: "Action réflexe", action: "Action", lastAction: "Action lente" }
          : { firstAction: "First action", action: "Action", lastAction: "Last action" });
        expect(result.xp).toBe(language === "fr" ? "PX" : "XP");
        expect(result.missingKey).toBe(false);
        // Even a short CRD definition must appear in full; text length is not
        // a fidelity criterion (Accuracy is exactly "All attack rolls.").
        expect(result.help).toEqual(expectedHelp[language]);
        await expect(page.locator("body")).toHaveClass(new RegExp(`theme-${theme}`));
      }
    } finally {
      if (!page.isClosed()) await page.evaluate(async original => {
        await game.i18n.setLanguage(original.language);
        await game.settings.set("core", original.setting, original.config);
      }, original);
    }
  });

  test("supports deterministic natural-roll boundaries", async ({ e2ePage: page }) => {
    await expect(setDiceUniform(page, 1)).rejects.toThrow(RangeError);
    await setDiceUniform(page, 0.025);
    expect(await page.evaluate(async () => (await new Roll("1d20").evaluate()).total)).toBe(20);
    await setDiceUniform(page, 0.975);
    expect(await page.evaluate(async () => (await new Roll("1d20").evaluate()).total)).toBe(1);
    // The next test must get the fixture default, not this test's final input.
  });

  test("evaluates deterministic dice with real Foundry formulas and serialization", async ({ e2ePage: page }) => {
    const results = await page.evaluate(async () => {
      return Promise.all(["1d20", "2d6 + 1", "1d100"].map(async formula => {
        const roll = await new Roll(formula).evaluate();
        const restored = Roll.fromJSON(JSON.stringify(roll));
        return {
          total: roll.total,
          dice: roll.dice.map(die => die.results.map(result => result.result)),
          restoredTotal: restored.total,
          restoredFormula: restored.formula,
          formula: roll.formula
        };
      }));
    });
    expect(results.map(result => result.total)).toEqual([10, 7, 48]);
    expect(results.map(result => result.dice)).toEqual([[[10]], [[3, 3]], [[48]]]);
    for (const result of results) {
      expect(result.restoredTotal).toBe(result.total);
      expect(result.restoredFormula).toBe(result.formula);
    }
  });

  test("loads the Cypher system and its document models", async ({ e2ePage: page }) => {
    const result = await page.evaluate(() => ({
      systemId: game.system.id,
      systemVersion: game.system.version,
      pc: game.system.documentTypes.Actor.pc !== undefined,
      attack: game.system.documentTypes.Item.attack !== undefined,
      armor: game.system.documentTypes.Item.armor !== undefined,
      shield: game.system.documentTypes.Item.shield !== undefined
    }));

    expect(result.systemId).toBe("cypher");
    expect(result.systemVersion).toBeTruthy();
    expect(result.pc).toBe(true);
    expect(result.attack).toBe(true);
    expect(result.armor).toBe(true);
    expect(result.shield).toBe(true);
  });

  test("keeps Foundry v14 status-effect proxy keys valid", async ({ e2ePage: page }) => {
    const result = await page.evaluate(() => {
      const keys = Reflect.ownKeys(CONFIG.statusEffects);
      const uniqueKeys = new Set(keys);
      return {
        keys,
        unique: uniqueKeys.size === keys.length,
        hindered: CONFIG.statusEffects.hindered?.id,
        dead: CONFIG.statusEffects.dead?.id
      };
    });

    expect(result.unique).toBe(true);
    expect(result.hindered).toBe("hindered");
    expect(result.dead).toBe("dead");
  });

  test("creates a real PC Actor with valid Cypher defaults", async ({ e2ePage: page }) => {
    const result = await page.evaluate(async () => {
      const actor = await Actor.create({
        name: `E2E PC ${Date.now()}`,
        type: "pc"
      });

      try {
        return {
          id: actor.id,
          type: actor.type,
          might: actor.system.stats.might.pool.value,
          speed: actor.system.stats.speed.pool.value,
          intellect: actor.system.stats.intellect.pool.value,
          wounds: {
            minor: actor.system.wounds.minor.max,
            moderate: actor.system.wounds.moderate.max,
            major: actor.system.wounds.major.max
          }
        };
      } finally {
        await actor.delete();
      }
    });

    expect(result.id).toBeTruthy();
    expect(result.type).toBe("pc");
    expect(result.might).toBeGreaterThanOrEqual(0);
    expect(result.speed).toBeGreaterThanOrEqual(0);
    expect(result.intellect).toBeGreaterThanOrEqual(0);
    expect(result.wounds).toEqual({ minor: 3, moderate: 3, major: 3 });
  });

  test("persists embedded Cypher Items on a real Actor", async ({ e2ePage: page }) => {
    const result = await page.evaluate(async () => {
      const actor = await Actor.create({
        name: `E2E Item Actor ${Date.now()}`,
        type: "pc"
      });

      try {
        const [skill] = await actor.createEmbeddedDocuments("Item", [{
          name: "E2E Skill",
          type: "skill"
        }]);
        const [armor] = await actor.createEmbeddedDocuments("Item", [{
          name: "E2E Armor",
          type: "armor"
        }]);
        const [attack] = await actor.createEmbeddedDocuments("Item", [{
          name: "E2E Attack",
          type: "attack"
        }]);

        return {
          skill: { id: skill.id, type: skill.type },
          armor: { id: armor.id, type: armor.type },
          attack: { id: attack.id, type: attack.type },
          itemCount: actor.items.size,
          itemTypes: actor.items.map(item => item.type)
        };
      } finally {
        await actor.delete();
      }
    });

    expect(result.itemCount).toBe(3);
    expect(result.itemTypes).toEqual(
      expect.arrayContaining(["skill", "armor", "attack"])
    );
    expect(result.skill.id).toBeTruthy();
    expect(result.armor.id).toBeTruthy();
    expect(result.attack.id).toBeTruthy();
  });

  test("loads all FR and EN compendium packs", async ({ e2ePage: page }) => {
    const result = await page.evaluate(async () => {
      const names = [
        "abilities-fr", "skills-fr", "descriptors-fr", "types-fr", "foci-fr", "equipment-fr", "rules-fr",
        "abilities-en", "skills-en", "descriptors-en", "types-en", "foci-en", "equipment-en", "rules-en"
      ];

      return Promise.all(names.map(async name => {
        const pack = game.packs.get(`cypher.${name}`);
        if (!pack) throw new Error(`Missing pack: ${name}`);
        const index = await pack.getIndex();
        return {
          collection: pack.collection,
          documentName: pack.documentName,
          size: index.size
        };
      }));
    });

    expect(result).toHaveLength(14);
    for (const pack of result) {
      expect(pack.documentName).toBe(pack.collection.includes("rules-") ? "JournalEntry" : "Item");
      expect(pack.size).toBeGreaterThan(0);
    }
  });

  test("loads every complete proposed French translation from compiled native compendiums", async ({ e2ePage: page }) => {
    test.skip(process.env.CYPHER_E2E_TRANSLATION_PREVIEW !== "true", "Requires the explicit draft translation build.");
    const results = await page.evaluate(async () => {
      const names = ["abilities", "skills", "descriptors", "types", "foci", "equipment", "rules"];
      return Promise.all(names.map(async family => {
        const documents = await game.packs.get(`cypher.${family}-fr`).getDocuments();
        return { family, count: documents.length,
          missing: documents.filter(document => !["proposed", "reviewed"].includes(document.flags.cypherFoundry?.translation?.status))
            .map(document => document.name),
          sourceIds: documents.map(document => document.flags.cypherFoundry.crd.sourceLogicalId),
          // Include the confirmed Type names as visible evidence of overlay compilation.
          typeNames: family === "types" ? documents.map(document => document.name) : [] };
      }));
    });
    expect(results.reduce((sum, result) => sum + result.count, 0)).toBe(1373);
    for (const result of results) {
      expect(result.missing, result.family).toEqual([]);
      expect(result.sourceIds.every(Boolean), result.family).toBe(true);
    }
    expect(results.find(result => result.family === "types").typeNames).toEqual(expect.arrayContaining([
      "Puissance incarnée (degré de puissance 4)", "Prodige du pouvoir (degré de puissance 2)"
    ]));
  });

  test("preserves an English Skill when a French Descriptor grants its bilingual counterpart", async ({ e2ePage: page }) => {
    test.skip(process.env.CYPHER_E2E_TRANSLATION_PREVIEW !== "true", "Requires the explicit draft translation build.");
    const result = await page.evaluate(async () => {
      const english = (await game.packs.get("cypher.skills-en").getDocuments())
        .find(item => item.flags.cypherFoundry.crd.logicalId === "skill.athletics");
      const descriptor = (await game.packs.get("cypher.descriptors-fr").getDocuments())
        .find(item => item.flags.cypherFoundry.crd.logicalId === "descriptor.strong");
      const french = (await game.packs.get("cypher.skills-fr").getDocuments())
        .find(item => item.flags.cypherFoundry.crd.sourceLogicalId === "skill.athletics");
      const actor = await Actor.create({ name: "E2E Bilingual Skill", type: "pc" });
      try {
        const [skill] = await actor.createEmbeddedDocuments("Item", [{ ...english.toObject(), name: "My athletics" }]);
        const { applyDescriptor } = await import("/systems/cypher/module/applications/content-service.mjs");
        const applied = await applyDescriptor(actor, descriptor, { skillName: french.name });
        const skills = actor.items.filter(item => item.type === "skill");
        return { applied, count: skills.length, originalId: skill.id, retainedId: skills[0]?.id,
          name: skills[0]?.name, level: skills[0]?.system.level,
          sourceId: skills[0]?.flags.cypherFoundry.crd.logicalId };
      } finally {
        await actor.delete();
      }
    });
    expect(result.applied).toBe(true);
    expect(result.count).toBe(1);
    expect(result.retainedId).toBe(result.originalId);
    expect(result.name).toBe("My athletics");
    expect(result.level).toBe("specialized");
    expect(result.sourceId).toBe("skill.athletics");
  });

  test("renders a real PC sheet with stat roll controls", async ({ e2ePage: page }) => {
    const result = await page.evaluate(async () => {
      const actor = await Actor.create({
        name: `E2E Sheet Actor ${Date.now()}`,
        type: "pc"
      });
      await actor.sheet.render(true);
      return {
        actorId: actor.id,
        rendered: Boolean(actor.sheet.element),
        rollButtons: actor.sheet.element.querySelectorAll(
          '[data-action="rollStat"]'
        ).length
      };
    });

    try {
      expect(result.rendered).toBe(true);
      expect(result.rollButtons).toBeGreaterThanOrEqual(3);
    } finally {
      await page.evaluate(async actorId => {
        const actor = game.actors.get(actorId);
        if (actor) {
          await actor.sheet.close();
          await actor.delete();
        }
      }, result.actorId);
    }
  });
});
