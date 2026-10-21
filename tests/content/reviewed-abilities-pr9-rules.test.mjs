/** Locked PR9 source distinctions: guard clauses that must survive editorial edits. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";
const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE = "data/localization/ability-review-batch-3.json";

test("PR9 guards source-backed rule distinctions and mutually exclusive options", async () => {
  const proposals = await readFrenchProposals(ROOT);
  const ids = new Set(JSON.parse(await fs.readFile(path.join(ROOT, SOURCE), "utf8")).ids);
  const cases = [
    ["ability.infer-thoughts", /niveau 4 ou moins/u, /sans jet/u, /voir et l’entendre/u, /dix minutes/u],
    ["ability.inferno-trail", /2 m/u, /5 dégâts/u, /1 dégât/u, /action supplémentaire/u],
    ["ability.information-gathering", /1,6 km/u, /machines non intelligentes/u],
    ["ability.insect-eruption", /sans jet/u, /2 dégâts/u, /inaccessible aux insectes/u],
    ["ability.inspire-action", /action supplémentaire/u, /action normale/u],
    ["ability.inspiring-performance", /trois alliés/u, /trois alliés supplémentaires/u, /rang 3/u],
    ["ability.inspiring-ease", /une fois par jour/iu, /dix heures/u, /suspendue/u],
    ["ability.magnetize", /niveau 5/u, /30 cm/u, /niveau 3/u],
    ["ability.onslaught", /4 dégâts/u, /2 dégâts d’Intellect/u, /rang 3/u],
    ["ability.prepare-spell-9fb0e71b461c", /trois fois/u, /2 Intellect/u, /4 Intellect/u, /6 Intellect/u],
    ["ability.psychokinetic-attack", /Projection lourde/u, /Explosion destructrice/u, /6 dégâts/u]
  ];
  for (const [id, ...checks] of cases) {
    assert.ok(ids.has(id), "Missing protected rule identity: " + id);
    const proposal = proposals.get(id)?.proposal;
    assert.equal(proposal?.status, "reviewed", id);
    const text = proposal.fields.find(field => field.path === "system.description")?.text;
    assert.ok(text, id + " description missing");
    for (const pattern of checks) assert.match(text, pattern, id);
  }
});
