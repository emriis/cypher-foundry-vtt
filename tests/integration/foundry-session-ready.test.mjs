/** Surface the bootstrap error instead of attributing it to the first gameplay scenario. */
import assert from "node:assert/strict";
import test from "node:test";
import { waitForFoundryReady } from "../e2e/foundry-session.mjs";

/** Model only the browser state boundary; no startup timer or real Foundry world is needed. */
function startupPage(states) {
  let reads = 0, waits = 0;
  return {
    page: {
      evaluate: async () => states[Math.min(reads++, states.length - 1)],
      waitForTimeout: async () => { waits++; },
      url: async () => states.at(-1).url
    },
    reads: () => reads,
    waits: () => waits
  };
}
const booting = { ready: false, view: "game", url: "http://127.0.0.1:30000/game", title: "Cypher", body: "" };

test("Given a loading client, when Foundry becomes ready, then the session opens only after actual client initialization", async () => {
  const fixture = startupPage([booting, { ...booting, ready: true }]);
  await waitForFoundryReady(fixture.page);
  assert.equal(fixture.reads(), 2);
  assert.equal(fixture.waits(), 1);
});

test("Given invalid world bootstrap data, when the browser reports a fatal initialization error, then login fails immediately with its cause and page state", async () => {
  const fixture = startupPage([booting, { ...booting, ready: true }]);
  const cause = new Error("[ReleaseData] generation, build and node_version may not be undefined");
  await assert.rejects(waitForFoundryReady(fixture.page, { startupError: () => cause }), error => {
    assert.equal(error.cause, cause);
    assert.match(error.message, /ReleaseData/);
    assert.match(error.message, /\/game/);
    return true;
  });
  assert.equal(fixture.waits(), 0, "Fatal bootstrap errors must not consume the whole readiness timeout");
});

test("Given an accidentally opened Setup screen, when readiness is checked, then login fails with the Setup content", async () => {
  const fixture = startupPage([{ ...booting, view: "setup", body: "Configuration and Setup" }]);
  await assert.rejects(waitForFoundryReady(fixture.page), /reached Setup.*URL:[\s\S]*Configuration and Setup/i);
  assert.equal(fixture.waits(), 0);
});

test("Given an unfinished bootstrap without a browser exception, when readiness expires, then the last client state is retained", async () => {
  const fixture = startupPage([{ ...booting, title: "Still loading", body: "Loading world data" }]);
  await assert.rejects(waitForFoundryReady(fixture.page, { timeoutMs: 0 }), /Still loading[\s\S]*Loading world data/);
});
