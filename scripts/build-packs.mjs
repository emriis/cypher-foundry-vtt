/**
 * Builds Foundry-readable LevelDB packs from the editable JSON sources.
 *
 * The script compiles into a temporary workspace first, then replaces each
 * pack's generated files while preserving its `_source` authoring directory.
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
async function discoverPacks() {
  const packsRoot = path.join(root, "packs");
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

const packs = await discoverPacks();

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

async function normalizeSourceTree(sourceRoot, normalizedRoot) {
  await fs.cp(sourceRoot, normalizedRoot, { recursive: true });

  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

      const relativePath = path.relative(normalizedRoot, entryPath);
      const data = JSON.parse(await fs.readFile(entryPath, "utf8"));
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
  // Keep intermediate compiler output outside the repository's pack folders.
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "cypher-packs-"));

  try {
    for (const pack of packs) {
      const source = path.join(root, "packs", pack, "_source");
      const normalizedSource = path.join(workspace, `${pack}-source`);
      const output = path.join(workspace, pack);

      await normalizeSourceTree(source, normalizedSource);
      const destination = path.join(root, "packs", pack);

      console.log(`Building ${pack}...`);
      await compilePack(normalizedSource, output, { recursive: true });

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
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

await compile();
