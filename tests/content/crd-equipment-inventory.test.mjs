import assert from "node:assert/strict";
import test from "node:test";

import {
  CRD_EQUIPMENT_INVENTORY,
  CRD_EQUIPMENT_INVENTORY_COUNT
} from "../fixtures/crd-equipment-inventory.mjs";

test("CRD equipment inventory has the expected canonical size", () => {
  assert.equal(CRD_EQUIPMENT_INVENTORY.length, 259);
  assert.equal(
    CRD_EQUIPMENT_INVENTORY.length,
    CRD_EQUIPMENT_INVENTORY_COUNT
  );
});

test("CRD equipment inventory has no duplicate genre/price/name entries", () => {
  const keys = CRD_EQUIPMENT_INVENTORY.map(([genre, price, name]) =>
    genre + "|" + price + "|" + name
  );

  assert.equal(new Set(keys).size, keys.length);
});

test("CRD equipment inventory preserves the expected genre totals", () => {
  const expected = {
    "Real-World": 60,
    Fantasy: 73,
    "Science Fiction": 86,
    Postapocalypse: 35,
    Superhero: 5
  };

  for (const [genre, count] of Object.entries(expected)) {
    assert.equal(
      CRD_EQUIPMENT_INVENTORY.filter(([entryGenre]) => entryGenre === genre)
        .length,
      count,
      genre
    );
  }
});

test("CRD equipment inventory preserves the expected price categories", () => {
  const expected = {
    inexpensive: 49,
    moderate: 100,
    expensive: 71,
    veryExpensive: 29,
    exorbitant: 10
  };

  const actual = Object.fromEntries(
    Object.keys(expected).map((price) => [
      price,
      CRD_EQUIPMENT_INVENTORY.filter(([, entryPrice]) => entryPrice === price)
        .length
    ])
  );

  assert.deepEqual(actual, expected);
});
