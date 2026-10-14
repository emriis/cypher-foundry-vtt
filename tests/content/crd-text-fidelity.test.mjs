import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { abilityPassages, compareText, plainText, reviewedPassage } from "../../scripts/crd-audit/text-fidelity.mjs";
import { auditAutomation } from "../../scripts/crd-audit/automation.mjs";
import { auditAbilityBaseCost } from "../../scripts/crd-audit/source-fields.mjs";

const root = path.resolve(import.meta.dirname, "../..");

test("Given CRD-verified passages, when English sources change, then their text remains source faithful", () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, "data/crd-text-fidelity.json"), "utf8"));
  const packs = new Map();
  const failures = [];
  for (const contract of baseline.fields) {
    const pack = contract.file.split("/")[1];
    if (!packs.has(pack)) {
      const directory = path.join(root, "packs", pack, "_source");
      packs.set(pack, fs.readdirSync(directory, { recursive: true }).filter(file => file.endsWith(".json"))
        .map(file => JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))));
    }
    const documents = packs.get(pack);
    const exactId = documents.find(document => document._id === contract.id);
    // Editorial callouts exist in the legacy authoring catalogue but the
    // documented normalizer excludes them from playable Ability packs.
    if (!exactId && contract.scope === "editorial-excluded-from-normalized-packs") {
      assert.match(contract.name, /GM intrusions/);
      assert.ok(!documents.some(document => document.name === contract.name));
      continue;
    }
    // Normalization may merge a duplicate or normalize an equipment ID. The
    // checked text must survive on the same named entry in the same family.
    const candidates = exactId ? [exactId] : documents.filter(document => document.name === contract.name);
    const matches = candidates.some(document => {
      const value = contract.field.split(".").reduce((value, key) => value?.[key], document);
      if (typeof value !== "string") return false;
      return createHash("sha256").update(plainText(value)).digest("hex") === contract.sha256;
    });
    if (!matches) failures.push(`${contract.file} ${contract.field}: recheck CRD ${contract.source.section}, paragraphs ${contract.source.start}-${contract.source.end}; do not regenerate hashes from pack JSON`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("Given an Ability followed by another costed Ability, then a global substring does not certify the merged text", () => {
  const paragraphs = [
    { index: 1, text: "Fast Talk (1 Intellect): Convince a creature. Action.", style: "BodyText", section: "Scoundrel" },
    { index: 2, text: "Hand to Eye (2 Speed or Intellect): Improve a roll. Enabler.", leadingLabel: "Hand to Eye (2 Speed or Intellect)", style: "BodyText", section: "Scoundrel" }
  ];
  const passages = abilityPassages("Fast Talk", paragraphs, ["Fast Talk"]);
  assert.equal(compareText("Convince a creature. Action.", paragraphs, passages).status, "exact-passage");
  assert.equal(compareText("Convince a creature. Action. Hand to Eye (2 Speed or Intellect): Improve a roll. Enabler.", paragraphs, passages).status, "passage-difference");
});

test("Given a Word label omits spacing before a cost, then the next costed Ability still ends the previous definition", () => {
  const paragraphs = [
    { index: 1, text: "Poison Bite (4 Might): Make a poisonous bite. Action.", style: "BodyText", section: "Howls at the Moon" },
    { index: 2, text: "Wings (4 Might): Sprout wings. Action.", leadingLabel: "Wings(4 Might)", style: "BodyText", section: "Howls at the Moon" }
  ];
  const passages = abilityPassages("Poison Bite", paragraphs, ["Poison Bite"]);
  assert.equal(compareText("Make a poisonous bite. Action.", paragraphs, passages).status, "exact-passage");
  assert.equal(compareText("Make a poisonous bite. Action. Wings (4 Might): Sprout wings. Action.", paragraphs, passages).status, "passage-difference");
});

test("Given a Word callout and Effort paragraph, then the complete Ability includes them", () => {
  const paragraphs = [
    { index: 1, text: "Healing Hand (1 Intellect): Heal one wound.", style: "BodyText" },
    { index: 2, text: "An NPC regains 5 health.", style: "Callout", leadingLabel: "NPC" },
    { index: 3, text: "Effort: Increase the effect.", style: "BodyText", leadingLabel: "Effort" },
    { index: 4, text: "Tier 2", style: "TypeHeaders" }
  ];
  assert.equal(abilityPassages("Healing Hand", paragraphs, ["Healing Hand", "Effort"])[0].text,
    "Heal one wound. An NPC regains 5 health. Effort: Increase the effect.");
});

test("Given CRD punctuation differs, then the audit reports it without silently approving or paraphrasing", () => {
  const paragraphs = [{ index: 0, text: "You’re trained.", section: "Skills" }];
  assert.equal(compareText("You're trained.", paragraphs).status, "punctuation-difference");
  assert.equal(compareText("You’re trained.", paragraphs).status, "exact-fragment");
  assert.equal(compareText("You are trained.", paragraphs).status, "needs-section-mapping");
  assert.equal(plainText("<p>A &amp; B</p><p>Roll &#x2014; once.</p>"), "A & B Roll — once.");
  assert.equal(plainText("<p>You’re <em>trained</em>.</p>"), "You’re trained.");
});

test("Given a reviewed embedded definition, then the audit compares selected CRD text instead of a saved hash", () => {
  const paragraphs = [
    { index: 1, text: "Detect Spirit (2+ Intellect): Sense spirits." },
    { index: 2, text: "Effort: Pinpoint presences. Action." },
    { index: 3, text: "Mindslice (1 Intellect): Attack a mind." }
  ];
  const passage = reviewedPassage({ start: 1, end: 2, section: "Sorcerer — Open Inner Eye",
    segments: [{ start: 1, end: 2, stripLeadingLabel: true }] }, paragraphs);
  assert.equal(compareText("Sense spirits. Effort: Pinpoint presences. Action.", paragraphs, [passage]).status, "exact-passage");
  assert.equal(compareText("Sense spirits. Action.", paragraphs, [passage]).status, "passage-difference");
});

test("Given descriptive powers, then the runtime audit never equates storage or chat output with complete automation", () => {
  const cypher = auditAutomation({ type: "cypher", system: { randomRange: { min: 1, max: 4 } } });
  assert.equal(cypher.status, "partial-or-adjudicated");
  assert.ok(cypher.gaps.some(gap => gap.includes("generation-table")));
  const descriptor = auditAutomation({ type: "descriptor", system: { benefits: [{ description: "Reduce a wound." }] } });
  assert.ok(descriptor.gaps.some(gap => gap.includes("not executed")));
});

test("Given explicit CRD cost headers, then the audit detects wrong base costs and leaves complex costs for review", () => {
  const command = [{ index: 1, text: "Advanced Command (4+ Intellect): Influence a creature." }];
  assert.equal(auditAbilityBaseCost({ cost: { stat: "intellect", amount: 7 } }, command).status, "base-cost-mismatch");
  assert.equal(auditAbilityBaseCost({ cost: { stat: "intellect", amount: 4 } }, command).status, "checked-base-cost");
  const flight = [{ index: 2, text: "Electric Flight (0+ Intellect): Fly." }];
  assert.equal(auditAbilityBaseCost({ cost: { stat: "none", amount: 0 } }, flight).status, "base-cost-mismatch");
  assert.equal(auditAbilityBaseCost({ cost: { stat: "intellect", amount: 0 } }, flight).status, "checked-base-cost");
  assert.equal(auditAbilityBaseCost({}, [{ index: 3, text: "Open Inner Eye (2+ Intellect plus 1 minor wound): Perform a ritual." }]).status, "not-checked");
});
