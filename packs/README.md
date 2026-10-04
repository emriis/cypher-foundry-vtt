# Compendium source directories

The _source directories are the authoritative editable content for Foundry compendiums.

The 2026 CRD conversion follows the architecture documented in docs/compendium-architecture.md and the working mapping in docs/crd-compendium-map.md.

Generated LevelDB files are build artifacts. Do not edit them manually.

New CRD content should be added in deterministic, bilingual source records and then compiled with npm run build:packs.
