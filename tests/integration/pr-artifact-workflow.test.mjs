/** Regression: bot commits made with GITHUB_TOKEN create approval-required PR reruns. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PR artifact preparation validates and publishes outputs without modifying the PR branch", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/prepare-generated.yml", import.meta.url), "utf8");
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write|git\s+(?:push|commit)|pull_request_target/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /npm run build:packs/);
  assert.match(workflow, /verify-package\.mjs/);
  assert.match(workflow, /dist\/system\.zip/);
});
