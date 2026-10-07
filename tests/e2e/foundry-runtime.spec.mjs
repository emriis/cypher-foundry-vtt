import { test, expect } from "./foundry-session-fixture.mjs";

test.describe("Cypher Foundry live runtime", () => {
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
        "descriptors-fr", "types-fr", "foci-fr",
        "descriptors-en", "types-en", "foci-en"
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

    expect(result).toHaveLength(6);
    for (const pack of result) {
      expect(pack.documentName).toBe("Item");
      expect(pack.size).toBeGreaterThan(0);
    }
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