import assert from "node:assert/strict";
import test from "node:test";

const { migrateWorld } = await import("../../module/migration.mjs");

test("the alpha migration entry point is a no-op until a real world migration is required", async () => {
  await assert.doesNotReject(() => migrateWorld());
});
