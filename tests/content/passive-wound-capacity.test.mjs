/** Source-backed Tough contract; catalogue presence alone does not grant capacity. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { resolveActiveAbilityModifiers } from "../../module/rules/ability-modifiers.mjs";

// Independently transcribed capacity clauses from CRD 2026-07-29. The full
// definitions contain other effects; these expectations certify only capacity.
const CAPACITY_GRANTS = {
  "tough": ["woundCapacity", { minor: 1 }],
  "stone-body": ["woundCapacity", { minor: 2 }],
  "improved-stone-body": ["woundCapacity", { moderate: 1 }],
  "mineralization": ["woundCapacity", { major: 1 }],
  "resilience": ["woundCapacity", { moderate: 1 }],
  "hard-won-resilience": ["woundCapacity", { moderate: 1 }],
  "push-on-through": ["woundCapacity", { moderate: 1 }],
  "armored-body": ["woundCapacity", { moderate: 1, major: 1 }],
  "stretchy": ["woundCapacity", { moderate: 1 }],
  "shield-master": ["shieldWoundCapacity", { moderate: 1 }]
};

test("all reviewed capacity grants exist in EN/FR and survive genre materialization", async () => {
  const genre = JSON.parse(await readFile(new URL("../../data/crd-genre-abilities.json", import.meta.url), "utf8"));
  for (const language of ["en", "fr"]) {
    const directory = new URL(`../../packs/abilities-${language}/_source/`, import.meta.url);
    const records = await Promise.all((await readdir(directory)).filter(name => name.endsWith(".json"))
      .map(async name => JSON.parse(await readFile(new URL(name, directory), "utf8"))));
    // Some genre definitions only become standalone Items during normalization.
    const items = [...records.filter(item => item.type === "ability"),
      ...genre.records.map(record => ({ type: "ability", system: record.system }))];
    for (const [key, [kind, capacities]] of Object.entries(CAPACITY_GRANTS)) {
      const matches = items.filter(item => item.system.key === key);
      assert.ok(matches.length, `${language}: ${key}`);
      for (const item of matches) {
        const modifiers = resolveActiveAbilityModifiers([], [item], { rank: 2 });
        for (const [severity, amount] of Object.entries(capacities)) {
          assert.equal(modifiers[kind]?.[severity], amount, `${language}: ${key}/${severity}`);
        }
        if (key === "armored-body") assert.equal(item.system.passiveModifiers.every(modifier => modifier.minimumRank === 2), true);
      }
    }
  }
});

test("CRD Tough encodes the same unconditional minor-wound benefit in EN/FR and genre sources", async () => {
  const genre = JSON.parse(await readFile(new URL("../../data/crd-genre-abilities.json", import.meta.url), "utf8"));
  const items = (await Promise.all(["en", "fr"].map(async language => {
    const directory = new URL(`../../packs/abilities-${language}/_source/`, import.meta.url);
    const records = await Promise.all((await readdir(directory)).filter(name => name.endsWith(".json"))
      .map(async name => JSON.parse(await readFile(new URL(name, directory), "utf8"))));
    const tough = records.filter(record => record.type === "ability" && record.system.key === "tough");
    assert.ok(tough.length, `Tough must exist in ${language}`);
    return tough;
  }))).flat();
  items.push(...genre.records.filter(record => record.system.key === "tough").map(record => ({ type: "ability", system: record.system })));
  for (const item of items) {
    // CRD 2026-07-29 > Fantasy Genre > Fantasy Genre Abilities > Mid-Tier > Tough;
    // repeated under Foci > Explores. No cost, activation or recovery boundary.
    assert.equal(item.system.description.replace(/<[^>]+>/g, ""), "You can take an additional minor wound.");
    assert.deepEqual(item.system.passiveModifiers, [{ kind: "woundCapacity", stat: "", severity: "minor", amount: 1 }]);
    assert.equal(resolveActiveAbilityModifiers([], [item]).woundCapacity.minor, 1);
  }
});
