/**
 * Deterministic logical identifiers for CRD source records.
 *
 * Logical IDs are language-neutral source identifiers. They are not Foundry
 * _ids and must never be derived from localized display names.
 */

export const CRD_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * Normalize a source label for use as an identifier component.
 *
 * This helper is intentionally conservative. It is suitable for deterministic
 * source keys, not for rewriting user-facing names.
 *
 * @param {string} value Source label.
 * @returns {string} Normalized identifier component.
 */
export function normalizeCrdIdComponent(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Build a language-neutral logical ID.
 *
 * @param {string} contentType CRD content family.
 * @param {string} sourceName Canonical English/source name.
 * @returns {string} Logical ID.
 */
export function buildCrdLogicalId(contentType, sourceName) {
  const type = normalizeCrdIdComponent(contentType);
  const name = normalizeCrdIdComponent(sourceName);

  if (!type || !name) {
    throw new Error("CRD logical IDs require non-empty type and source name.");
  }

  return type + "." + name;
}

/**
 * Validate a logical ID.
 *
 * @param {string} logicalId Candidate logical ID.
 * @returns {boolean} Whether the ID follows the canonical format.
 */
export function isValidCrdLogicalId(logicalId) {
  return typeof logicalId === "string" && CRD_ID_PATTERN.test(logicalId);
}

/**
 * Return the stable key used to pair an English record with its French
 * translation.
 *
 * @param {string} logicalId Language-neutral CRD logical ID.
 * @returns {string} Pairing key.
 */
export function getCrdPairingKey(logicalId) {
  if (!isValidCrdLogicalId(logicalId)) {
    throw new Error("Invalid CRD logical ID: " + logicalId);
  }

  return logicalId;
}

/**
 * Build a deterministic reference target from a logical ID.
 *
 * This is metadata only. Foundry UUID resolution happens after source records
 * are compiled into documents.
 *
 * @param {string} logicalId Language-neutral CRD logical ID.
 * @returns {{logicalId: string}} Reference target.
 */
export function buildCrdReferenceTarget(logicalId) {
  return {
    logicalId: getCrdPairingKey(logicalId)
  };
}
