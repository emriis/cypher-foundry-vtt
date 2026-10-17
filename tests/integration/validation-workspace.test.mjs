import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createValidationWorkspace, removeValidationWorkspace, assertValidationCheckout } from "../../scripts/validation-workspace.mjs";

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

test("cleanup independently rejects missing markers, wrong markers, wrong parents and wrong prefixes", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "cypher-validation-fixture-"));
  const wrongPrefix = await mkdtemp(path.join(os.tmpdir(), "cypher-unowned-fixture-"));
  try {
    const nested = path.join(fixture, "cypher-validation-nested");
    await mkdir(nested);
    for (const directory of [fixture, nested, wrongPrefix]) {
      await writeFile(path.join(directory, "sentinel"), "keep");
      if (directory !== fixture) await writeFile(path.join(directory, ".cypher-validation-owner"), path.basename(directory));
      await assert.rejects(removeValidationWorkspace(directory), /unowned/);
      assert.equal(await readFile(path.join(directory, "sentinel"), "utf8"), "keep");
    }
    await writeFile(path.join(fixture, ".cypher-validation-owner"), "wrong");
    await assert.rejects(removeValidationWorkspace(fixture), /unowned/);
    await assert.rejects(assertValidationCheckout(path.join(fixture, "checkout")), /unowned/);
    await assert.rejects(assertValidationCheckout(fixture), /owned validation checkout/);
  } finally {
    await rm(fixture, { recursive: true, force: true });
    await rm(wrongPrefix, { recursive: true, force: true });
  }
});

test("a missing dependency directory rejects workspace creation rather than leaving a dangling dependency link", async () => {
  const source = await mkdtemp(path.join(os.tmpdir(), "cypher-validation-fixture-"));
  try { await assert.rejects(createValidationWorkspace(source), /ENOENT/); }
  finally { await rm(source, { recursive: true, force: true }); }
});
