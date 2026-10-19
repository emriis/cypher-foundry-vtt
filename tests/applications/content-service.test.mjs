import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolveActiveAbilityModifiers } from "../../module/rules/ability-modifiers.mjs";

const { applyType, applyFocus, applyDescriptor, getInitialFocusAbilityChoices } = await import(
  "../../module/applications/content-service.mjs"
);

function createActor() {
  return {
    type: "pc",
    system: {
      genre: "fantasy",
      stats: {
        might: { pool: { max: 8, value: 8 }, edge: 0 },
        speed: { pool: { max: 8, value: 8 }, edge: 0 },
        intellect: { pool: { max: 8, value: 8 }, edge: 0 }
      },
      wounds: {
        minor: { max: 3 },
        moderate: { max: 3 },
        major: { max: 3 }
      }
    },
    items: [],
    flags: {},
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update(updates) {
      for (const [path, value] of Object.entries(updates)) {
        const parts = path.split(".");
        let target = this;
        for (const part of parts.slice(0, -1)) {
          target = target[part] ??= {};
        }
        target[parts.at(-1)] = value;
      }
    },
    async createEmbeddedDocuments(_type, documents) {
      this.items.push(...documents);
      return documents;
    }
  };
}

/** Keep language labels separate from the Skill identity shared by both packs. */
function setupSkillGrants({ failIndex = false } = {}) {
  const provenance = language => ({ version: "2026-07-29", logicalId: "skill.athletics",
    language, ...(language === "fr" ? { sourceLogicalId: "skill.athletics" } : {}) });
  const packs = new Map(["en", "fr"].map(language => [`cypher.skills-${language}`, {
    async getIndex() {
      if (failIndex) throw new Error("Skill index unavailable");
      return [{ type: "skill", name: language === "fr" ? "Athlétisme" : "Athletics",
        flags: { cypherFoundry: { crd: provenance(language) } } }];
    }
  }]));
  globalThis.game = { packs, i18n: { localize: value => value, format: value => value } };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  return provenance;
}

function existingSkill(name, provenance) {
  return { type: "skill", name, system: { level: "trained" },
    ...(provenance ? { flags: { cypherFoundry: { crd: provenance } } } : {}),
    async update(values) { this.system.level = values["system.level"]; } };
}

test("species and Descriptor benefit Items persist distinct grant origins without parsing names", async () => {
  setupSkillGrants();
  const actor = createActor();
  for (const category of ["species", "descriptor"]) {
    const source = { type: "descriptor", id: category, name: "Same translated source", system: {
      category, genres: ["fantasy"], statOptions: [], statAmount: 0,
      benefits: [{ name: "Same benefit", description: "Source benefit text" }]
    } };
    assert.equal(await applyDescriptor(actor, source), true);
    const benefit = actor.items.at(-1);
    assert.deepEqual(benefit.flags?.cypher?.grantOrigin, { kind: category, sourceId: category });
    assert.equal(typeof benefit.system.key, "string", "Generated benefits must satisfy the Ability schema");
    assert.ok(benefit.system.key.length);
  }
});

for (const language of ["en", "fr"]) {
  for (const species of ["drakain", "orc", "prota"]) {
    test(`${language} ${species} automatically grants minor capacity in addition to Tough`, async () => {
      setupSkillGrants();
      const source = JSON.parse(await readFile(new URL(
        `../../packs/descriptors-${language}/_source/species/${species}.json`, import.meta.url), "utf8"));
      const actor = createActor();
      actor.system.genre = species === "orc" ? "fantasy" : "sciFi";
      actor.items.push({ type: "ability", system: { key: "tough", passiveModifiers: [
        { kind: "woundCapacity", severity: "minor", amount: 1 }
      ] } });
      assert.equal(await applyDescriptor(actor, source), true);
      const benefit = actor.items.find(item => item.flags?.cypher?.grantOrigin?.kind === "species"
        && item.system.passiveModifiers?.length);
      assert.ok(benefit, "The applied species must create its structured capacity benefit");
      assert.equal(resolveActiveAbilityModifiers([], actor.items, actor.system).woundCapacity.minor, 2);
      assert.equal(actor.system.wounds.minor.max, 3);
      const itemCount = actor.items.length;
      assert.equal(await applyDescriptor(actor, source), false);
      assert.equal(actor.items.length, itemCount);
      // Owned configuration is independent of its authoring/compendium source.
      benefit.system.passiveModifiers[0].amount = 2;
      assert.equal(source.system.benefits.find(entry => entry.passiveModifiers?.length).passiveModifiers[0].amount, 1);
    });
  }
}

test("Given an English imported Skill, when a French Type grants its translation, then the same Skill advances without a duplicate", async () => {
  const provenance = setupSkillGrants();
  const actor = createActor();
  const skill = existingSkill("Athletics", provenance("en"));
  actor.items.push(skill);
  assert.equal(await applyType(actor, { type: "type", id: "type", name: "Guerrier",
    system: { skillOptions: ["Athlétisme"], abilities: [] } }), true);
  assert.equal(actor.items.length, 1);
  assert.equal(skill.system.level, "specialized");
  assert.equal(skill.name, "Athletics");
});

test("Given a renamed French imported Skill, when an English Descriptor grants its CRD source, then identity preserves the existing Skill", async () => {
  const provenance = setupSkillGrants();
  const actor = createActor();
  const skill = existingSkill("Mon entraînement physique", { ...provenance("fr"), logicalId: "localized.legacy-athletics" });
  actor.items.push(skill);
  assert.equal(await applyDescriptor(actor, { type: "descriptor", id: "descriptor", name: "Strong",
    system: { statAmount: 0, grantedSkills: ["Athletics"] } }), true);
  assert.equal(actor.items.length, 1);
  assert.equal(skill.system.level, "specialized");
  assert.equal(skill.name, "Mon entraînement physique");
});

test("Given a custom Skill without CRD provenance, when a Type grants its name, then legacy name matching still advances it", async () => {
  setupSkillGrants();
  const actor = createActor();
  const skill = existingSkill("Navigation des rêves");
  actor.items.push(skill);
  assert.equal(await applyType(actor, { type: "type", id: "type", name: "Rêveur",
    system: { skillOptions: ["navigation des rêves"], abilities: [] } }), true);
  assert.equal(actor.items.length, 1);
  assert.equal(skill.system.level, "specialized");
});

test("Given no existing Skill, when a French Type grants one then an English Descriptor grants its source, then provenance joins both grants", async () => {
  setupSkillGrants();
  const actor = createActor();
  await applyType(actor, { type: "type", id: "type", name: "Guerrier",
    system: { skillOptions: ["Athlétisme"], abilities: [] } });
  assert.equal(actor.items[0].flags?.cypherFoundry?.crd?.sourceLogicalId, "skill.athletics");
  // Actor-owned Items expose update after Foundry creates them; the fake supplies
  // that persistence method for the second content application.
  actor.items[0].update = async values => { actor.items[0].system.level = values["system.level"]; };
  await applyDescriptor(actor, { type: "descriptor", id: "descriptor", name: "Strong",
    system: { statAmount: 0, grantedSkills: ["Athletics"] } });
  assert.equal(actor.items.length, 1);
  assert.equal(actor.items[0].system.level, "specialized");
});

test("Given two translated labels for one Skill, when a Descriptor grants both, then the canonical Skill is granted only once", async () => {
  setupSkillGrants();
  const actor = createActor();
  assert.equal(await applyDescriptor(actor, { type: "descriptor", id: "descriptor", name: "Fort",
    system: { statAmount: 0, grantedSkills: ["Athlétisme"] } }, { skillName: "Athletics" }), true);
  assert.equal(actor.items.length, 1);
  assert.equal(actor.items[0].system.level, "trained");
});

test("Given a same-name Skill from another CRD source, when a Type grants Athletics, then the unrelated Skill is preserved", async () => {
  setupSkillGrants();
  const actor = createActor();
  const skill = existingSkill("Athlétisme", { logicalId: "skill.acrobatics" });
  actor.items.push(skill);
  await applyType(actor, { type: "type", id: "type", name: "Guerrier",
    system: { skillOptions: ["Athlétisme"], abilities: [] } });
  assert.equal(actor.items.length, 2);
  assert.equal(skill.system.level, "trained");
  assert.equal(actor.items[1].flags?.cypherFoundry?.crd?.sourceLogicalId, "skill.athletics");
});

test("Given a custom matching name and a renamed CRD Skill, when a Type grants that source, then CRD identity takes priority", async () => {
  const provenance = setupSkillGrants();
  const actor = createActor();
  const custom = existingSkill("Athlétisme");
  const imported = existingSkill("Mon entraînement", provenance("en"));
  actor.items.push(custom, imported);
  await applyType(actor, { type: "type", id: "type", name: "Guerrier",
    system: { skillOptions: ["Athlétisme"], abilities: [] } });
  assert.equal(actor.items.length, 2);
  assert.equal(custom.system.level, "trained");
  assert.equal(imported.system.level, "specialized");
});

for (const kind of ["type", "descriptor"]) {
  test(`Given an ambiguous bilingual Skill label, when a ${kind} grants it, then no Actor state changes`, async () => {
    setupSkillGrants();
    game.packs.set("cypher.skills-en", {
      async getIndex() {
        return [{ type: "skill", name: "Athlétisme",
          flags: { cypherFoundry: { crd: { logicalId: "skill.acrobatics" } } } }];
      }
    });
    const actor = createActor();
    const original = structuredClone({ system: actor.system, flags: actor.flags });
    const item = { type: kind, id: "source", name: "Source", system: {
      statAmount: 2, statOptions: ["might"], poolBonuses: { might: 2 },
      skillOptions: ["Athlétisme"], grantedSkills: ["Athlétisme"], abilities: [] } };
    await assert.rejects(kind === "type" ? applyType(actor, item) : applyDescriptor(actor, item),
      /Ambiguous CRD Skill label/);
    assert.deepEqual({ system: actor.system, flags: actor.flags }, original);
    assert.equal(actor.items.length, 0);
  });
}

test("Given no native Skill packs, when a Type grants a custom Skill, then legacy matching remains available", async () => {
  setupSkillGrants();
  game.packs.clear();
  const actor = createActor();
  const skill = existingSkill("Navigation des rêves");
  actor.items.push(skill);
  assert.equal(await applyType(actor, { type: "type", id: "type", name: "Rêveur",
    system: { skillOptions: ["navigation des rêves"], abilities: [] } }), true);
  assert.equal(actor.items.length, 1);
  assert.equal(skill.system.level, "specialized");
  assert.equal(skill.flags, undefined);
});

test("Given unavailable Skill indices, when a Type grants no Skill, then its unrelated benefits still apply", async () => {
  setupSkillGrants({ failIndex: true });
  const actor = createActor();
  assert.equal(await applyType(actor, { type: "type", id: "type", name: "Warrior",
    system: { poolBonuses: { might: 2 }, abilities: [] } }), true);
  assert.equal(actor.system.stats.might.pool.max, 10);
  assert.equal(actor.system.stats.might.pool.value, 10);
  assert.equal(actor.items.length, 0);
});

for (const kind of ["type", "descriptor"]) {
  test(`Given an unavailable Skill index, when a ${kind} is applied, then the failure occurs before any Actor mutation`, async () => {
    setupSkillGrants({ failIndex: true });
    const actor = createActor();
    const original = structuredClone({ system: actor.system, flags: actor.flags });
    const item = { type: kind, id: "source", name: "Source", system: {
      statAmount: 2, statOptions: ["might"], poolBonuses: { might: 2 }, skillOptions: ["Athlétisme"],
      grantedSkills: ["Athlétisme"], abilities: [] } };
    await assert.rejects(kind === "type" ? applyType(actor, item) : applyDescriptor(actor, item), /index unavailable/);
    assert.deepEqual({ system: actor.system, flags: actor.flags }, original);
    assert.equal(actor.items.length, 0);
  });
}

test("applyType copies mechanics from resolved standalone abilities", async () => {
  globalThis.game = {
    i18n: {
      localize: value => value,
      format: value => value
    }
  };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.ChatMessage = {
    getSpeaker: () => ({}),
    create: async () => {}
  };

  const actor = createActor();
  const ability = {
    type: "ability",
    id: "ability-id",
    name: "Frenzy",
    system: {
      tier: 1,
      key: "frenzy",
      enabler: false,
      repeatable: false,
      cost: { stat: "might", amount: 1, options: [] },
      action: null,
      effects: [],
      rollTables: [],
      description: "Enter a frenzy."
    }
  };
  const type = {
    type: "type",
    id: "type-id",
    name: "Barbarian",
    system: {
      genre: "Fantasy",
      poolBonuses: { might: 0, speed: 0, intellect: 0 },
      edgeChoice: 0,
      woundBonuses: { minor: 0, moderate: 0, major: 0 },
      freeWeapons: false,
      freeArmor: false,
      freeWeaponCategories: [],
      freeArmorCategories: [],
      freeWeaponFamilies: [],
      skillOptions: [],
      abilities: [ability]
    }
  };

  assert.equal(await applyType(actor, type), true);
  assert.equal(actor.items.length, 1);
  assert.equal(actor.items[0].name, "Frenzy");
  assert.equal(actor.items[0].system.source, "Barbarian");
  assert.equal(actor.items[0].system.cost.amount, 1);
});

test("applyType rejects a wrong-type ability reference", async () => {
  globalThis.game = {
    i18n: { localize: value => value }
  };
  globalThis.ui = { notifications: { warn() {} } };

  const actor = createActor();
  const type = {
    type: "type",
    id: "type-id",
    name: "Invalid Type",
    system: {
      poolBonuses: { might: 0, speed: 0, intellect: 0 },
      woundBonuses: { minor: 0, moderate: 0, major: 0 },
      abilities: [{
        type: "descriptor",
        id: "wrong-type"
      }]
    }
  };

  assert.equal(await applyType(actor, type), false);
  assert.equal(actor.items.length, 0);
});

test("applyFocus rejects a missing ability reference before changing the actor", async () => {
  globalThis.game = {
    i18n: { localize: value => value }
  };
  globalThis.ui = { notifications: { warn() {} } };

  globalThis.fromUuid = async () => null;

  const actor = createActor();
  const focus = {
    type: "focus",
    id: "focus-id",
    name: "Missing Focus",
    system: {
      abilities: ["Compendium.test.abilities.Item.missing"],
      flowchart: { edges: [] }
    }
  };

  assert.equal(await applyFocus(actor, focus, ["missing", "other"]), false);
  assert.equal(actor.system.focus, undefined);
  assert.equal(actor.items.length, 0);
});

test("selectFocusAbility does not mutate actor state when its source cannot be resolved", async () => {
  globalThis.game = {
    i18n: { localize: value => value }
  };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.fromUuid = async () => null;

  const actor = {
    type: "pc",
    system: {
      tier: 2,
      focus: "Missing Focus"
    },
    flags: {
      cypher: {
        focusAbilityIds: ["first"],
        appliedFocusGraph: {
          abilities: [{
            id: "second",
            uuid: "Compendium.test.abilities.Item.second",
            tier: 2,
            prerequisites: ["first"],
            repeatable: false
          }]
        }
      }
    },
    getFlag(scope, key) {
      return this.flags[scope]?.[key];
    },
    async update() {
      throw new Error("Actor must not be updated before resolving the ability");
    }
  };

  const { selectFocusAbility } = await import(
    "../../module/applications/content-service.mjs"
  );

  assert.equal(await selectFocusAbility(actor, "second"), false);
});

test("getInitialFocusAbilityChoices resolves standalone tier-one abilities", async () => {
  globalThis.fromUuid = async uuid => ({
    type: "ability",
    id: uuid.endsWith("first") ? "first" : "second",
    uuid,
    name: uuid.endsWith("first") ? "First Ability" : "Second Ability",
    system: {
      tier: uuid.endsWith("first") ? 1 : 2,
      key: uuid,
      enabler: false,
      repeatable: false,
      cost: { stat: "none", amount: 0, options: [] },
      action: null
    }
  });

  const choices = await getInitialFocusAbilityChoices({
    type: "focus",
    system: {
      abilities: [
        "Compendium.test.abilities.Item.first",
        "Compendium.test.abilities.Item.second"
      ],
      flowchart: {
        edges: [{ from: "first", to: "second" }]
      }
    }
  });

  assert.deepEqual(choices.map(ability => ability.id), ["first"]);
  assert.equal(choices[0].name, "First Ability");
});
