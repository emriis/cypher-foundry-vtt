/**
 * Own the temporary checkout lifecycle used by Node and live Foundry tests.
 * Copy editable work, exclude private/generated data, and share installed
 * dependencies through a link. A marker and path checks protect cleanup.
 */
import { cp, lstat, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PREFIX = "cypher-validation-";
const MARKER = ".cypher-validation-owner";
const EXCLUDED = new Set([
  ".git", ".codex", ".aws", "node_modules", "dist", "test-results",
  "playwright-report", "coverage", "reports", "foundry-data", "Data",
  "worlds", "modules-local", "systems-local"
]);

/**
 * Copy the working checkout, including uncommitted edits, without private data.
 * This writes only to OS temporary storage and links the existing node_modules.
 * @param {string} sourceRoot Repository root whose current files should be tested.
 * @returns {Promise<{workspace: string, root: string}>} Owned temp directory and checkout path.
 */
export async function createValidationWorkspace(sourceRoot) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), PREFIX));
  const root = path.join(workspace, "checkout");
  try {
    await writeFile(path.join(workspace, MARKER), path.basename(workspace));
    await lstat(path.join(sourceRoot, "node_modules"));
    await cp(sourceRoot, root, {
      recursive: true,
      filter: async source => {
        const relative = path.relative(sourceRoot, source).split(path.sep);
        if (EXCLUDED.has(relative[0]) || relative[0].startsWith(".env")
            || (relative[0] === "docs" && relative[1] === "local")) return false;
        // Do not traverse user-owned junctions or symlinks while copying.
        return !(await lstat(source)).isSymbolicLink();
      }
    });
    // Dependencies are read from the existing installation; never run npm ci
    // against this junction or use it as the destination of a build.
    await symlink(path.join(sourceRoot, "node_modules"), path.join(root, "node_modules"),
      process.platform === "win32" ? "junction" : "dir");
    return { workspace, root };
  } catch (error) {
    // This path came directly from mkdtemp above, including when marker creation failed.
    if (path.dirname(workspace) !== path.resolve(os.tmpdir()) || !path.basename(workspace).startsWith(PREFIX)) throw error;
    try { await rm(workspace, { recursive: true, force: true }); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "Workspace creation and cleanup failed"); }
    throw error;
  }
}

/**
 * Verify a temporary directory created and marked by this helper.
 * All ownership checks must pass before reuse or recursive cleanup.
 * @param {string} workspace Owned temp directory, not its checkout subdirectory.
 * @returns {Promise<string>} Absolute owned path; rejects an unowned/missing marker.
 */
export async function assertValidationWorkspace(workspace) {
  const resolved = path.resolve(workspace);
  const marker = await readFile(path.join(resolved, MARKER), "utf8").catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (path.dirname(resolved) !== path.resolve(os.tmpdir())
      || !path.basename(resolved).startsWith(PREFIX)
      || marker !== path.basename(resolved)) {
    throw new Error("Refusing to remove an unowned validation workspace.");
  }
  return resolved;
}

/** Verify ownership before reusing a normalized temporary checkout. */
export async function assertValidationCheckout(root) {
  const resolved = path.resolve(root);
  if (path.basename(resolved) !== "checkout") throw new Error("Expected an owned validation checkout");
  await assertValidationWorkspace(path.dirname(resolved));
  return resolved;
}

/** Delete only a marked temporary workspace, after verifying its absolute path. */
export async function removeValidationWorkspace(workspace) {
  const resolved = await assertValidationWorkspace(workspace);
  await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
}
