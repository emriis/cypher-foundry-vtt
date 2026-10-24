/** Cancelled GM inputs must not declare a hazard or advance its occurrence. */
import assert from "node:assert/strict";
import test from "node:test";
import { promptEnvironment, promptEnvironmentExposure } from "../../module/sheets/environment-dialogs.mjs";

test("cancelled declarations and interval confirmations leave all state unchanged", async () => {
  const gm = { id: "gm", isGM: true }, prompts = [];
  globalThis.game = { user: gm, users: { activeGM: gm }, time: { worldTime: 10 }, i18n: { localize: key => key } };
  globalThis.foundry = { applications: { api: { DialogV2: {
    prompt: async options => { prompts.push(options); return null; }, confirm: async () => false
  } } } };
  const actor = { type: "pc", uuid: "Actor.pc", flags: { cypher: { environmentalExposures: [
    { version: 1, id: "exposure", state: "ready", sequence: 1, nextAt: 20, profile: {} }
  ] } }, update() { assert.fail("Cancelled environmental input wrote Actor state"); } };
  await promptEnvironment.call({ actor });
  assert.equal(prompts[0].rejectClose, false);
  await promptEnvironmentExposure.call({ actor }, null, { dataset: { exposureId: "exposure", sequence: "1" } });
});
