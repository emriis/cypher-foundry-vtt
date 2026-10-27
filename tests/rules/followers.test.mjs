import assert from "node:assert/strict";
import test from "node:test";
import { followerProgression, followerHelpAssets, followerReplacementLevel } from "../../module/rules/followers.mjs";

test("a follower acquired at tier two gains at tiers four and six, including advancement beyond six", () => {
  assert.deepEqual(followerProgression(2, 2), { earned: 0, pending: 0 });
  assert.deepEqual(followerProgression(2, 3), { earned: 0, pending: 0 });
  assert.deepEqual(followerProgression(2, 4), { earned: 1, pending: 1 });
  assert.deepEqual(followerProgression(2, 6, 1), { earned: 2, pending: 1 });
  assert.deepEqual(followerProgression(2, 8, 2), { earned: 3, pending: 1 });
});

test("already applied progression never repeats or reverses after a tier correction", () => {
  assert.deepEqual(followerProgression(2, 6, 2), { earned: 2, pending: 0 });
  assert.deepEqual(followerProgression(2, 3, 2), { earned: 2, pending: 0 });
  assert.deepEqual(followerProgression(4, 2), { earned: 0, pending: 0 });
});

test("help grants two assets at effective task level five, including task-specific modifications", () => {
  assert.equal(followerHelpAssets(4), 1);
  assert.equal(followerHelpAssets(5), 2);
  assert.equal(followerHelpAssets(3, 5), 2);
  assert.equal(followerHelpAssets(5, 3), 1);
});

test("replacement retains the prior follower's tier increases and explicit extra improvements", () => {
  assert.equal(followerReplacementLevel(2, 2, 1), 5);
  assert.equal(followerReplacementLevel(3, 2), 5);
});

test("malformed tiers, levels and improvement counts cannot grant follower benefits", () => {
  for (const value of [null, "2", -1, 0, 1.5, NaN]) {
    assert.equal(followerProgression(value, 4), null);
    assert.equal(followerHelpAssets(value), null);
    assert.equal(followerReplacementLevel(value, 1), null);
  }
  assert.equal(followerProgression(1, 4, -1), null);
  assert.equal(followerHelpAssets(3, -1), null);
  assert.equal(followerReplacementLevel(2, 1, -1), null);
});
