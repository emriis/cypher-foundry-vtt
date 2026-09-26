---
name: foundry-compendium-workflow
description: Use when adding, editing, validating, or packaging Foundry VTT compendium content in this repository.
---

# Foundry compendium workflow

Read the compendium section of `docs/development.md` and inspect the relevant
source generator, item DataModel, existing `_source` entries, and tests before
editing. Check `docs/local/` for user-provided content references when relevant.

## Source and generation

- Treat `packs/<pack-name>/_source/` as the reviewable source of truth.
- If a generator owns the content, change the generator and regenerate rather
  than editing generated source entries by hand. Descriptor sources use
  `python scripts/generate-descriptors.py`; Type sources use
  `npm run generate-types`.
- Keep paired French and English records aligned in identifiers, document
  structure, mechanical data, and supported item fields. Respect the item
  DataModel and existing naming/ID conventions.
- Every source record needs its Foundry `_key` in the documented form, such as
  `!items!<_id>`. Check for uniqueness and valid document type/ID.
- Write original descriptions and summaries. Preserve required Cypher Open
  License attribution; do not copy substantial CRD text.

## Validation and packaging

1. Run the applicable source generator and inspect the resulting source diff.
2. Run focused compendium tests (for example `node --test
   tests/compendium-sources.test.mjs`) and `npm test` when source or behavior
   warrants it.
3. Rebuild each affected Foundry-readable LevelDB pack using the documented
   `@foundryvtt/foundryvtt-cli` workflow in `CONTRIBUTING.md`. The CLI may need
   to be installed locally; do not change dependency manifests just to install
   this optional tool.
4. Check the pack output and Git status. Do not commit transient `LOCK`/`LOG`
   files or unrelated generated artifacts.
5. State clearly if the CLI or a live Foundry instance was unavailable; source
   validation is not the same as successfully loading the compiled pack in
   Foundry.
