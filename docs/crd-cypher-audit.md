# CRD Cypher Source Audit

This audit tracks Cypher content extracted from the supplied 2026-07-29
Cypher Reference Document.

The CRD is authoritative. No Cypher mechanic is inferred from names, examples,
genre-item labels, or outside references.

## Current coverage

- Subtle Cyphers: 86 source records per language.
- Manifest Cyphers: **103 source records per language**, representing 106 d00 table placements because Teleporter appears in four power tables.
- Power Boost Cyphers: **9 source records per language**, with their 9 d00 placements preserved; the CRD's 37–00 entry redirects to the general Random Cypher table and is not a tenth Power Boost Cypher.
- Artifact content: not present in the supplied CRD and therefore not extracted.

French build output uses source-hashed proposals from `translations/fr/`;
the current normalized inventory has 198 reviewed Cypher proposals within the
equipment family. Legacy English fallback in an authored compatibility record
does not determine the compiled French status. Mechanical fields remain paired.

Common generation, variants, tables, capacity and single-use consumption are
implemented; particular power effects remain descriptive. See
[the common lifecycle](cypher-lifecycle.md) and
[the current coverage review](crd-coverage-review.md) for the remaining effect families.

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



## Power Boost Cypher contract

Every Power Boost Cypher source record:
- maps to Foundry `Item` type `cypher`;
- has a stable `cypher.power-boost.<slug>` logical ID;
- is classified with `cypherCategory: "powerBoost"`;
- leaves `cypherType` unset because the CRD explicitly leaves its physical or
  nonphysical form to the GM;
- does not receive a numeric effect level or manifest power level because the
  Power Boost section does not assign either;
- preserves the CRD random-table placement when one exists;
- carries CRD version, language, section, and source locator provenance.
