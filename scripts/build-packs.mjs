/**
 * Builds Foundry-readable LevelDB packs from editable JSON sources.
 *
 * Ability content is authored as standalone Items and referenced by Types and
 * Foci through Document UUIDs.
 */
import { compilePack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
  const workspace = await fs.mkdtemp(
    path.join(os.tmpdir(), "cypher-packs-")
  );

  try {
    for (const pack of packs) {
      const source = path.join(root, "packs", pack, "_source");
      const output = path.join(workspace, pack);
      const destination = path.join(root, "packs", pack);

      console.log(`Building ${pack}...`);
      await compilePack(source, output, { recursive: true });

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
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

await compile();
