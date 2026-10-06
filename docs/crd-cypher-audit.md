# CRD Cypher Source Audit

This audit tracks Cypher content extracted from the supplied 2026-07-29
Cypher Reference Document.

The CRD is authoritative. No Cypher mechanic is inferred from names, examples,
genre-item labels, or outside references.

## Current coverage

- Subtle Cyphers: 86 source records per language.
- Manifest Cyphers: not yet extracted.
- Power Boost Cyphers: not yet extracted.
- Artifact content: not present in the supplied CRD and therefore not extracted.

French records use the English CRD text verbatim when no project-owned faithful
French source is available. Mechanical fields remain identical.

## Subtle Cypher contract

Every subtle Cypher source record:
- maps to Foundry `Item` type `cypher`;
- has a stable `cypher.<slug>` logical ID;
- uses CRD effect level 4;
- has no manifest power-level classification;
- preserves the CRD effect/explanation text in `system.description`;
- carries CRD version, language, section, and source locator provenance.

Manifest extraction will add the CRD power-level classification and preserve
the special multi-level Teleporter behavior without inventing a single power level.
