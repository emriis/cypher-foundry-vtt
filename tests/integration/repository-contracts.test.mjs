// Checks repository-wide contracts such as manifest paths and matching locale keys.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
    assert.ok(fs.existsSync(path.join(root, pack.path, "_source")), `Pack source does not exist: ${pack.path}`);
    assert.ok(["Item", "JournalEntry"].includes(pack.type));
    assert.equal(pack.system, manifest.id);
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

test("each declared pack has a corresponding language-specific source set", () => {
  const manifest = readJson("system.json");
  const failures = [];

  for (const pack of manifest.packs) {
    const sourceDirectory = path.join(root, pack.path, "_source");
    const sourceFiles = fs.readdirSync(sourceDirectory, { recursive: true }).filter(file => file.endsWith(".json"));
    if (sourceFiles.length === 0) {
      failures.push(`${pack.name}: pack has no JSON source files`);
      continue;
    }

    for (const file of sourceFiles) {
      const item = JSON.parse(fs.readFileSync(path.join(sourceDirectory, file), "utf8"));
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
    assert.ok(
      source.includes(`sheet: {
      template: "systems/cypher/${rootTemplate}"`),
      `Invalid document sheet PARTS contract: ${relativePath}`
    );
    assert.match(source, /sheet:\s*\{\s*root:\s*true/);
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

test("live E2E requires Chromium 146 or newer", () => {
  const packageJson = readJson("package.json");
  assert.equal(
    packageJson.devDependencies["@playwright/test"],
    "1.63.0"
  );

  const config = fs.readFileSync(
    path.join(root, "playwright.config.mjs"),
    "utf8"
  );
  assert.match(config, /browserName:\s*"chromium"/);
  assert.match(config, /channel:\s*"chromium"/);
  assert.match(config, /viewport:\s*\{ width: 1280, height: 900 \}/);
  assert.match(config, /deviceScaleFactor:\s*1/);
  assert.match(config, /force-device-scale-factor=1/);

  const fixture = fs.readFileSync(
    path.join(root, "tests/e2e/foundry-session-fixture.mjs"),
    "utf8"
  );
  assert.match(fixture, /const MIN_CHROMIUM_MAJOR = 146/);
  assert.match(fixture, /chromiumMajor < MIN_CHROMIUM_MAJOR/);
  assert.match(fixture, /browser\.version\(\)/);

  const preflight = fs.readFileSync(
    path.join(root, "scripts/check-playwright-browser.mjs"),
    "utf8"
  );
  assert.match(preflight, /MIN_CHROMIUM_MAJOR = 146/);
  assert.match(preflight, /chromium\.launch/);
  assert.match(preflight, /channel: "chromium"/);
  assert.match(preflight, /browser\.version\(\)/);
});

test("live E2E fixture keeps one browser page for the whole worker", () => {
  const fixture = fs.readFileSync(
    path.join(root, "tests/e2e/foundry-session-fixture.mjs"),
    "utf8"
  );

  assert.match(fixture, /e2ePage:\s*\[async \(\{ browser \}, use\)/);
  assert.match(fixture, /\{ scope: "worker" \}\]/);
  assert.doesNotMatch(fixture, /\bpage:\s*\[async/);

  for (const spec of [
    "tests/e2e/foundry-runtime.spec.mjs",
    "tests/e2e/foundry-gameplay.spec.mjs"
  ]) {
    const source = fs.readFileSync(path.join(root, spec), "utf8");
    assert.match(source, /\{\s*e2ePage:\s*page\s*\}/);
  }
});

test("live E2E login selects the Gamemaster independently of Foundry locale", () => {
  const source = fs.readFileSync(
    path.join(root, "tests/e2e/foundry-session.mjs"),
    "utf8"
  );

  assert.match(
    source,
    /game\\s\*master\|gamemaster\|ma\[iî\]tre\\s\+de\\s\+jeu/
  );
  assert.match(source, /Available users:/);
  assert.match(source, /ancestor::form\[1\]/);
  assert.match(
    source,
    /button\[type="submit"\], input\[type="submit"\]/
  );
  assert.match(source, /requestSubmit/);
});

test("live E2E runner invokes every committed Playwright spec explicitly", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/run-foundry-e2e.mjs"),
    "utf8"
  );
  const specs = [
    "tests/e2e/foundry-runtime.spec.mjs",
    "tests/e2e/foundry-gameplay.spec.mjs"
  ];

  for (const spec of specs) {
    assert.ok(
      source.includes(`"${spec}"`),
      `E2E runner does not explicitly invoke: ${spec}`
    );
    assert.ok(
      fs.existsSync(path.join(root, spec)),
      `Declared E2E spec does not exist: ${spec}`
    );
  }
  assert.match(source, /const testArgs = \[[\s\S]*\.\.\.E2E_SPECS/);
});

test("live E2E uses a Windows process boundary for Foundry and scripts", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/run-foundry-e2e.mjs"),
    "utf8"
  );

  assert.match(
    source,
    /function spawnFoundry\(appPath, userDataPath\)[\s\S]*?if \(process\.platform === "win32"\)/
  );
  assert.match(
    source,
    /function spawnScript\(command, args, options = \{\}\)/
  );
  assert.match(source, /powershell\.exe/);
  assert.match(source, /Start-Process -FilePath/);
  assert.match(source, /FOUNDRY_EXE/);
  assert.match(source, /FOUNDRY_ARGS_JSON/);
  assert.match(source, /--dataPath=\$\{userDataPath\}/);
  assert.match(source, /spawn\(appPath, args,/);
});

test("live E2E cleanup is scoped to its generated world", () => {
  const source = fs.readFileSync(
    path.join(root, "scripts/run-foundry-e2e.mjs"),
    "utf8"
  );

  assert.match(source, /const worldPath = path\.join\(dataPath, "worlds", WORLD_ID\)/);
  assert.match(source, /if \(worldCreated\) \{/);
  assert.match(source, /await rm\(worldPath, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(source, /await rm\(dataPath, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(source, /mkdtemp\(path\.join\(os\.tmpdir\(\)/);
  assert.match(source, /process\.env\.FOUNDRY_DATA_PATH/);
  assert.match(source, /const \{ userDataPath, dataPath \} = await getFoundryPaths\(\)/);
  assert.match(source, /path\.join\(userDataPath, "Data"\)/);
  assert.match(source, /path\.join\(userDataPath, "Config", "license\.json"\)/);
  assert.match(source, /playwright.*install.*chromium/);
});

test("repository does not contain machine-specific local paths", () => {
  const files = [
    "scripts",
    "tests",
    "docs",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "README.md"
  ];
  const forbidden = [
    String.raw`[A-Za-z]:\\Users\\(?!<USER>)(?!user)(?!example)(?!test)[^\\\s]+\\AppData\\Local\\FoundryVTT`,
    String.raw`[A-Za-z]:\\Users\\(?!<USER>)(?!user)(?!example)(?!test)[^\\\s]+\\`,
    String.raw`(?:^|[\\s"'\`])/(?:Users|home)/(?!<USER>)(?!user)(?!example)(?!test)[^\\s"'\`]+`
  ];
  const offenders = [];
  const visit = relativePath => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;
    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolutePath)) {
        if (![".git", "node_modules", "dist"].includes(entry)) {
          visit(path.join(relativePath, entry));
        }
      }
      return;
    }
    const source = fs.readFileSync(absolutePath, "utf8");
    if (forbidden.some(pattern => pattern.test(source))) {
      offenders.push(relativePath);
    }
  };
  for (const file of files) visit(file);
  assert.deepEqual(
    offenders,
    [],
    `Machine-specific local path found in: ${offenders.join(", ")}`
  );
});

test("static localization keys used by templates and modules exist in both locales", () => {
  const locales = ["lang/en.json", "lang/fr.json"].map(readJson);
  const localeKeySets = locales.map(locale => new Set(flattenKeys(locale)));

  const sourceFiles = [
    "templates/actor/community/body.hbs",
    "templates/actor/community/header.hbs",
    "templates/actor/npc/body.hbs",
    "templates/actor/npc/header.hbs",
    "templates/actor/parts/abilities.hbs",
    "templates/actor/parts/advancement.hbs",
    "templates/actor/parts/biography.hbs",
    "templates/actor/parts/header.hbs",
    "templates/actor/parts/inventory.hbs",
    "templates/actor/parts/main.hbs",
    "templates/actor/parts/skills.hbs",
    "templates/item/parts/body.hbs",
    "templates/item/parts/header.hbs"
  ];

  const keys = new Set();
  const pattern = /localize\s+['"]([^'"]+)['"]/g;

  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    for (const match of source.matchAll(pattern)) {
      keys.add(match[1]);
    }
  }

  for (const key of keys) {
    for (const localeKeys of localeKeySets) {
      assert.ok(localeKeys.has(key), `Missing locale key: ${key}`);
    }
  }
});
