/**
 * Resolve one Foundry document reference and validate its expected document type.
 *
 * This is the single runtime boundary for UUID references stored by Cypher
 * content documents. Callers should not invoke fromUuid directly when resolving
 * persisted content references.
 *
 * @param {string|object|null} reference UUID string or a document-like value.
 * @param {string} expectedType Expected Foundry document type.
 * @returns {Promise<object|null>} The resolved document, or null when invalid.
 */
export async function resolveDocumentReference(reference, expectedType) {
  if (!reference) return null;

  const document = typeof reference === "string"
    ? await fromUuid(reference).catch(() => null)
    : reference;

  if (!document) return null;
  if (expectedType && document.type !== expectedType) return null;
  return document;
}

/**
 * Resolve a collection of references while preserving input order.
 * Invalid or wrong-type references are omitted.
 *
 * @param {Array<string|object>} references References to resolve.
 * @param {string} expectedType Expected Foundry document type.
 * @returns {Promise<object[]>} Valid resolved documents.
 */
export async function resolveDocumentReferences(references = [], expectedType) {
  const documents = await Promise.all(
    references.map(reference =>
      resolveDocumentReference(reference, expectedType)
    )
  );
  return documents.filter(Boolean);
}
