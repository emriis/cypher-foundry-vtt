/** Locate editable source JSON; generated LevelDB files are never the authoring surface.
 * Node directory reads only; normalization helpers own source-file writes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { root } from "./context.mjs";

/**
 * List editable JSON records in a stable, locale-independent filename order.
 * Filesystem enumeration order must not decide duplicate or provenance precedence.
 * @param {string} pack Pack directory name, including language suffix.
 * @returns {Promise<string[]>} Absolute paths to the pack's editable JSON records.
 */
export async function sourceFiles(pack) {
  const dir = path.join(root, "packs", pack, "_source");
  return (await fs.readdir(dir))
    .filter(file => file.endsWith(".json"))
    .sort()
    .map(file => path.join(dir, file));
}
