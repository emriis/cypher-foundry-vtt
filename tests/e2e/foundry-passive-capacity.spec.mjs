/** Exercise passive source data, effective sheet capacity and saved wound counts. */
import { test, expect } from "./foundry-session-fixture.mjs";
import { waitForFoundryReady } from "./foundry-session.mjs";

test("Drakain Orc and Prota grant their extra minor wound automatically from EN and FR sources", async ({ e2ePage: page }) => {
  const state = await page.evaluate(async () => {
    const checked = [];
    let lastActorId;
    for (const language of ["en", "fr"]) {
      const pack = game.packs.get(`cypher.descriptors-${language}`);
      const index = await pack.getIndex({ fields: ["flags.cypherFoundry.crd.logicalId"] });
      const abilities = game.packs.get(`cypher.abilities-${language}`);
      const abilityIndex = await abilities.getIndex({ fields: ["system.key"] });
      const tough = abilityIndex.find(item => item.system?.key === "tough");
      for (const species of ["drakain", "orc", "prota"]) {
        const entry = index.find(item => item.flags.cypherFoundry?.crd?.logicalId === `descriptor.species.${species}`);
        if (!entry) throw new Error(`Missing ${language}/${species}`);
        const source = await pack.getDocument(entry._id);
        const actor = await Actor.create({ name: `E2E ${language} ${species} capacity`, type: "pc", system: {
          genre: species === "orc" ? "fantasy" : "sciFi", wounds: { minor: { current: 3, max: 3 } }
        } });
        await actor.applyDescriptor(source);
        if (actor.system.effectiveWounds.minor.max !== 4) throw new Error(`Species-only capacity failed: ${language}/${species}`);
        const data = (await abilities.getDocument(tough._id)).toObject();
        delete data._id;
        await actor.createEmbeddedDocuments("Item", [data, data]);
        if (actor.system.effectiveWounds.minor.max !== 5) throw new Error(`Species plus Tough failed: ${language}/${species}`);
        const count = actor.items.size;
        await actor.applyDescriptor(source);
        if (actor.items.size !== count) throw new Error("Repeated species application created another grant");
        await actor.addWound("minor");
        await actor.addWound("minor");
        await actor.addWound("minor");
        if (actor.system.wounds.minor.current !== 5 || actor.system.wounds.moderate.current !== 1
          || actor._source.system.wounds.minor.max !== 3) throw new Error("Incorrect wound overflow or changed base capacity");
        checked.push(actor.id);
        lastActorId = actor.id;
      }
    }
    return { actors: checked, lastActorId };
  });
  expect(state.actors).toHaveLength(6);
  await page.reload();
  await waitForFoundryReady(page);
  const snapshots = await page.evaluate(async ({ actors, lastActorId }) => {
    await game.actors.get(lastActorId).sheet.render({ force: true });
    return actors.map(id => {
      const actor = game.actors.get(id);
      return [actor.system.effectiveWounds.minor.max, actor.system.wounds.minor.current,
        actor.system.wounds.moderate.current, actor._source.system.wounds.minor.max];
    });
  }, state);
  for (const snapshot of snapshots) expect(snapshot).toEqual([5, 5, 1, 3]);
  await expect(page.locator('input[name="system.wounds.minor.current"]')).toHaveAttribute("max", "5");
});

test("species and Descriptor origins remain additive to Ability capacity after reload", async ({ e2ePage: page }) => {
  const actorId = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E capacity origins", type: "pc", system: { genre: "fantasy" } });
    const pack = game.packs.get("cypher.abilities-en");
    const index = await pack.getIndex({ fields: ["system.key"] });
    const entry = index.find(item => item.system?.key === "tough");
    const abilityData = (await pack.getDocument(entry._id)).toObject();
    delete abilityData._id;
    await actor.createEmbeddedDocuments("Item", [abilityData, abilityData]);
    for (const category of ["species", "descriptor"]) {
      // Synthetic definitions exercise origin persistence, without claiming
      // that all catalogue Descriptor benefits already have structured rules.
      const source = await Item.create({ name: "Same source label", type: "descriptor", system: {
        category, genres: ["fantasy"], statOptions: [], statAmount: 0,
        benefits: [{ name: "Same benefit label", description: "You can take one more minor wound than normal." }]
      } });
      await actor.applyDescriptor(source);
      const benefit = actor.items.find(item => item.flags.cypher?.grantOrigin?.sourceId === source.id);
      if (!benefit || benefit.flags.cypher.grantOrigin.kind !== category) throw new Error("Missing benefit origin");
      // Explicit fixture configuration; runtime never extracts this from prose.
      await benefit.update({ "system.passiveModifiers": [{ kind: "woundCapacity", severity: "minor", amount: 1 }] });
    }
    return actor.id;
  });
  await page.reload();
  await waitForFoundryReady(page);
  const result = await page.evaluate(async id => {
    const actor = game.actors.get(id);
    await actor.sheet.render({ force: true });
    return { base: actor._source.system.wounds.minor.max, effective: actor.system.effectiveWounds.minor.max,
      origins: actor.items.filter(item => item.flags.cypher?.grantOrigin).map(item => item.flags.cypher.grantOrigin.kind).sort() };
  }, actorId);
  expect(result).toEqual({ base: 3, effective: 6, origins: ["descriptor", "species"] });
  await expect(page.locator('input[name="system.wounds.minor.current"]')).toHaveAttribute("max", "6");
});

test("capacity grants retain both minor and moderate bonuses without duplicating either effect", async ({ e2ePage: page }) => {
  const result = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E independent wound grants", type: "pc", system: {
      wounds: { minor: { current: 3, max: 3 }, moderate: { current: 3, max: 3 } }
    } });
    const payload = [];
    for (const [language, keys] of [["en", ["tough", "resilience", "hard-won-resilience", "shield-master"]],
      ["fr", ["tough", "shield-master"]]]) {
      const pack = game.packs.get(`cypher.abilities-${language}`);
      const index = await pack.getIndex({ fields: ["system.key"] });
      for (const key of keys) {
        const entry = index.find(item => item.system?.key === key);
        if (!entry) throw new Error(`Missing ${language}/${key}`);
        const data = (await pack.getDocument(entry._id)).toObject();
        delete data._id;
        payload.push(data);
      }
    }
    await actor.createEmbeddedDocuments("Item", payload);
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ name: "Stacking shield", type: "shield", system: { equipped: true } }]);
    const before = { minor: actor.system.effectiveWounds.minor.max, moderate: actor.system.effectiveWounds.moderate.max,
      shield: shield.system.effectiveWounds.moderate.max, hindered: actor.system.hindered };
    await actor.addWound("minor");
    await actor.addWound("moderate");
    await actor.sheet.render({ force: true });
    return { before, actorId: actor.id, minor: actor.system.wounds.minor.current,
      moderate: actor.system.wounds.moderate.current, major: actor.system.wounds.major.current };
  });
  expect(result.before).toEqual({ minor: 4, moderate: 4, shield: 3, hindered: false });
  expect([result.minor, result.moderate, result.major]).toEqual([4, 4, 0]);
  await expect(page.locator('input[name="system.wounds.minor.current"]')).toHaveAttribute("max", "4");
  await expect(page.locator('input[name="system.wounds.moderate.current"]')).toHaveAttribute("max", "4");
});

test("all enabler wound-capacity grants apply from EN and FR packs, including Shield Master and rank gates", async ({ e2ePage: page }) => {
  const result = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E all passive capacities", type: "pc", system: { genre: "superhero", rank: 2 } });
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ name: "Capacity shield", type: "shield",
      system: { equipped: true, wounds: { moderate: { current: 2, max: 2 } } } }]);
    // Independent CRD clause expectations, not values copied from modifiers.
    const grants = {
      "tough": [1, 0, 0, 0], "stone-body": [2, 0, 0, 0],
      "improved-stone-body": [0, 1, 0, 0], "mineralization": [0, 0, 1, 0],
      "resilience": [0, 1, 0, 0], "hard-won-resilience": [0, 1, 0, 0],
      "push-on-through": [0, 1, 0, 0], "armored-body": [0, 1, 1, 0],
      "stretchy": [0, 1, 0, 0], "shield-master": [0, 0, 0, 1]
    };
    const checked = [];
    for (const language of ["en", "fr"]) {
      const pack = game.packs.get(`cypher.abilities-${language}`);
      const index = await pack.getIndex({ fields: ["system.key"] });
      for (const [key, bonus] of Object.entries(grants)) {
        const entry = index.find(item => item.system?.key === key);
        if (!entry) throw new Error(`Missing ${language}/${key}`);
        const [ability] = await actor.createEmbeddedDocuments("Item", [(await pack.getDocument(entry._id)).toObject()]);
        const actual = ["minor", "moderate", "major"].map(severity => actor.system.effectiveWounds[severity].max);
        actual.push(shield.system.effectiveWounds.moderate.max);
        const expected = bonus.map((value, i) => value + (i === 3 ? 2 : 3));
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${language}/${key}: ${actual} instead of ${expected}`);
        if (key === "armored-body") {
          await actor.update({ "system.rank": 1 });
          if (actor.system.effectiveWounds.major.max !== 3) throw new Error("Rank-one Armored Body grant");
          await actor.update({ "system.rank": 2 });
        }
        if (Object.values(actor._source.system.wounds ?? {}).some(wound => wound.max !== 3)) throw new Error("Base PC capacities changed");
        if (shield._source.system.wounds.moderate.max !== 2) throw new Error("Base shield capacity changed");
        await ability.delete();
        if (shield.system.effectiveWounds.moderate.max !== 2 || actor.system.effectiveWounds.major.max !== 3) {
          throw new Error(`Removal left a capacity bonus: ${language}/${key}`);
        }
        checked.push(`${language}/${key}`);
      }
    }
    const entry = game.packs.get("cypher.abilities-en").index.find(item => item.system?.key === "shield-master");
    await actor.createEmbeddedDocuments("Item", [(await game.packs.get("cypher.abilities-en").getDocument(entry._id)).toObject()]);
    await actor.sheet.render({ force: true });
    return { count: checked.length, shieldId: shield.id, core: game.version };
  });
  expect(result.count).toBe(20);
  await expect(page.locator(`[data-item-id="${result.shieldId}"]`)).toContainText("2/3");
});

test("Tough passive wound capacity survives reload without changing saved maxima", async ({ e2ePage: page }) => {
  const actorId = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "E2E Tough passive capacity", type: "pc",
      system: { wounds: { minor: { current: 3, max: 3 } } } });
    // Read actual compiled EN and FR Items; names do not dispatch mechanics.
    for (const language of ["en", "fr"]) {
      const pack = game.packs.get(`cypher.abilities-${language}`);
      const index = await pack.getIndex({ fields: ["system.key"] });
      const entry = index.find(item => item.system?.key === "tough");
      if (!entry) throw new Error(`Missing Tough in ${language}`);
      const source = await pack.getDocument(entry._id);
      const [ability] = await actor.createEmbeddedDocuments("Item", [source.toObject()]);
      if (actor.system.effectiveWounds.minor.max !== 4) throw new Error("Passive bonus not prepared");
      await ability.delete();
    }
    const pack = game.packs.get("cypher.abilities-en");
    const entry = pack.index.find(item => item.system?.key === "tough");
    await actor.createEmbeddedDocuments("Item", [(await pack.getDocument(entry._id)).toObject()]);
    await actor.sheet.render({ force: true });
    return actor.id;
  });
  const minor = page.locator('input[name="system.wounds.minor.current"]');
  await expect(minor).toHaveAttribute("max", "4");
  // Exercise the same public damage entry point used by failed defense rolls.
  await page.evaluate(async id => {
    const actor = game.actors.get(id);
    await actor.addWound("minor");
    await actor.addWound("minor");
  }, actorId);
  await expect(minor).toHaveValue("4");
  await expect(page.locator('input[name="system.wounds.moderate.current"]')).toHaveValue("1");
  await page.reload();
  await waitForFoundryReady(page);
  const state = await page.evaluate(async id => {
    const actor = game.actors.get(id);
    const before = { base: actor.system.wounds.minor.max, effective: actor.system.effectiveWounds.minor.max,
      current: actor.system.wounds.minor.current, active: actor.system.activeAbilityEffects.length };
    await actor.items.find(item => item.system.key === "tough").delete();
    return { ...before, removed: actor.system.effectiveWounds.minor.max, retained: actor.system.wounds.minor.current };
  }, actorId);
  expect(state).toEqual({ base: 3, effective: 4, current: 4, active: 0, removed: 3, retained: 4 });
});
