/**
 * Remove rule drift introduced by independently editing English and French Items.
 * Canonical typed English fields are authored against the supplied CRD. The
 * normalizer reuses those fields; it never derives rules from translated prose.
 * Existing French display text and document identities remain editable, while
 * references are resolved to the paired French documents by logical identity.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { root } from "./context.mjs";
import { fieldLocation, translationFields } from "../localization/compendium-translations.mjs";

/**
 * Return a counterpart with source-backed typed rules and existing localized text.
 * This is pure; the caller supplies reference maps and owns persistence.
 * @param {object} english Canonical English normalized Item.
 * @param {object} french Paired French Item whose stable identity is preserved.
 * @param {{references?: Map<string,string>, abilityIds?: Map<string,string>}} maps Canonical pair maps.
 * @returns {object} Aligned French clone.
 */
export function alignFrenchRuleData(english, french, { references = new Map(), abilityIds = new Map() } = {}) {
  if (english.type !== french.type) throw new Error("Bilingual counterpart document types differ.");
  const result = structuredClone(french);
  result.system = structuredClone(english.system);
  const translated = translationFields(french);
  for (const field of translationFields(english).keys()) {
    if (!field.startsWith("system.") || !translated.has(field)) continue;
    const { target, key } = fieldLocation(result, field);
    target[key] = translated.get(field);
  }
  function localReferences(value) {
    if (Array.isArray(value)) return value.map(localReferences);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, localReferences(child)]));
    if (typeof value === "string" && /^Compendium\.cypher\.[\w-]+-en\.Item\./.test(value)) {
      if (!references.has(value)) throw new Error(`Unresolved English/French reference: ${value}`);
      return references.get(value);
    }
    return value;
  }
  result.system = localReferences(result.system);
  for (const edge of result.system.flowchart?.edges ?? []) {
    for (const endpoint of ["from", "to"]) {
      if (!abilityIds.has(edge[endpoint])) throw new Error(`Unresolved bilingual Focus edge: ${edge[endpoint]}`);
      edge[endpoint] = abilityIds.get(edge[endpoint]);
    }
  }
  return result;
}

/** Await writes in the configured checkout; validation invokes this only in isolation. */
export async function alignFrenchMechanics() {
  const records = [];
  for (const pack of (await fs.readdir(path.join(root, "packs"))).filter(name => /-(?:en|fr)$/.test(name)).sort()) {
    const directory = path.join(root, "packs", pack, "_source");
    for (const file of (await fs.readdir(directory, { recursive: true })).filter(file => file.endsWith(".json")).sort()) {
      const absolute = path.join(directory, file);
      const document = JSON.parse(await fs.readFile(absolute, "utf8"));
      if (document.type && !document._key?.startsWith("!folders!")) records.push({ pack, file: absolute, document, logicalId: document.flags?.cypherFoundry?.crd?.logicalId });
    }
  }
  const french = new Map(records.filter(record => record.pack.endsWith("-fr")).map(record => [record.logicalId, record]));
  const english = records.filter(record => record.pack.endsWith("-en"));
  const references = new Map(), abilityIds = new Map();
  for (const source of english) {
    const counterpart = french.get(source.logicalId);
    if (!counterpart) throw new Error(`Missing French counterpart for ${source.logicalId}.`);
    references.set(`Compendium.cypher.${source.pack}.Item.${source.document._id}`,
      `Compendium.cypher.${counterpart.pack}.Item.${counterpart.document._id}`);
    if (source.document.type === "ability") abilityIds.set(source.document._id, counterpart.document._id);
  }
  for (const source of english) {
    const counterpart = french.get(source.logicalId);
    const result = alignFrenchRuleData(source.document, counterpart.document, { references, abilityIds });
    await fs.writeFile(counterpart.file, JSON.stringify(result, null, 2) + "\n");
  }
}
