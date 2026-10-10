import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createValidationWorkspace, removeValidationWorkspace } from "../../scripts/validation-workspace.mjs";

test("isolated validation includes edits but excludes private references and preserves source/dependencies", async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), "cypher-validation-fixture-"));
  let copy;
  try {
    await mkdir(path.join(source, "node_modules"));
    await writeFile(path.join(source, "node_modules", "sentinel"), "dependency");
    await mkdir(path.join(source, "packs"));
    await writeFile(path.join(source, "packs", "edited.json"), "uncommitted source");
    await mkdir(path.join(source, "docs", "private"), { recursive: true });
    await writeFile(path.join(source, "docs", "private", "sentinel"), "private");
    await symlink(path.join(source, "docs", "private"), path.join(source, "docs", "local"),
      process.platform === "win32" ? "junction" : "dir");
    await writeFile(path.join(source, ".env"), "secret");
    copy = await createValidationWorkspace(source);
    assert.equal(await readFile(path.join(copy.root, "packs", "edited.json"), "utf8"), "uncommitted source");
    await assert.rejects(access(path.join(copy.root, "docs", "local")));
    await assert.rejects(access(path.join(copy.root, ".env")));
    await writeFile(path.join(copy.root, "packs", "edited.json"), "normalized");
    await removeValidationWorkspace(copy.workspace);
    copy = null;
    assert.equal(await readFile(path.join(source, "packs", "edited.json"), "utf8"), "uncommitted source");
    assert.equal(await readFile(path.join(source, "node_modules", "sentinel"), "utf8"), "dependency");
    assert.equal(await readFile(path.join(source, "docs", "local", "sentinel"), "utf8"), "private");
    await assert.rejects(removeValidationWorkspace(source), /unowned/);
  } finally {
    if (copy) await removeValidationWorkspace(copy.workspace);
    await rm(source, { recursive: true, force: true });
  }
});
