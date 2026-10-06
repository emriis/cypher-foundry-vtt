---
name: cypher-schema-migration
description: 'Use when changing persisted Actor or Item schemas, adding or reviewing a world migration, moving or removing stored fields, changing migration version gates, or preserving existing Foundry world and compendium data in this Cypher system.'
---

# Cypher schema migration workflow

Use this workflow when a data-model change can make existing Actor or Item data incompatible. Also follow `cypher-rule-tdd`; complete `foundry-live-validation` before preparing a runtime commit.

## Decide whether migration is required

1. Read the changed DataModel, document behavior, `module/migration.mjs`, migration tests, `system.json` flags, and every sheet/template that submits the affected field.
2. Compare representative old persisted data with the new schema. A default is sufficient only when Foundry can safely hydrate old documents without losing or misinterpreting data.
3. Require a migration when fields are renamed, moved, removed, split, merged, retyped, or need derived replacement values. Preserve unknown and unrelated data.
4. Define reversibility and the oldest safe source version before editing. If data loss or the compatibility boundary is unclear, stop and ask.

## Implement with TDD

1. Add a focused test using representative pre-migration data. Assert transformed values, preservation of unrelated fields, idempotence, and any relevant world/pack safety constraints.
2. Run the focused test and confirm it fails for the intended missing transformation.
3. Add the smallest version-gated transformation behind the reserved `module/migration.mjs` entry point, keeping the entry point itself small.
4. Add manifest migration metadata only for the release that actually introduces the compatibility break: set `flags.needsMigrationVersion` to the target schema version and raise `flags.compatibleMigrationVersion` only when older data cannot be migrated safely.
5. Add matching localized migration messages only when the user-visible status or failure mode changes.
6. Rerun the focused test, then `npm test`.

## Live safety gate

- Never test a migration against the user's real world. Back up and use a disposable copy containing representative old documents.
- Confirm the checkout and exact Foundry version before opening the copy. Cancel any unreviewed or non-reversible migration prompt.
- Verify values before migration, immediately after migration, and after reload. Confirm a second startup does not transform the documents again.
- Inspect world actors and affected unlocked compendium documents. Check the client console and Foundry logs for migration errors.
- Update `compatibility.verified` only under the rules in `foundry-live-validation`; a successful unit test does not establish runtime compatibility.

## Report

State the source and target schema versions, transformed document types and fields, compatibility boundary, automated test results, disposable-world result, idempotence result, and rollback or backup used. If live validation is unavailable, leave compatibility metadata unchanged and report the migration as not runtime-verified.
