/** Unknown folders and nested regressions must not silently escape validation. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { discoverTests } from "../../scripts/test-suites.mjs";
import { withTemporaryDirectory } from "../helpers/temporary-directory.mjs";

test("suite discovery includes nested models and keeps costly or licensed suites explicit", async () => {
  await withTemporaryDirectory(async root => {
    for (const directory of ["data-models/nested", "source-migrations", "e2e", "build"]) {
      await mkdir(path.join(root, "tests", directory), { recursive: true });
    }
    for (const file of ["data-models/nested/model.test.mjs", "source-migrations/catalogue.test.mjs", "build/pack.test.mjs", "e2e/third.spec.mjs"]) {
      await writeFile(path.join(root, "tests", file), "");
    }
    assert.deepEqual(await discoverTests(root, "unit"), ["tests/data-models/nested/model.test.mjs"]);
    assert.equal((await discoverTests(root, "all")).length, 2);
    assert.deepEqual(await discoverTests(root, "e2e"), ["tests/e2e/third.spec.mjs"]);
    await mkdir(path.join(root, "tests", "forgotten"));
    await writeFile(path.join(root, "tests/forgotten/new.test.mjs"), "");
    await assert.rejects(discoverTests(root), /Unclassified test.*forgotten/);
  });
});

test("every repository test has an explicit suite owner", async () => {
  assert.ok((await discoverTests(path.resolve(import.meta.dirname, "../.."))).length > 0);
});
