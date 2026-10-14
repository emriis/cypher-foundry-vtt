/** The first local test login must not depend on a public IP discovery service. */
import assert from "node:assert/strict";
import test from "node:test";
import { foundryServerArguments } from "../../scripts/foundry-server-options.mjs";

test("Given a disposable Foundry world, when its local Node server launches, then public IP discovery and router mapping are disabled without changing its Data boundary", () => {
  const userDataPath = "C:/owned test workspace/foundry-user-data";
  const args = foundryServerArguments({ port: 30001, worldId: "cypher-e2e-test", userDataPath });
  assert.ok(args.includes("--noipdiscovery"), "The first login must not wait for the public invitation-address discovery service");
  assert.ok(args.includes("--noupnp"));
  assert.ok(args.includes("--noupdate"));
  assert.ok(args.includes("--port=30001"));
  assert.ok(args.includes("--world=cypher-e2e-test"));
  assert.ok(args.includes(`--dataPath=${userDataPath}`), "The complete owned path must remain a single argument");
});
