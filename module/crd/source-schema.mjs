/**
 * Schema and validation helpers for CRD-derived compendium source records.
 *
 * These helpers are intentionally independent from Foundry runtime objects.
 * They validate the repository's authored source contract before pack builds.
 */

export const CRD_SOURCE_VERSION = "2026-07-29";

export const CRD_LANGUAGES = new Set(["en", "fr"]);

export const CRD_CONTENT_TYPES = new Set([
  "ability",
  "artifact",
  "armor",
  "cypher",
  "descriptor",
  "equipment",
  "focus",
  "genre",
  "journal",
  "shield",
  "skill",
  "type",
  "weapon",
  "creature"
]);

export const CRD_SOURCE_KINDS = new Set([
  "section",
  "passage",
  "table",
  "record"
]);

export const CRD_PROVENANCE_FLAG = "cypherFoundry";

export const CRD_ID_PREFIXES = Object.freeze({
  ability: "ability",
  artifact: "artifact",
  armor: "armor",
  cypher: "cypher",
  descriptor: "descriptor",
  equipment: "equipment",
  focus: "focus",
  genre: "genre",
  journal: "journal",
  shield: "shield",
  skill: "skill",
  type: "type",
  weapon: "weapon",
  creature: "creature"
});

/**
 * Read CRD provenance metadata from a source record.
 *
 * @param {object} record Foundry source record.
 * @returns {object|undefined} CRD provenance metadata.
 */
export function getCrdProvenance(record) {
  return record?.flags?.[CRD_PROVENANCE_FLAG]?.crd;
}

/**
 * Return the logical source identifier used to pair language variants.
 *
 * @param {object} record Foundry source record.
 * @returns {string|undefined} Stable logical identifier.
 */
export function getCrdLogicalId(record) {
  return getCrdProvenance(record)?.logicalId;
}

/**
 * Validate one CRD source record.
 *
 * This checks the structural contract only. It deliberately does not inspect
 * rules text or infer missing mechanics from the CRD.
 *
 * @param {object} record Foundry source record.
 * @returns {string[]} Validation errors.
 */
export function validateCrdSourceRecord(record) {
  const errors = [];

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return ["Record must be an object."];
  }

  if (typeof record._id !== "string" || !/^[a-zA-Z0-9]{16}$/.test(record._id)) {
    errors.push("Record _id must be a 16-character Foundry identifier.");
  }

  const expectedKeyPrefix = record.document === "Actor"
    ? "!actors!"
    : record.document === "JournalEntry"
      ? "!journal!"
      : "!items!";

  if (record._key !== expectedKeyPrefix + record._id) {
    errors.push("Record _key must match the Foundry document identifier.");
  }

  if (!["Item", "Actor", "JournalEntry"].includes(record.document)) {
    errors.push("Record document must be Item, Actor, or JournalEntry.");
  }

  if (typeof record.name !== "string" || record.name.trim() === "") {
    errors.push("Record name must be a non-empty string.");
  }

  if (typeof record.crdType !== "string" || !CRD_CONTENT_TYPES.has(record.crdType)) {
    errors.push(`Unsupported CRD content type: ${String(record.crdType)}.`);
  }

  if (record.document === "Item" && typeof record.type !== "string") {
    errors.push("Item records must define a Foundry item type.");
  }

  const provenance = getCrdProvenance(record);

  if (!provenance || typeof provenance !== "object") {
    errors.push("Missing CRD provenance metadata.");
    return errors;
  }

  if (provenance.version !== CRD_SOURCE_VERSION) {
    errors.push(`CRD version must be ${CRD_SOURCE_VERSION}.`);
  }

  if (
    typeof provenance.logicalId !== "string" ||
    provenance.logicalId.trim() === ""
  ) {
    errors.push("Missing CRD logicalId.");
  }

  if (!CRD_LANGUAGES.has(provenance.language)) {
    errors.push("CRD language must be 'en' or 'fr'.");
  }

  if (!CRD_SOURCE_KINDS.has(provenance.sourceKind)) {
    errors.push("Invalid CRD sourceKind.");
  }

  if (
    typeof provenance.section !== "string" ||
    provenance.section.trim() === ""
  ) {
    errors.push("Missing CRD section.");
  }

  if (
    typeof provenance.sourceLocator !== "string" ||
    provenance.sourceLocator.trim() === ""
  ) {
    errors.push("Missing CRD sourceLocator.");
  }

  if (!Array.isArray(provenance.transformations)) {
    errors.push("CRD transformations must be an array.");
  }

  if (
    provenance.language === "fr" &&
    typeof provenance.sourceLogicalId !== "string"
  ) {
    errors.push(
      "French CRD records must identify their English sourceLogicalId."
    );
  }

  return errors;
}

/**
 * Build the CRD provenance flag for a source record.
 *
 * @param {object} provenance Provenance metadata.
 * @returns {object} Foundry flags object.
 */
export function buildCrdFlags(provenance) {
  return {
    [CRD_PROVENANCE_FLAG]: {
      crd: {
        ...provenance
      }
    }
  };
}
