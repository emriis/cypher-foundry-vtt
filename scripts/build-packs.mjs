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
import { migrateAbilitySources } from "./migrate-ability-sources.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packs = [
  "descriptors-en",
  "descriptors-fr",
  "abilities-en",
  "abilities-fr",
  "types-en",
  "types-fr",
  "foci-en",
  "foci-fr"
];

async function compile() {
  await migrateAbilitySources();
  // Keep intermediate compiler output outside the repository's pack folders.
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "cypher-packs-"));

  try {
    for (const pack of packs) {
      const source = path.join(root, "packs", pack, "_source");
      const output = path.join(workspace, pack);
      const destination = path.join(root, "packs", pack);

      console.log(`Building ${pack}...`);
      await compilePack(source, output, { recursive: true });

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
