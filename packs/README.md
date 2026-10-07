# Compendium source directories

The `_source/` directories are the authoritative editable content for Foundry
compendiums.

The current CRD conversion uses the architecture documented in
`docs/compendium-architecture.md`, the current mapping in
`docs/crd-compendium-map.md`, and the source contract in
`docs/crd-source-schema.md`.

Generated LevelDB files are build artifacts. Do not edit them manually.

For source-backed CRD content:

1. edit the paired English/French `_source/` records;
2. preserve logical IDs and CRD provenance;
3. run `npm run migrate:packs`;
4. run `npm run test:content`;
5. run `npm run build:packs`.

The generated pack output is consumed by Foundry at runtime but is never the
authoritative editing surface.
