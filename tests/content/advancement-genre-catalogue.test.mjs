/** Production-catalogue contract after isolated normalization, including same-key variants. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { GENRE_ABILITIES } from "../../module/rules/genre-ability-catalogue.mjs";
test("runtime Genre eligibility preserves every canonical manifest identity, tier and genre", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../data/crd-genre-abilities.json", import.meta.url), "utf8"));
  assert.deepEqual(GENRE_ABILITIES, manifest.records.map(record => ({ id: record.logicalId, tier: record.tier,
    genres: [...new Set([record.genre, ...(record.sources ?? []).map(source => source.genre)])].sort() })));
});
