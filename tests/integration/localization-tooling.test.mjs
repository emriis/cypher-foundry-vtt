/** Verify authoring safeguards rather than merely comparing the two current bundles. */
import assert from "node:assert/strict";
import test from "node:test";
import { mergeLocaleFragments, missingLiteralKeys, parseLocale, validateLocalePair } from "../../scripts/localization/locales.mjs";
import { buildLocales } from "../../scripts/build-locales.mjs";
import path from "node:path";

test("Given domain fragments, when a locale is assembled, then shared namespaces merge without losing keys", () => {
  const result = mergeLocaleFragments([
    { name: "shared", value: { CYPHER: { Name: "Cypher" } } },
    { name: "actors", value: { CYPHER: { Actor: { Name: "Name" } }, TYPES: { Actor: { pc: "Character" } } } }
  ]);
  assert.deepEqual(result, { CYPHER: { Actor: { Name: "Name" }, Name: "Cypher" }, TYPES: { Actor: { pc: "Character" } } });
});

test("Given literal references and dynamic prefixes, when keys are audited, then missing complete keys are reported", () => {
  const dictionary = { CYPHER: { Name: "Name" } };
  assert.deepEqual(missingLiteralKeys('localize("CYPHER.Name"); localize("CYPHER.Missing"); concat("CYPHER.Stat.", stat)', dictionary), ["CYPHER.Missing"]);
});

test("Given current domain sources, when Foundry locale artifacts are checked, then both bundles are current", async () => {
  await buildLocales(path.resolve(import.meta.dirname, "../.."), { check: true });
});

test("Given duplicate or conflicting authoring keys, when a locale is read or merged, then it rejects silent overwrites", () => {
  assert.throws(() => parseLocale('{"CYPHER":{"Name":"one","Name":"two"}}', "shared.json"), /shared.json.*duplicate.*CYPHER.Name/i);
  assert.throws(() => mergeLocaleFragments([
    { name: "a", value: { CYPHER: { Name: "one" } } },
    { name: "b", value: { CYPHER: { Name: "one" } } }
  ]), /duplicate.*CYPHER.Name/i);
  assert.throws(() => mergeLocaleFragments([
    { name: "a", value: { CYPHER: { Name: "one" } } },
    { name: "b", value: { CYPHER: { Name: { Child: "two" } } } }
  ]), /conflict.*CYPHER.Name/i);
});

test("Given translation variables and keys, when locales are checked, then missing information is rejected", () => {
  assert.deepEqual(validateLocalePair({ Message: "{name}: {amount}" }, { Message: "{amount} : {name}" }), []);
  assert.match(validateLocalePair({ Message: "{amount}" }, { Message: "Résultat" }).join("\n"), /Message.*variables/);
  assert.match(validateLocalePair({ Message: "Hello" }, { Other: "Bonjour" }).join("\n"), /missing.*Message/);
  assert.match(validateLocalePair({ Message: "Hello" }, { Message: "Bonjour", Extra: "Autre" }).join("\n"), /unexpected.*Extra/);
  assert.match(validateLocalePair({ Message: "Hello" }, { Message: "{{name}}" }).join("\n"), /single braces/);
  assert.throws(() => parseLocale('{"CYPHER":{"Value":2}}'), /string/);
  assert.throws(() => parseLocale('{"CYPHER":{"Value":["x"]}}'), /string/);
  assert.throws(() => parseLocale('{"CYPHER":{"__proto__":"x"}}'), /unsupported member/);
  assert.throws(() => parseLocale('{"CYPHER":{"constructor":"x"}}'), /unsupported member/);
  assert.throws(() => parseLocale('{"CYPHER":{"nested.key":"x"}}'), /unsupported member/);
  for (const root of ["null", "[]", '"text"']) assert.throws(() => parseLocale(root), /root must be an object/);
});
