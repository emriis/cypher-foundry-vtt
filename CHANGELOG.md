<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/) on a best-effort basis while pre-1.0.

## [Unreleased]

### Added

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

- Type and Descriptor `_source` JSON files are now maintained directly as paired bilingual
  records; the former content generators and `generate-types` npm command were removed.

### Fixed

- Type compendium sources keep ability blocks bounded to their authoritative CRD Type
  section, including Effort and Enabler text, while retaining canonical CRD copies for Type
  variants and Character Book French ability localization.

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

- These fixes and mechanics were validated by code review against Foundry's official API
  documentation, but have not yet been tested inside a live Foundry instance.

[Unreleased]: https://github.com/emriis/cypher-foundry-vtt/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/emriis/cypher-foundry-vtt/compare/v0.1.2...v0.1.3
[0.1.1]: https://github.com/emriis/cypher-foundry-vtt/releases/tag/0.1.1
