/**
 * Builds Foundry-readable LevelDB packs from the editable JSON sources.
 *
 * Normalize a disposable checkout before selecting source-hashed translations.
 * Compile every pack before publishing generated files; authoring JSON and
 * proposal review statuses stay unchanged, including for legacy input sources.
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readCompendiumCatalogue, readFrenchProposals } from "./review-translations.mjs";
import { materializeTranslations } from "./localization/materialize-translations.mjs";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";

const root = path.resolve(import.meta.dirname, "..");
async function discoverPacks(checkoutRoot) {
  const packsRoot = path.join(checkoutRoot, "packs");
  const entries = await fs.readdir(packsRoot, { withFileTypes: true });

  const packNames = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.endsWith("-en") && !entry.name.endsWith("-fr")) continue;

    const source = path.join(packsRoot, entry.name, "_source");
    try {
      await fs.access(source);
      packNames.push(entry.name);
    } catch {
      // Ignore directories that are not authored compendium packs.
    }
  }

  return packNames.sort();
}

const FOUNDRY_ID_PATTERN = /^[A-Za-z0-9]{16}$/;

function stableId(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0") +
    value.replace(/[^A-Za-z0-9]/g, "").slice(0, 9).padEnd(9, "0");
}

function normalizeId(id, relativePath) {
  if (typeof id === "string" && FOUNDRY_ID_PATTERN.test(id)) return id;
  if (typeof id === "string" && /^[A-Za-z0-9]+$/.test(id) && id.length < 16) {
    return id + stableId(relativePath).slice(0, 16 - id.length);
  }
  return stableId(relativePath + ":" + String(id ?? ""));
}

/** Apply validated display overlays and repair legacy Folder IDs only in compiler input. */
async function normalizeSourceTree(checkoutRoot, sourceRoot, normalizedRoot, translations) {
  await fs.cp(sourceRoot, normalizedRoot, { recursive: true });

  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

      const relativePath = path.relative(normalizedRoot, entryPath).replaceAll(path.sep, "/");
      const sourceFile = path.relative(checkoutRoot, path.join(sourceRoot, relativePath)).replaceAll(path.sep, "/");
      const data = structuredClone(translations.get(sourceFile) ?? JSON.parse(await fs.readFile(entryPath, "utf8")));
      const normalizedId = normalizeId(data._id, relativePath);
      data._id = normalizedId;

      if (typeof data._key === "string") {
        const match = data._key.match(/^!(items|folders)!/);
        if (match) data._key = `!${match[1]}!${normalizedId}`;
      }

      await fs.writeFile(
        entryPath,
        JSON.stringify(data, null, 2) + "\n",
        "utf8"
      );
    }
  }

  await visit(normalizedRoot);
}

async function compile() {
  const { workspace, root: checkoutRoot } = await createValidationWorkspace(root);
  try {
    // The migrator binds its root to import.meta.dirname. Execute the copied
    // script, rather than importing the author's script and mutating its checkout.
    console.log("Normalizing temporary compendium sources...");
    await promisify(execFile)(process.execPath, ["scripts/migrate-ability-sources.mjs"],
      { cwd: checkoutRoot, maxBuffer: 8 * 1024 * 1024 });
    const packs = await discoverPacks(checkoutRoot);
    const [catalogue, proposals] = await Promise.all([
      readCompendiumCatalogue(checkoutRoot), readFrenchProposals(checkoutRoot)
    ]);
    const translations = materializeTranslations(catalogue, proposals,
      { includeProposed: process.argv.includes("--include-proposed") });

    // Complete validation and compilation before touching existing outputs.
    // A compiler failure in a later pack must preserve every previous database.
    for (const pack of packs) {
      const source = path.join(checkoutRoot, "packs", pack, "_source");
      const normalizedSource = path.join(workspace, `${pack}-source`);
      const output = path.join(workspace, pack);

      await normalizeSourceTree(checkoutRoot, source, normalizedSource, translations);
      console.log(`Building ${pack}...`);
      await compilePack(normalizedSource, output, { recursive: true });
    }

    for (const pack of packs) {
      const destination = path.join(root, "packs", pack);
      const output = path.join(workspace, pack);
      // Remove the previous compiled database, but keep the editable source directory.
      const entries = await fs.readdir(destination);
      for (const entry of entries) {
        if (entry !== "_source") {
          await fs.rm(path.join(destination, entry), {
            recursive: true,
            force: true
          });
        }
      }

      for (const entry of await fs.readdir(output)) {
        await fs.cp(
          path.join(output, entry),
          path.join(destination, entry),
          { recursive: true }
        );
      }
    }
  } finally {
    // Always remove the temporary workspace, even when one pack fails to compile.
    await removeValidationWorkspace(workspace);
  }
}

await compile();
