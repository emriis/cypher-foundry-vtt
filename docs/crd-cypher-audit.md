# CRD Cypher Source Audit

This audit tracks Cypher content extracted from the supplied 2026-07-29
Cypher Reference Document.

The CRD is authoritative. No Cypher mechanic is inferred from names, examples,
genre-item labels, or outside references.

## Current coverage

- Subtle Cyphers: 86 source records per language.
- Manifest Cyphers: **103 source records per language**, representing 106 d00 table placements because Teleporter appears in four power tables.
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

Manifest extraction now preserves the CRD power-level classification, d00
selection ranges, embedded random tables, and Teleporter's four power variants.

