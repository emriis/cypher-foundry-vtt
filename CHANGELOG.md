<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/) on a best-effort basis while pre-1.0.

## [Unreleased]

### Added

- Defined the common CRD source-record contract for stable logical identifiers,
  bilingual pairing, and provenance, with pure validation helpers and tests.
- Documented the CRD source schema and structural-transformation rules.

### Added

- Established a strict CRD fidelity and French localization policy requiring source-faithful transcription, stable provenance, and automated consistency checks.

### Added

- Defined the Foundry-first architecture and conversion map for the 2026 Cypher Reference Document compendiums.

### Changed

- Compendium builds now discover authored bilingual pack source directories automatically instead of maintaining a hard-coded pack list.


### Changed

- Completed the Phase 8 architecture refactor: dependency rules are now enforced by an automated static audit, Foundry E2E executable discovery is isolated and tested, concrete remaining dependency violations were corrected, and the architecture/development documentation now records the stable application, document, sheet, rules, migration, import, content, and test boundaries.
- Continued the Phase 3 architecture refactor: task, recovery, advancement, XP, reroll,
  Player Intrusion, damage, wound, shield, armor, and custom-character operations now live in
  focused Foundry-aware application services, while Actor methods remain compatibility facades.
- Added beginner-oriented JSDoc and implementation comments to the new application boundaries,
  and added focused application-service tests alongside the existing Actor compatibility tests.
- Updated the architecture and development documentation to describe the application-service
  boundary and the next Phase 4 Type/Focus/Descriptor reference-resolution work.
- Removed Actor-owned stat resolution from the application path and added a pure
  `rules/stats.mjs` helper with dedicated tests.
- Completed Phase 4 by moving Type, Focus, Focus-ability selection, and Descriptor/species
  application into `applications/content-service.mjs`, including UUID-backed ability
  resolution, Actor compatibility facades, and dedicated application-boundary tests.
- Completed Phase 5 by moving Ability effect/table operations, equipment invariants, optional
  second Descriptor/Focus persistence, Focus choice lookup, and advancement-choice validation
  out of the PC sheet.
- Completed the general architecture audit by extracting Item use/attack/depletion operations,
  defense orchestration, and centralized armor exclusivity; the Item sheet now resolves standalone
  Type/Focus ability UUIDs before rendering content.
- Completed Phase 6 by separating migration orchestration from actor schema and legacy Type/Focus content transformations, while preserving the existing public migration entry point and version semantics.\n- Updated project documentation to reflect the current six-pack compendium layout,
  live E2E harness, and current CI/release workflow.
- Improved Type compendium sheets with the description first and localized displays for Type benefits and abilities.
- Improved Focus and Descriptor compendium sheets with the description first and structured displays of their abilities, prerequisites, choices, and grants.
- Fixed empty Focus ability lists, low-contrast section headings, missing Focus type labels, and an unavailable image in the Grows to Towering Heights / Deviens colossal Focus.
- Fixed undefined Focus and Type ability ranks and costs by using Foundry's supported localization interpolation format.
- Restyled character and compendium item sheets with the shared burgundy, warm-paper palette, condensed labels, and compact panel geometry.

### Added

- Added standalone bilingual `abilities-en` and `abilities-fr` compendiums. Types and Foci now reference reusable ability documents instead of embedding ability data; Focus prerequisite relationships are stored in the Focus flowchart.
- Added the Works for a Living / Travaille pour vivre Focus to the English and French compendiums.
- Added the Wears a Sheen of Ice / Revêt un voile de glace Focus to the English and French compendiums.
- Added the Walks Through Walls / Traverse les murs Focus to the English and French compendiums.
- Added the Tends to the Wounded / Soigne les blessé·e·s Focus to the English and French compendiums.

- Bilingual Focus compendiums, beginning with the complete `Abides in Stone` / `Se fond dans la
  pierre` CRD flowchart. Focus abilities retain their explicit prerequisite links, require two
  tier-1 choices when applied, and prompt for a valid linked ability after each tier advance.
- Added the bilingual `Grows to Towering Heights` / `Deviens colossal` and `Howls at the Moon` /
  `Hurle à la lune` Focus records, including their CRD flowchart prerequisites.
- Added the bilingual `Infiltrates` / `S’infiltre` Focus records, including their CRD flowchart
  prerequisites.
- Added the bilingual `Speaks for the Land` / `Parle pour la terre` Focus records, including
  their CRD flowchart prerequisites.
- Added the bilingual `Stands Like A Bastion` / `Est un rempart vivant` Focus records, including
  their CRD flowchart prerequisites.
- Added the bilingual `Strikes With Mystic Might` / `Frappe d’une puissance mystique` Focus
  records, including their CRD flowchart prerequisites.
- Added the bilingual `Talks to Machines` / `Parle aux machines` Focus records, including their
  CRD flowchart prerequisites.

### Changed

- Descriptor compendiums now separate general Descriptors from species and group species by genre, with multi-genre species in a dedicated shared folder.
- Weapon and armor familiarity now follows CRD categories instead of broad all-or-nothing Type flags. Core characters freely use light weapons but no armor; Focus grants apply only to selected abilities and their declared category or weapon family.
- Attack rolls now ease light-weapon attacks, apply unfamiliar-weapon hindrance by category, and honor matching practiced attack skills without treating them as freely usable weapon grants.
- Added a schema migration that converts legacy Type-wide free-use flags into exact category permissions while preserving purchased all-category advancements.
- Harmonized Type abilities with the shared Focus ability schema and corrected 28 bilingual
  Focus ability IDs and prerequisite references to their canonical English CRD slugs.
- Synchronized 22 English and French Focus ability descriptions and corrected affected Type
  ability names and translations against the local CRD and Character Book sources.
- Type and Descriptor `_source` JSON files are now maintained directly as paired bilingual
  records; the former content generators and `generate-types` npm command were removed.
- Compendium descriptions now use complete English CRD text under the Cypher Open License; French
  sources use complete Character Book translations when available and otherwise copy the English
  text verbatim.

### Fixed

- Type compendium sources keep ability blocks bounded to their authoritative CRD Type
  section, including Effort and Enabler text, while retaining canonical CRD copies for Type
  variants and Character Book French ability localization.
- Compendium folders no longer appear empty when the repository is installed directly in Foundry:
  all eight bilingual Descriptor, Ability, Type, and Focus packs are now compiled as LevelDB databases before
  release packaging, with CI rebuilding generated packs when their sources change.

## [0.1.4] - 2026-09-26

### Added

- WebP illustrations for the Type compendiums.

### Changed

- Cross-subgenre Type entries now use their canonical names and mechanics, with a single Soldier
  entry in Hard Science Fiction and its matching entry in Space Opera.

### Fixed

- Pinned the Foundry download URL to the `v<version>` GitHub release tag and made package
  validation enforce that format.

## [0.1.3] - 2026-09-26

### Added

- `CONTRIBUTING.md` describing the project's coding conventions, pack-build procedure, and PR
  process.
- Automated tests for task-roll resolution, recovery and rally behavior, schema migrations,
  Foundry manifest resources, localized keys, and compendium source integrity.
- This changelog.

### Changed

- JSDoc convention clarified: JSDoc blocks (`/** ... */`) are English-only across all `.mjs`
  files. See `CONTRIBUTING.md` for the full convention and its rationale.
- French Descriptor and Type compendium translations aligned with the local Character Book.
- Type compendiums now group their entries into genre and subgenre folders in both languages.
- `compatibility.verified` updated to Foundry VTT 14.368 after manual live validation.

### Fixed

- New worlds no longer trigger the legacy-data migration warning: the default schema version
  now matches the initial supported migration baseline.

## [0.1.1]

First documented state of the system.

### Added

- `system.json` manifest compatible with Foundry VTT **V13 and V14** (verified against V14.360).
- DataModels for PC/NPC/Community actors and Skill/Ability/Cypher/Artifact/Oddity/Equipment/
  Attack/Armor/Shield/Descriptor items.
- ApplicationV2 character, NPC, Community, and Item sheets.
- Full French/English localization (`lang/fr.json`, `lang/en.json`).
- Wound-based task resolution engine: difficulty/steps/Effort/Edge/skills/assets, special
  results on a natural 1/17/18/19/20 (GM intrusion, damage bonus, minor/major effect, cost
  refund on a natural 20).
- Wound tracking (minor/moderate/major) with cascading overflow, stacking hindrance, and token
  status sync ("Hindered" / "Dead").
- PC armor mechanics: Block/Dodge modifiers by category, freely-usable armor handling, and
  damageable armor (GM-intrusion damage + repair).
- Shields with their own wound track, usable by any character regardless of Type.
- Recoveries that remove wounds by duration, and rallying (spend Might to remove a wound).
- Cypher one-click use, and artifact/equipment depletion-die rolls.
- Attack rolls with damage scaled by weapon category, and tracked weapon familiarity
  (`freelyUsable`).
- Genre-aware character creation (Real World / Fantasy / Sci-Fi / Superhero / Custom), with
  Superhero Rank, Power Shifts, higher task-difficulty cap, and major-wound rallying gated to
  that genre.
- Optional second descriptor / second focus, custom stats, custom fields, and a Resource
  Points tracker.
- Full XP economy: reroll, player intrusion, lucky shot, and 4-slot-per-tier character
  advancement with automatic tier-up.
- Character Builder JSON import (`module/import.mjs`), mapping Skills, Abilities, Equipment,
  and Attacks; Cyphers/Artifacts/Armor/Shields/Oddities are not yet mapped.
- Bilingual (FR/EN) Descriptor compendiums (33 CRD descriptors) with a drag-and-drop
  apply-effect flow instead of a persistent item.
- Design system (`DESIGN-SYSTEM.md`): color/typography/spacing tokens, WCAG AA–verified
  contrast, Foundry light/dark theme support, keyboard focus rings, minimum click targets.
- World schema-migration scaffold (`module/migration.mjs`).

### Fixed

- `primaryTokenAttribute` / `secondaryTokenAttribute` in `system.json` pointed at a
  non-existent data path (`pools.might` / `pools.speed` instead of `stats.might.pool` /
  `stats.speed.pool`), so token HP/speed bars could not function.
- `data-action="onEditImage"` on character/item portraits did not match Foundry's actual action
  name (`editImage`), so clicking a portrait did nothing.
- Custom stats, custom fields, and advancement slots used array-field form inputs that did not
  cover every sub-field of each element (e.g. missing `id`/`label`). Because Foundry replaces
  an `ArrayField` wholesale on every submission and the sheet submits on every change, this
  could silently wipe data (e.g. an already-purchased advancement slot reverting to
  "not purchased") on the next unrelated edit. Fixed with dedicated hidden fields.
- An unfamiliar armor's Speed hindrance (per the CRD, "it hinders all your Speed tasks") was
  computed but only ever applied to explicit Dodge rolls. It's now applied to every Speed-stat
  task roll (Dodge excluded to avoid double-counting, since Dodge already folds it in directly).

### Known limitations

- The deterministic test suite runs in CI, while live Foundry E2E tests require a locally
  activated Foundry installation and are not part of the standard GitHub-hosted CI job.
- Runtime-affecting changes still require disposable-world validation before their Foundry
  compatibility can be considered verified.

[Unreleased]: https://github.com/emriis/cypher-foundry-vtt/compare/v0.1.7...HEAD
[0.1.3]: https://github.com/emriis/cypher-foundry-vtt/compare/v0.1.2...v0.1.3
[0.1.1]: https://github.com/emriis/cypher-foundry-vtt/releases/tag/0.1.1
