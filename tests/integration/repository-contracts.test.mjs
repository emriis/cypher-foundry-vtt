// Checks repository-wide contracts such as manifest paths and matching locale keys.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readPackSourceMap, readPackSources as canonicalPackSources } from "../helpers/canonical-sources.mjs";

const root = path.resolve(import.meta.dirname, "../..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function flattenKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === "object" && !Array.isArray(entry)
      ? flattenKeys(entry, fullKey)
      : [fullKey];
  });
}

test("Foundry manifest points to existing system entry points, locales, and pack sources", () => {
  const manifest = readJson("system.json");

  assert.equal(manifest.id, "cypher");
  assert.equal(manifest.manifest, `${manifest.url}/releases/latest/download/system.json`);
  assert.equal(manifest.download, `${manifest.url}/releases/download/v${manifest.version}/system.zip`);
  for (const file of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(language => language.path)]) {
    assert.ok(fs.existsSync(path.join(root, file)), `Manifest resource does not exist: ${file}`);
  }

  const actorTypes = Object.keys(manifest.documentTypes.Actor);
  assert.deepEqual(actorTypes, ["pc", "npc", "community"]);
  for (const type of ["skill", "ability", "cypher", "artifact", "equipment", "attack", "armor", "shield", "descriptor", "type", "focus"]) {
    assert.ok(manifest.documentTypes.Item[type], `Item type missing from manifest: ${type}`);
  }

  for (const pack of manifest.packs) {
    assert.ok(fs.existsSync(path.join(root, pack.path.replace(/-fr$/, "-en"), "_source")),
      `Canonical pack source does not exist: ${pack.path}`);
    assert.ok(["Item", "JournalEntry"].includes(pack.type));
    assert.equal(pack.system, manifest.id);
  }
});

test("French compendium source directories are absent and only English authoring remains", () => {
  for (const family of ["abilities", "descriptors", "equipment", "foci", "rules", "skills", "types"]) {
    assert.equal(fs.existsSync(path.join(root, "packs", family + "-fr", "_source")), false,
      "Legacy French authoring returned: " + family);
    assert.ok(readPackSourceMap(root, family + "-fr").size > 0, "Missing generated French view: " + family);
  }
});

test("French and English locales expose the same keys and interpolation variables", () => {
  const en = readJson("lang/en.json");
  const fr = readJson("lang/fr.json");
  const enKeys = flattenKeys(en).sort();
  const frKeys = flattenKeys(fr).sort();

  assert.deepEqual(frKeys, enKeys);

  for (const key of enKeys) {
    const valueAt = (object, dottedKey) => dottedKey.split(".").reduce((value, part) => value[part], object);
    const placeholders = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(valueAt(fr, key)), placeholders(valueAt(en, key)), `Interpolation mismatch at ${key}`);
  }
});

test("locale interpolation placeholders use Foundry's single-brace format", () => {
  for (const file of ["lang/en.json", "lang/fr.json"]) {
    const locale = readJson(file);
    for (const key of flattenKeys(locale)) {
      const value = key.split(".").reduce((entry, part) => entry[part], locale);
      assert.doesNotMatch(value, /\{\{|\}\}/, `${file}/${key}`);
    }
  }
});

test("each declared pack has a canonical English source set and generated French view", () => {
  const manifest = readJson("system.json");
  const failures = [];

  for (const pack of manifest.packs) {
    const records = readPackSourceMap(root, pack.path.replace(/^packs\//, ""));
    const sourceFiles = [...records.keys()];
    if (sourceFiles.length === 0) {
      failures.push(`${pack.name}: pack has no JSON source files`);
      continue;
    }

    for (const file of sourceFiles) {
      const item = records.get(file);
      const label = `${pack.name}/${file}`;

      if (item._key.startsWith("!folders!")) {
        if (!/^!folders![A-Za-z0-9]{16}$/.test(item._key)) {
          failures.push(`${label}: invalid folder compendium key: ${item._key}`);
        }
        if (item.type !== "Item") failures.push(`${label}: folder type must be Item`);
        if (!item.name) failures.push(`${label}: folder name is missing`);
        continue;
      }

      if (pack.type === "Item") {
        if (!manifest.documentTypes.Item[item.type]) {
          failures.push(`${label}: undeclared Item type: ${item.type}`);
        }
        if (!/^!items![A-Za-z0-9]{16}$/.test(item._key)) {
          failures.push(`${label}: invalid item compendium key: ${item._key}`);
        }
        if (item._id && item._key !== `!items!${item._id}`) {
          failures.push(`${label}: _key does not match _id: ${item._id}`);
        }
      } else {
        if (item.document !== "JournalEntry") failures.push(`${label}: document must be JournalEntry`);
        if (item.crdType !== "journal") failures.push(`${label}: crdType must be journal`);
        if (!/^!journal![A-Za-z0-9]{16}$/.test(item._key)) {
          failures.push(`${label}: invalid JournalEntry key: ${item._key}`);
        }
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"));
});

test("DocumentSheetV2 sheets declare their main part as the root content", () => {
  const contracts = [
    [
      "module/sheets/actor-pc-sheet.mjs",
      "templates/actor/pc.hbs",
      "templates/actor/parts/header.hbs",
      "templates/actor/parts/main.hbs"
    ],
    [
      "module/sheets/item-sheet.mjs",
      "templates/item/item.hbs",
      "templates/item/parts/header.hbs",
      "templates/item/parts/body.hbs"
    ],
    [
      "module/sheets/actor-npc-sheet.mjs",
      "templates/actor/npc.hbs",
      "templates/actor/npc/header.hbs",
      "templates/actor/npc/body.hbs"
    ],
    [
      "module/sheets/actor-community-sheet.mjs",
      "templates/actor/community.hbs",
      "templates/actor/community/header.hbs",
      "templates/actor/community/body.hbs"
    ]
  ];

  for (const [relativePath, rootTemplate, ...partials] of contracts) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.match(
      source,
      new RegExp(
        `sheet:\\s*\\{[\\s\\S]*?root:\\s*true[\\s\\S]*?template:\\s*"systems/cypher/${rootTemplate}"`
      ),
      `Invalid document sheet PARTS contract: ${relativePath}`
    );
    for (const partial of partials) {
      assert.ok(
        source.includes(`"systems/cypher/${partial}"`),
        `Root partial not registered: ${relativePath} -> ${partial}`
      );
    }

    const template = fs.readFileSync(path.join(root, rootTemplate), "utf8");
    assert.match(template, /^\s*\{\{!--[\s\S]*?\}\}\s*<div class="/);
  }
});

test("NPC model and sheet expose the core GM guide stat-block categories", () => {
  const model = fs.readFileSync(
    path.join(root, "module/data-models/actor-npc.mjs"),
    "utf8"
  );
  const template = fs.readFileSync(
    path.join(root, "templates/actor/npc/body.hbs"),
    "utf8"
  );

  for (const field of [
    "level", "health", "armor", "damage", "attacks", "movement", "modifications",
    "modificationsStructured",
    "description", "motive", "environment", "combat", "interaction", "use",
    "loot", "gmIntrusion", "gmNotes"
  ]) {
    assert.match(model, new RegExp("\\b" + field + "\\s*:"));
  }

  for (const field of [
    "description", "motive", "environment", "combat", "interaction",
    "use", "loot", "gmIntrusion", "gmNotes"
  ]) {
    assert.ok(
      template.includes("system." + field),
      "NPC sheet does not expose system." + field
    );
  }

  assert.match(model, /get targetNumber\(\)\s*\{\s*return this\.level \* 3;/);
});
 

test("NPC structured combat data exposes numeric, wound, and Pool damage modes", () => {
  const model = fs.readFileSync(
    path.join(root, "module/data-models/actor-npc.mjs"),
    "utf8"
  );

  assert.match(model, /attacks:\s*new ArrayField\(new SchemaField/);
  assert.match(model, /mode:\s*new StringField\([\s\S]*choices:\s*\["numeric", "wound", "pool"\]/);
  assert.match(model, /ignoresArmor:\s*new NumberField/);
  assert.match(model, /wounds:\s*new NumberField/);
  assert.match(model, /effects:\s*new ArrayField\(new SchemaField/);
  assert.match(model, /modificationsStructured:\s*new ArrayField\(new SchemaField/);
});
