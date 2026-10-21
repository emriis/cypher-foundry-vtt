/**
 * Build every French document from its canonical English fields and one editorial
 * source: translations/fr/. Historical prose in French _source files is never
 * eligible as fallback, even when no proposal has been reviewed.
 *
 * Normal builds display the English CRD text for unreviewed entries with an
 * explicit "untranslated" flag. Draft previews opt into proposed text;
 * publication can require every entry to be reviewed.
 */
import { applyTranslation, fieldLocation, mechanicalProjection, sourceHash, translationFields } from "./compendium-translations.mjs";
import { PENDING_FRENCH_TRANSLATION } from "../source-migration/context.mjs";

/** Overwrite every legacy French display field with its canonical English text. */
export function englishDisplayBaseline(english, french) {
  const copy = structuredClone(french);
  for (const [path, sourceText] of translationFields(english)) {
    const { target, key } = fieldLocation(copy, path);
    target[key] = sourceText;
  }
  return copy;
}

/**
 * Materialize every normalized French counterpart into compiler input.
 * @param {object[]} records Paired, canonical EN/FR catalogue.
 * @param {Map<string,object>} proposals Source-hashed French editorial entries.
 * @param {{includeProposed?:boolean,requireReviewed?:boolean}} options Selection.
 * @returns {Map<string,object>} All FR files mapped to cloned documents.
 */
export function materializeTranslations(records, proposals,
  { includeProposed = false, requireReviewed = false } = {}) {
  if (includeProposed && requireReviewed) {
    throw new Error("Draft preview and reviewed-only publication are mutually exclusive.");
  }
  const english = new Map(), french = new Map(), references = new Map();
  for (const record of records) {
    const catalogue = record.pack.endsWith("-en") ? english : french;
    if (!record.logicalId || catalogue.has(record.logicalId)) {
      throw new Error("Missing or duplicate source identity: " + record.logicalId + ".");
    }
    catalogue.set(record.logicalId, record);
    const kind = record.document.document === "JournalEntry" ? "JournalEntry" : "Item";
    references.set("Compendium.cypher." + record.pack + "." + kind + "." + record.document._id,
      "crd:" + record.logicalId);
    if (record.document.type === "ability") references.set(record.document._id, "crd:" + record.logicalId);
  }
  for (const id of proposals.keys()) {
    if (!english.has(id)) throw new Error("Orphaned French proposal: " + id + ".");
  }
  for (const id of french.keys()) {
    if (!english.has(id)) throw new Error("Orphaned French counterpart: " + id + ".");
  }
  const resolve = value => references.get(value) ?? value;
  const plan = new Map();

  for (const [id, source] of english) {
    const counterpart = french.get(id);
    if (!counterpart) throw new Error("Missing French counterpart: " + id + ".");
    const proposal = proposals.get(id)?.proposal;
    if (includeProposed && !proposal) throw new Error("Missing French proposal: " + id + ".");
    if (requireReviewed && proposal?.status !== "reviewed") {
      throw new Error("French publication requires a reviewed proposal: " + id + ".");
    }

    const baseline = englishDisplayBaseline(source.document, counterpart.document);
    const selected = proposal && (includeProposed || proposal.status === "reviewed");
    const result = selected ? applyTranslation(source.document, baseline, proposal) : baseline;
    if (JSON.stringify(mechanicalProjection(source.document, resolve)) !==
        JSON.stringify(mechanicalProjection(result, resolve))) {
      throw new Error("Bilingual mechanical data differs: " + id + ". Run migrate:packs before building.");
    }
    const status = selected ? proposal.status : "untranslated";
    const sourceFields = [...translationFields(source.document)];
    result.flags ??= {};
    result.flags.cypherFoundry ??= {};
    result.flags.cypherFoundry.translation = {
      language: "fr", status, sourceLanguage: selected ? "fr" : "en",
      sourceLogicalId: id,
      sourceDigest: sourceHash(JSON.stringify(
        (selected ? proposal.fields.map(({path, sourceHash: digest}) => [path, digest])
          : sourceFields.map(([path, text]) => [path, sourceHash(text)])).sort()
      ))
    };
    const provenance = result.flags.cypherFoundry.crd;
    const transformations = (provenance.transformations ?? []).filter(value =>
      value !== PENDING_FRENCH_TRANSLATION &&
      value !== "French display fields materialized from a complete source-hashed editorial proposal");
    provenance.transformations = [...transformations, selected
      ? "French display fields materialized from a complete source-hashed editorial proposal"
      : PENDING_FRENCH_TRANSLATION];
    plan.set(counterpart.file, result);
  }

  // Some structured Skill labels resolve to other compendium records by name.
  // These must refer to whichever reviewed or English fallback name was compiled.
  const skillNames = new Map();
  for (const [id, source] of english) {
    if (source.document.type !== "skill") continue;
    const name = source.document.name.trim().toLocaleLowerCase("en");
    if (skillNames.has(name)) throw new Error("Ambiguous CRD Skill label: " + source.document.name);
    skillNames.set(name, id);
  }
  for (const [id, source] of english) {
    const result = plan.get(french.get(id)?.file);
    for (const key of ["skillOptions", "grantedSkills"]) {
      for (const [index, label] of (source.document.system?.[key] ?? []).entries()) {
        const skillId = skillNames.get(label.trim().toLocaleLowerCase("en"));
        if (!skillId) continue;
        const skillRecord = french.get(skillId);
        const selectedSkill = plan.get(skillRecord?.file);
        const currentLabel = result.system[key][index];
        // English CRD labels can differ from their Skill heading in case
        // ("Systems Operation" vs "Systems operation"). This is not a French
        // translation. Reviewed French references must still match exactly.
        const englishCaseVariant = result.flags.cypherFoundry.translation.status === "untranslated" &&
          selectedSkill?.flags?.cypherFoundry?.translation?.status === "untranslated" &&
          currentLabel?.trim().toLocaleLowerCase("en") ===
            selectedSkill.name.trim().toLocaleLowerCase("en");
        if (!selectedSkill || (currentLabel !== selectedSkill.name && !englishCaseVariant)) {
          throw new Error("Translated Skill label differs from " + skillId + ": " + id + "." + key + "." + index + ".");
        }
      }
    }
  }
  return plan;
}
