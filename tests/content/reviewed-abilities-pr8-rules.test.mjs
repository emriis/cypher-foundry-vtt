/** PR8 individual CRD clauses: distinct variants and numerical edge cases. */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
let cache;
async function fr(id) {
  cache ??= await readFrenchProposals(ROOT);
  const draft = cache.get("ability." + id)?.proposal;
  assert.ok(draft, "Unknown CRD Ability: " + id);
  assert.equal(draft.status, "reviewed", id);
  return Object.fromEntries(draft.fields.map(entry => [entry.path, entry.text]));
}

test("Earthshake attack and no-roll variants preserve completely different damage and action rules", async () => {
  const rolled = (await fr("earthshake-0ddc3d51346e"))["system.description"];
  const automatic = (await fr("earthshake-286f22a79ff8"))["system.description"];
  assert.match(rolled, /6 dégâts/);
  assert.match(rolled, /3 dégâts/);
  assert.match(rolled, /jet d’attaque distinct/);
  assert.match(automatic, /7 dégâts/);
  assert.match(automatic, /13 dégâts/);
  assert.match(automatic, /sans jet/);
  assert.match(automatic, /Action lente/);
});

test("specializations require normal advancement; another published definition is never merged", async () => {
  const expert = (await fr("expert-combatant-1fa1a6453c1f"))["system.description"];
  assert.match(expert, /rang 2/);
  assert.match(expert, /rang 6/);
  assert.match(expert, /avancement de personnage/);
  assert.match(expert, /niveau expert/);
  const other = (await fr("expert-combatant-9accfa89252c"))["system.description"];
  assert.match(other, /rang 6/);
  const low = (await fr("improved-machine-companion-10e83ae60f0f"))["system.description"];
  const specified = (await fr("improved-machine-companion-9c25a7197c58"))["system.description"];
  assert.match(low, /de niveau inférieur/);
  assert.match(low, /le conserver tel quel/);
  assert.match(specified, /compagnon de niveau 3/);
});

test("wound healing, multi-patient limits, Idol and HUD options keep their CRD thresholds", async () => {
  const hand = (await fr("healing-hand-93d8262ac299"))["system.description"];
  const handAlt = (await fr("healing-hand-f1ed07f19df0"))["system.description"];
  assert.match(hand, /5 points de Santé/);
  assert.doesNotMatch(handAlt, /5 points de Santé/);
  for(const item of [hand, handAlt]) {
    assert.match(item, /d’un degré|gravité d’une blessure/);
    assert.match(item, /coût en Intellect augmente de 1/);
    assert.match(item, /Action lente/);
  }
  const idol = (await fr("idol"))["system.description"];
  for (const expected of ["rituel de dix minutes", "épuisement de 1–2 sur 1d6",
    "deux blessures modérées", "niveau 5 ou moins", "de difficulté 2",
    "Fureur bestiale", "Purification spirituelle"]) assert.ok(idol.includes(expected), expected);
  const hud = (await fr("hud"))["system.description"];
  for (const expected of ["deux niveaux d’Effort", "un niveau d’Effort",
    "5 miles (8 km)", "niveau 4 ou moins", "niveau 5 ou plus",
    "les deux prochains rounds"]) assert.ok(hud.includes(expected), expected);
});

test("range, action types, dramatic speed and no-damage exceptions stay exact", async () => {
  const dual = (await fr("dual-wield"))["system.description"];
  assert.match(dual, /vous ne pouvez pas utiliser une action réflexe/);
  assert.match(dual, /l’ordre d’initiative normal/);
  const burst = (await fr("fireball"))["system.description"];
  assert.match(burst, /3 dégâts en cas de réussite/);
  assert.match(burst, /1 dégât en cas d’échec/);
  assert.match(burst, /ajoute 2 dégâts à chaque cible, au lieu de 3/);
  const wall = (await fr("granite-wall"))["system.description"];
  assert.match(wall, /trois niveaux d’Effort/);
  const hand = (await fr("go-for-the-eyes"))["system.description"];
  assert.match(hand, /griffant l’œil/);
  assert.doesNotMatch(hand, /en l’arrachant/);
  const warmth = (await fr("gentle-warmth"))["system.description"];
  assert.match(warmth, /augmentez la température/);
  assert.match(warmth, /30˚ F \(15˚ C\)/);
  const fast = (await fr("incredible-velocity"))["system.description"];
  assert.match(fast, /700 miles par heure/);
  assert.match(fast, /1 100 km\/h/);
  assert.match(fast, /trois actions d’affilée/);
});

test("more subtle skill effects, augmenting attacks and one-use costs remain source-restricted", async () => {
  const flex = (await fr("flex-skill"))["system.description"];
  assert.match(flex, /Vous ne pouvez pas utiliser cette aptitude/);
  assert.match(flex, /devenir spécialisé/);
  const fury = (await fr("frenzy"))["system.description"];
  assert.match(fury, /+1 à votre Avantage de Puissance/);
  assert.match(fury, /Avantage de Célérité/);
  assert.match(fury, /ne pouvez pas utiliser de points d’Intellect/);
  const grab = (await fr("grab"))["system.description"];
  assert.match(grab, /2 dégâts de moins/);
  assert.match(grab, /4 dégâts/);
  const future = (await fr("improved-apportation"))["system.description"];
  assert.match(future, /Niveau 3/);
  assert.match(future, /Niveau 5/);
});
