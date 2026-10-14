---
name: foundry-compendium-workflow
description: Use when adding, editing, validating, or packaging Foundry VTT compendium content in this repository.
---

# Foundry compendium workflow

Read the compendium section of `docs/development.md` and inspect the relevant
item DataModel, paired `_source` entries, and tests before editing. Check
`docs/local/` for user-provided content references when relevant.

## Source and generation

The detailed source-fidelity and transformation policy is maintained in
`docs/crd-source-schema.md`. All agents and authoring prompts use that policy.

- The supplied CRD is the sole authority for all compendium facts, descriptions,
  mechanics, names, and structure. Treat `packs/<pack-name>/_source/` as the
  reviewable authoring surface, not an independent source of truth.
- Author canonical CRD-backed English content and paired structural data under
  `_source/`; author complete French display text as source-hashed proposals
  under `translations/fr/`. Follow `docs/localization.md` for paths, status,
  glossary and compilation. Legacy paired filenames need not be identical.
- Keep paired French and English records aligned in identifiers, document
  structure, mechanical data, and supported item fields. Respect the item
  DataModel and existing naming/ID conventions.
- Every source record needs its Foundry `_key` in the documented form, such as
  `!items!<_id>`. Check for uniqueness and valid document type/ID.
- Under the Cypher Open License, retain complete English CRD passages rather
  than summaries, including relevant callouts, examples and exceptions. A
  translation aid supplies wording only; compare it with the actual CRD before
  reuse. Provide full French proposals when that is the authorized scope, and
  keep unresolved terminology or mechanics visible for review. Legacy English
  fallback is not an approved French translation. Preserve the attribution.
- Keep confirmed activation labels `First action` / `Action` / `Last action`
  as `Action réflexe` / `Action` / `Action lente`. Ordinary ordinal wording
  such as "your first action in combat" may require "votre première action du
  combat" instead. Keep enum values and other semantic rule strings unchanged.
- Preserve logical IDs, Foundry IDs and English CRD locators independently of
  translated names. Grandfathered equipment logical IDs retain their canonical
  English genre/price/name tuple, including legacy capitalization and spaces.

## Validation and packaging

1. Inspect both language diffs and run focused compendium tests (for example `node --test
   tests/content/compendium-sources.test.mjs`) and `npm test` when source or behavior
   warrants it.
2. Run `audit:i18n` and, when reviewing translations, `preview:translations`.
   Both normalize a disposable copy; previews do not overwrite source records.
   For intended artifact builds, normalize the build checkout with
   `migrate:packs`, then use `build:packs`. It compiles reviewed proposals into
   temporary JSON; `--include-proposed` explicitly includes complete drafts.
   Sources and review status remain unchanged by translation compilation.
   Preserve all fourteen existing family/language collection IDs.
3. Check the pack output and Git status. Do not commit transient `LOCK`/`LOG`
   files or unrelated generated artifacts.
   `npm test` normalizes only a temporary copy. Explicit source migrations and
   builds in the authoring checkout are intentional content/artifact changes;
   follow `cypher-validation-isolated` when only validating runtime work.
4. State clearly if the CLI or a live Foundry instance was unavailable; source
   validation is not the same as successfully loading the compiled pack in
   Foundry.
