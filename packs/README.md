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

## Item icons

`npm run migrate:packs` also synchronizes `img` between English and French Descriptor,
Focus and Equipment records paired by canonical CRD logical identity. Specific existing Focus artwork
is preserved; missing and generic images receive deterministic SVG artwork
under `assets/compendium/`. The artwork is system-owned and included in the
release archive. Run migration before compendium tests and pack compilation;
PR generated-artifact automation invokes the icon materializer alone so it
can synchronize updated sources, SVG files and compiled packs without
modifying unrelated canonical content. Do not manually edit compiled LevelDB or generated SVGs.
