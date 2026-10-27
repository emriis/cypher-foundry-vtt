import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { applyDefenseConsequences, reconcileDefenseConsequences } from "../../module/applications/defense-consequence-service.mjs";
import { blockStillHits } from "../../module/rules/general-effects.mjs";
import { applyDocumentUpdate } from "../helpers/document-updates.mjs";
let actor;
beforeEach(() => {
  actor = { uuid: "Actor.pc", type: "pc", isOwner: true, statuses: new Set(), flags: {}, items: new Map(), system: { hindered: false, dead: false,
    wounds: Object.fromEntries(["minor", "moderate", "major"].map(severity => [severity, { current: 0, max: 3 }])) },
    async update(changes) { applyDocumentUpdate(this, changes); }, async toggleStatusEffect() {} };
  actor.items.set("gift", { type: "ability", system: {}, flags: { cypher: { ruleBenefit: { version: 1, id: "descriptor.species.hellborn:0" } } } });
  globalThis.game = { i18n: { localize: key => key, format: key => key } };
  globalThis.ui = { notifications: { error() {} } }; globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => {} };
  globalThis.foundry = { utils: { escapeHTML: value => value } };
});
const hit = () => ({ defenseType: "block", success: false, applyIncomingWound: true, incomingSeverity: "moderate", incomingWounds: 1, incomingDamageTags: ["fire"], usingShield: false });

test("typed fire damage is reduced before PC overflow and a retained successful Block removes its actual prior contribution", async () => {
  const result = await applyDefenseConsequences(actor, hit()); assert.equal(actor.system.wounds.minor.current, 1); assert.equal(actor.system.wounds.moderate.current, 0);
  // An unrelated later wound remains after correcting this defense.
  actor.system.wounds.minor.current++;
  const correction = await reconcileDefenseConsequences(actor, { ...hit(), defenseConsequences: result.defenseConsequences }, { success: true }, async () => {}, null);
  assert.equal(correction.defenseConsequences.state, "corrected"); assert.equal(actor.system.wounds.minor.current, 1);
});

test("species resistance protects the PC while the shield still receives the original full wound", async () => {
  const shield = { id: "shield", type: "shield", actor, system: { equipped: true, wounds: {
    minor: { current: 0, max: 3 }, moderate: { current: 0, max: 2 }, major: { current: 0, max: 1 } } },
    async update(changes) { applyDocumentUpdate(this, changes); } };
  actor.items.set(shield.id, shield);
  const result = await applyDefenseConsequences(actor, { ...hit(), success: true, usingShield: true, shieldItem: shield });
  assert.equal(result.shieldWoundsAbsorbed, 1); assert.equal(shield.system.wounds.moderate.current, 1);
  assert.equal(actor.system.wounds.minor.current, 0);
});

test("interception is not triggered when Block and personal resistance already prevent the wound", () => {
  assert.equal(blockStillHits({ defenseType: "block", applyIncomingWound: true, incomingSeverity: "moderate", incomingWounds: 1, personalWoundReduction: 1 }), false);
  assert.equal(blockStillHits({ defenseType: "block", applyIncomingWound: true, incomingSeverity: "major", incomingWounds: 1, personalWoundReduction: 1 }), true);
});
