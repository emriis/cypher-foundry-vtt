/** Stable CRD source identity and bilingual Foundry ID policy (Node-only). */
import { createHash } from "node:crypto";

/** Normalize a canonical English source-identity component, never localized prose. */
export function identitySlug(value) {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Convert legacy English CRD logical IDs to canonical, language-neutral slugs. */
export function proposedLogicalId(logicalId) {
  if (typeof logicalId !== "string" || !logicalId.trim()) {
    throw new Error("Missing canonical English logicalId.");
  }
  const components = logicalId.split(".");
  if (components.some(component => !identitySlug(component))) {
    throw new Error("Cannot normalize logicalId: " + logicalId);
  }
  return components.map(identitySlug).join(".");
}

/** Deterministic sixteen-character Foundry ID shared by paired EN/FR documents. */
export function proposedFoundryId(logicalId) {
  if (!logicalId) throw new Error("Cannot hash an empty logicalId.");
  return createHash("sha256").update(logicalId, "utf8").digest("hex").slice(0, 16);
}

/** Stable JournalEntryPage ID, anchored to its original canonical English page ID. */
export function proposedPageId(parentLogicalId, englishPageAnchor) {
  if (!englishPageAnchor) throw new Error("Missing stable English Journal page anchor.");
  return proposedFoundryId(parentLogicalId + ":page:" + englishPageAnchor);
}

/** Stable cross-locale folder identity from pack family and English-relative path. */
export function proposedFolderId(family, relativePath) {
  const stablePart = identitySlug(relativePath.replace(/\.json$/, ""));
  if (!stablePart) throw new Error("Missing stable folder path.");
  return proposedFoundryId("folder." + family + "." + stablePart);
}
