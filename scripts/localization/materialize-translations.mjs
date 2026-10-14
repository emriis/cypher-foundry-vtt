/**
 * Select complete French overlays for temporary compendium compilation.
 * Reviewed proposals are eligible for normal builds; draft previews explicitly
 * opt in to proposed text. The complete plan is validated before a caller writes
 * anything, and authoring records and proposal review statuses remain untouched.
 */
import { applyTranslation, mechanicalProjection, sourceHash } from "./compendium-translations.mjs";
import { PENDING_FRENCH_TRANSLATION } from "../source-migration/context.mjs";

/**
 * Return translated documents keyed by their existing French source file.
 * The caller supplies a normalized catalogue, whose language-specific UUIDs are
 * compared by logical CRD identity. Draft builds require complete coverage so
 * a missing proposal cannot silently fall back to English in a French preview.
 * @param {object[]} records Normalized bilingual source records.
 * @param {Map<string,object>} proposals Parsed proposal files by logical identity.
 * @param {{includeProposed?: boolean}} options Explicit draft-preview selection.
 * @returns {Map<string,object>} Validated cloned French documents.
 */
export function materializeTranslations(records, proposals, { includeProposed = false } = {}) {
  const english = new Map(), french = new Map(), references = new Map();
  for (const record of records) {
    const catalogue = record.pack.endsWith("-en") ? english : french;
    if (!record.logicalId || catalogue.has(record.logicalId)) throw new Error(`Missing or duplicate source identity: ${record.logicalId}.`);
    catalogue.set(record.logicalId, record);
    references.set(`Compendium.cypher.${record.pack}.Item.${record.document._id}`, `crd:${record.logicalId}`);
    if (record.document.type === "ability") references.set(record.document._id, `crd:${record.logicalId}`);
  }
  for (const id of proposals.keys()) if (!english.has(id)) throw new Error(`Orphaned French proposal: ${id}.`);
  const resolve = value => references.get(value) ?? value;
  const plan = new Map();
  for (const [id, source] of english) {
    const proposal = proposals.get(id)?.proposal;
    if (includeProposed && !proposal) throw new Error(`Missing French proposal: ${id}.`);
    if (!proposal || (!includeProposed && proposal.status !== "reviewed")) continue;
    const counterpart = french.get(id);
    if (!counterpart) throw new Error(`Missing French counterpart: ${id}.`);
    const result = applyTranslation(source.document, counterpart.document, proposal);
    if (JSON.stringify(mechanicalProjection(source.document, resolve)) !== JSON.stringify(mechanicalProjection(result, resolve))) {
      throw new Error(`Bilingual mechanical data differs: ${id}. Run migrate:packs before building translations.`);
    }
    // Metadata states what was compiled; it never promotes a draft to reviewed.
    result.flags.cypherFoundry.translation = {
      language: "fr", status: proposal.status, sourceLogicalId: id,
      sourceDigest: sourceHash(JSON.stringify(proposal.fields.map(({ path, sourceHash }) => [path, sourceHash]).sort()))
    };
    // Full French text is now present in the compiler clone. Keep the review
    // status explicit, but remove the legacy claim that English was retained.
    const provenance = result.flags.cypherFoundry.crd;
    provenance.transformations = [
      ...(provenance.transformations ?? []).filter(value => value !== PENDING_FRENCH_TRANSLATION),
      "French display fields materialized from a complete source-hashed editorial proposal"
    ];
    plan.set(counterpart.file, result);
  }
  // Granted/optional Skills are legacy name-based references. A text-only
  // mechanical projection deliberately masks them, so check their referent
  // against the translated Skill catalogue before accepting the whole plan.
  const skillNames = new Map();
  for (const [id, source] of english) {
    if (source.document.type !== "skill") continue;
    const name = source.document.name.trim().toLocaleLowerCase("en");
    if (skillNames.has(name)) throw new Error(`Ambiguous CRD Skill label: ${source.document.name}.`);
    skillNames.set(name, id);
  }
  for (const [id, source] of english) {
    const result = plan.get(french.get(id)?.file);
    if (!result) continue;
    for (const key of ["skillOptions", "grantedSkills"]) {
      for (const [index, label] of (source.document.system?.[key] ?? []).entries()) {
        const skillId = skillNames.get(label.trim().toLocaleLowerCase("en"));
        const skillRecord = french.get(skillId);
        const translatedSkill = plan.get(skillRecord?.file) ?? skillRecord?.document;
        if (!translatedSkill || result.system[key][index] !== translatedSkill.name) {
          throw new Error(`Translated Skill label differs from ${skillId ?? label}: ${id}.${key}.${index}.`);
        }
      }
    }
  }
  return plan;
}
