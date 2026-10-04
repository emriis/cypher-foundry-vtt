// Covers legacy Type and Focus content compatibility transformations.
import assert from "node:assert/strict";
import test from "node:test";

const {
  migrateWorldTypeAndFocusAbilities,
  inferLegacyAbilityAction,
  slugLegacyAbilityName
} = await import("../../module/migrations/legacy-content-migrations.mjs");

test("legacy ability helpers normalize action metadata and generated keys", () => {
  assert.equal(
    inferLegacyAbilityAction({
      description: "Do something. Action."
    }),
    "action"
  );
  assert.equal(
    inferLegacyAbilityAction({
      enabler: true,
      description: "Do something. Action."
    }),
    null
  );
  assert.equal(slugLegacyAbilityName("Éclaireur: À l'épée"), "eclaireur-a-l-epee");
});

test("migrateWorldTypeAndFocusAbilities converts embedded Focus abilities to references", async () => {
  const created = [];
  const focus = {
    type: "focus",
    uuid: "Item.focus",
    _source: {
      system: {
        abilities: [
          {
            id: "ability-one",
            name: "First Ability",
            tier: 1,
            enabler: true
          },
          {
            id: "ability-two",
            name: "Second Ability",
            tier: 2,
            prerequisites: ["ability-one"],
            description: "Do something. Action."
          }
        ]
      }
    },
    async update(changes) {
      this.lastUpdate = changes;
      this._source.system.abilities = changes["system.abilities"];
      this._source.system.flowchart = changes["system.flowchart"];
    }
  };

  globalThis.Item = {
    create: async data => {
      const document = {
        ...data,
        id: `created-${created.length + 1}`,
        uuid: `Item.created-${created.length + 1}`
      };
      created.push(document);
      return document;
    }
  };
  globalThis.game = { items: [focus] };

  await migrateWorldTypeAndFocusAbilities();

  assert.equal(created.length, 2);
  assert.deepEqual(focus.lastUpdate["system.abilities"], [
    "Item.created-1",
    "Item.created-2"
  ]);
  assert.deepEqual(focus.lastUpdate["system.flowchart"], {
    edges: [{ from: "created-1", to: "created-2" }]
  });
  assert.equal(created[1].system.action, "action");
});
