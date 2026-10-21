# Compendium identity migration — PR1 baseline and PR2 implementation

This document records the original PR1 pre-migration inventory and the PR2
canonical identity policy. **PR2 migrates the normalized documents and references
in `scripts/source-migration/canonical-ids.mjs`; the PR1 baseline below is
historical, not an assertion about the new outputs.**
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

## Measured normalized baseline (CI, 2026-10-21)

The first successful CI identity-audit run measured **1,373 paired records**
(2,746 documents) with **210 different current EN/FR `_id` values**.
This validates the need for an explicit migration instead of assuming all
source IDs are already paired.

| Family | Paired records | Different current IDs | EN records needing new ID | FR records needing new ID | Logical IDs proposed to change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Abilities | 701 | 121 | 634 | 634 | 0 |
| Descriptors | 53 | 33 | 53 | 53 | 0 |
| Equipment and cyphers | 457 | 0 | 457 | 457 | 259 |
| Foci | 42 | 0 | 42 | 42 | 0 |
| Rules | 7 | 0 | 7 | 7 | 0 |
| Skills | 58 | 1 | 58 | 58 | 0 |
| Types | 55 | 55 | 55 | 55 | 0 |
| **Total** | **1,373** | **210** | **1,306** | **1,306** | **259** |

For that normalized catalogue, the first CI report found **zero** missing
counterparts, duplicate identities, proposed slug/ID collisions, invalid
document IDs, dangling compendium UUIDs, dangling Focus edges, Journal page
count mismatches or unpaired Folders. These are static findings for the
inspected source set, not live Foundry migration results.

The first CI run audited an already-normalized CI worktree after the content
job's normalizer. A separate clean-checkout CI identity job now measures raw
authoring IDs independently before normalization; review its JSON artifact
for exact historical-to-normalized mappings.

## Applied invariant in normalized PR2 outputs

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

The migration uses ASCII lower-case slug components for grandfathered logical
IDs (notably equipment such as
`equipment.Fantasy.inexpensive.Arrows (12)` ->
`equipment.fantasy.inexpensive.arrows-12`). **This is not an approved automatic
rename**: the preflight audit verifies that there are no proposed collisions.
The new migrator fails on missing pairs, collisions or unresolved references,
rather than guessing repairs. No French display label determines canonical IDs.

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

## PR2 migration gates and operation

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


## PR2 implementation and deployment

The new `scripts/source-migration/id-contract.mjs` owns the pure canonical
identity policy. `scripts/source-migration/canonical-ids.mjs` runs last in
`migrate:packs`, after the existing Type/Focus/Ability pairing and French
mechanical normalization. It first checks all pairs, collisions, Journal page
counts and Folder identities, then rewrites IDs and references across both
languages. Re-running the migration on already normalized input must produce
the same output; regression tests exercise this.

`build:packs`, `npm test`, and `audit:i18n` perform migration only in their
temporary checkouts. The authored `packs/*/_source/` records retain their old
IDs until a deliberate `npm run migrate:packs` is run. The main-branch
`Build Compendium Packs` workflow runs that migration and commits normalized
source files together with generated LevelDB outputs following merge. The PR
artifact build verifies generated packs without updating the branch.

The 259 legacy equipment translations remain authored under their existing
editorial files; `readFrenchProposals` maps their keys and old Journal page
selectors into the canonical namespace in memory. This is a migration bridge,
not a second translation authority or evidence of semantic review. The next
localization refactor (PR3) will remove historic fallback behavior.

**Breaking saved references:** old world-owned Items, external macros, Journal
links, and UUIDs imported from previous pack builds are not automatically
converted. Export or back up any world before installing this migration,
then reimport affected content or run a separately verified world migration.
Do not silently change a user's Foundry Data directory.
