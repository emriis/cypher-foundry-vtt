import assert from "node:assert/strict";
import test from "node:test";
import { compileBeforePublish } from "../../scripts/pack-publication.mjs";

test("a late compiler error publishes none of the earlier successful candidates", async () => {
  const published = [];
  await assert.rejects(compileBeforePublish(["first", "last"], async name => {
    if (name === "last") throw new Error("compiler failed");
  }, async name => { published.push(name); }), /compiler failed/);
  assert.deepEqual(published, []);
});

test("publication stops on error and reports the already committed prefix without retrying", async () => {
  const compiled = [], published = [];
  await assert.rejects(compileBeforePublish(["first", "last"], async name => { compiled.push(name); }, async name => {
    assert.deepEqual(compiled, ["first", "last"]);
    if (name === "last") throw new Error("copy failed");
    published.push(name);
  }), /copy failed/);
  assert.deepEqual(published, ["first"]);
});
