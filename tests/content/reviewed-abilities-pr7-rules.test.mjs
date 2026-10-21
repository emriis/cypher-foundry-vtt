/** PR7 source clauses that could silently change game rules if simplified. */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { readFrenchProposals } from "../../scripts/review-translations.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const proposal = async id => {
  const p = (await readFrenchProposals(ROOT)).get("ability." + id)?.proposal;
  assert.ok(p, "Missing Ability proposal " + id);
  assert.equal(p.status, "reviewed");
  return Object.fromEntries(p.fields.map(({ path, text }) => [path, text]));
};

test("different same-name variants retain their distinct rules and usage frequencies", async () => {
  const necroA = await proposal("basic-necromancy-455f4fa10b45");
  const necroB = await proposal("basic-necromancy-d68c55e38e39");
  assert.match(necroA["system.description"], /réanimer lorsqu’elle devient inerte ou si elle est « tuée »/);
  assert.match(necroB["system.description"], /Sauf si la créature est tuée par des dégâts/);
  assert.match(necroB["system.description"], /deuxième corps/);
  const defenseTurn = await proposal("defend-and-respond-0594709c5998");
  const defenseRound = await proposal("defend-and-respond-7c4fcc1d1596");
  assert.match(defenseTurn["system.description"], /une fois par tour/);
  assert.match(defenseRound["system.description"], /une fois par round/);
  const dangerA = await proposal("danger-instinct-1777bdd0f4cd");
  const dangerB = await proposal("danger-instinct-bb80038c6539");
  assert.match(dangerA["system.description"], /vous vous déplacez d’une distance immédiate/);
  assert.match(dangerB["system.description"], /vous pouvez vous déplacer d’une distance immédiate/);
});

test("long abilities retain numerical alternatives, exclusions and separate action classes", async () => {
  const magic = await proposal("a-bit-of-magic");
  const s = magic["system.description"];
  for (const value of ["3 points d’Intellect","5 points d’Intellect","7 points d’Intellect",
    "récupération de dix heures","ne compte pas dans votre limite de cyphers","Au rang 6"])
    assert.ok(s.includes(value), value);
  const animal = await proposal("animal-shape");
  assert.match(animal["system.description"], /4 dégâts/);
  assert.match(animal["system.description"], /2 dégâts/);
  assert.match(animal["system.description"], /une forme hybride/);
  assert.match(animal["system.description"], /sans entrave/);
  const colossal = await proposal("colossal");
  for(const fragment of ["7 points de Puissance supplémentaires","trois premières blessures modérées",
    "deux premières blessures majeures","9 dégâts","touchent automatiquement"])
    assert.ok(colossal["system.description"].includes(fragment), fragment);
  const automaton = await proposal("automaton-turret-upgrade");
  assert.match(automaton["system.description"], /7 dégâts/);
  assert.match(automaton["system.description"], /attaque entravée par round/);
  assert.match(automaton["system.description"], /une action lente pour attaquer/);
  const spirit = await proposal("conjure-supernatural-creature");
  for (const fragment of ["Ange : niveau 5","Démon : niveau 5","Élémentaire : niveau 5",
    "Santé 15","Santé 25","Armure de 3","Armure de 10 contre le feu"])
    assert.ok(spirit["system.description"].includes(fragment), fragment);
});

test("Divine Radiance retains complete structured alternatives and Effort limits", async () => {
  const divine = await proposal("divine-radiance");
  assert.match(divine["system.description"], /l’un des effets suivants/);
  assert.equal(divine["system.effects.blessing.name"], "Bénédiction");
  assert.equal(divine["system.effects.turn-undead.name"], "Repousser les morts-vivants");
  assert.match(divine["system.effects.blessing.description"], /récupération de dix minutes ou plus/);
  assert.match(divine["system.effects.turn-undead.description"], /cinq créatures mortes-vivantes de niveau 2 ou moins/);
  assert.match(divine["system.effects.turn-undead.description"], /au lieu de faire fuir/);
  assert.match(divine["system.effects.turn-undead.description"], /chaque attaque après la première/);
  assert.match(divine["system.effects.turn-undead.effort"], /Augmentez de 1 le niveau maximum/);
  assert.match(divine["system.effects.blessing.effort"], /deux cibles supplémentaires/);
});

test("review preserves specialized device and equipment conditional clauses", async () => {
  const craft = await proposal("craft-device");
  for (const fragment of ["difficulté 3", "1 sur 1d6", "pas un cypher",
    "Au rang 3", "Au rang 6","deux niveaux d’Effort"])
    assert.ok(craft["system.description"].includes(fragment), fragment);
  const water = await proposal("cool-water");
  assert.match(water["system.description"], /besoins en eau de cinq créatures pendant une journée/);
  const device = await proposal("control-electric-device");
  assert.match(device["system.description"], /sauf si vous êtes à portée immédiate/);
  assert.match(device["system.description"], /niveau de la créature ou celui de l’appareil, selon le plus élevé/);
  assert.match(device["system.description"], /niveau minimum de cette aptitude|résultat minimum de cette aptitude/);
  const disableA = await proposal("disable-mechanism-81929add5e84");
  const disableB = await proposal("disable-mechanism-995e719f4628");
  assert.match(disableA["system.description"], /Ciblez un mécanisme par une interface réseau/);
  assert.match(disableB["system.description"], /Ciblez une machine par une interface réseau/);
  for (const v of [disableA, disableB]) assert.match(v["system.description"], /deux niveaux d’Effort/);
});
