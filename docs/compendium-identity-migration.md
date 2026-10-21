# Compendium identity migration — PR1 baseline and contract

This document records the *proposed* identity policy for the bilingual
Cypher compendium refactor. **PR1 audits; it does not rewrite existing IDs.**
The canonical 2026-07-29 CRD, not localized names or historical French JSON,
determines source identities and mechanics.

## Scope and current boundaries

The repository exposes seven Item/JournalEntry families in each language:
abilities, skills, descriptors, types, foci, equipment (including cyphers), and
rules. The normalized catalogue is the publication input; raw editable
`packs/*/_source` files can have different IDs and counts because the migration
aligns mechanics, creates missing Ability counterparts, and canonicalizes W4
equipment IDs. A raw-file-only comparison would be misleading.

The last documented normalized inventory (2026-10-14) has 1,373 records per
language: 701 abilities, 58 skills, 53 descriptors, 55 types, 42 foci, 457
equipment/cyphers, and seven rule Journals. This is a historical baseline,
**not a newly measured assertion**. Run the audit to get current values.

## Proposed invariant for PR2

| Field | Contract |
| --- | --- |
| `flags.cypherFoundry.crd.logicalId` | One English-CRD-derived identity for the record; shared by EN and FR |
| `sourceLogicalId` | FR origin points to the canonical logical ID |
| `_id` | First 16 lowercase hex characters of SHA-256 of the canonical logical ID, encoded as UTF-8 |
| `_key` | Rebuilt as `!items!<id>` or `!journal!<id>` |
| `system.key`, action enums, effect IDs | Stable mechanical identity, not translated |
| `name`, descriptions, journal text | Localized display data only |
| Full UUID | `Compendium.cypher.<family>-<locale>.<DocumentType>.<id>`; EN/FR differ in collection name only |
| Journal page IDs | Deterministic child IDs derived from parent logical ID and a stable English page anchor |
| Folder IDs | Deterministic family-scoped IDs using stable *source paths*, not translated folder names |

The audit proposes ASCII lower-case slug components for grandfathered logical
IDs (notably equipment such as
`equipment.Fantasy.inexpensive.Arrows (12)` ->
`equipment.fantasy.inexpensive.arrows-12`). **This is not an approved automatic
rename**: inspect every normalization collision and source-identity ambiguity
before PR2. Do not use a French display label or a filename from a French
translation to generate canonical Item identities.

Folder and Journal child IDs need their own documented namespace; PR2 must
ensure parent/child references, Foundry `_key` values, and any stored page
links remain consistent. Source row order must never be used as an implicit
identity when a stable source anchor exists. The current PR1 page proposal
uses the original English page `_id` as that anchor; any missing or reordered
pages require explicit adjudication before migrating.

## Running the complete read-only audit

From a checkout with installed dependencies:

```powershell
npm run audit:ids
npm run audit:ids -- --output reports/identity-migration-review.json
```

The command first reads the untouched authored EN/FR catalogue and folder
records. It then creates an ownership-checked disposable workspace, executes
the *existing* source normalizer there, reads the paired normalized catalogue,
builds the mapping, and removes the temporary workspace.

The JSON report defaults to `reports/compendium-identity-audit.json` (ignored
by Git). It contains:

- `summary`: counts by family for EN/FR pairs, current matching or differing
  `_id` values, and records requiring new `_id`/logical IDs;
- `entries`: every normalized record's EN and FR source path, old authored ID
  when recoverable, normalized current ID and UUID, proposed logical ID, new ID,
  new `_key` and proposed UUID;
- `entries[].pages`: journal page current/proposed identifiers;
- `references`: Foundry compendium UUID references and their proposed targets;
- `folders` and `folderAssignments`: old/new bilingual Folder identifiers,
  their parent relationships, and Item.folder remapping candidates;
- `issues` and `issueCounts`: missing or duplicate logical identities, unpaired
  records, normalized-slug and proposed-ID collisions, dangling UUIDs/Focus
  edges, invalid current IDs, page-count mismatches, and Folder problems.

The audit emits diagnostics even if legacy EN/FR IDs differ; **that is the
problem being measured**, not a test failure. It does not silently approve
collisions, fill in incomplete pairings, or modify authoring or generated packs.
Failure to normalize, read the catalogue or write the requested report exits
nonzero. The CI content job uploads the JSON as a review artifact.

## Required PR2 implementation gates

1. Review the PR1 report and resolve ambiguities and proposed logical-ID
   collisions *before* any writes to authored sources. Verify identity stability
   for duplicate-name Abilities whose CRD definitions differ.
2. Assign one deterministic `_id` for both languages of every document and
   remove competing legacy ID generators. Rebuild `_key` and ensure no
   within-pack collisions. Keep pack **collection IDs** unchanged.
3. Redirect all references, including Type/Focus Ability UUIDs, `abilityTiers`,
   Focus graph edge endpoints, Item folder membership, nested Folder parents,
   rule Journal pages, Foundry `@UUID` links, effects and other scoped targets.
   A grep-only UUID replacement is not sufficient.
4. Audit legacy world-owned and imported Items/JournalEntries and document a
   deliberate reset/reimport or world-migration path. Even for a single user,
   changing pack IDs breaks stored references; a backup is required.
5. Prove deterministic idempotence: two runs produce byte-for-byte equivalent
   canonical identities; EN/FR match on every pair; all links resolve.
6. Check that changing *only* translated `name` or prose cannot affect IDs,
   references, source locators, typed mechanics, or translation-source hashes.
7. Run full Node content/integration tests, build all fourteen packs and run
   relevant Foundry v14 E2E. Do not claim Foundry validation from static tests.

## Relationship to the translation project

PR3 will remove competing French translation authorities and retain
`translations/fr/` as the sole editorial content source. Subsequent work audits
CRD callouts and establishes inclusive-language and mechanical-terminology
policies before approving French prose. **PR1 does not approve translations,
change game rules, or regenerate published databases.**
