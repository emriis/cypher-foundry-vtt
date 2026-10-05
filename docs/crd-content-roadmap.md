# CRD Compendium Roadmap

This roadmap tracks the complete conversion of the 2026-07-29 Cypher
Reference Document into a Foundry-first reference library.

The target is not a PDF copied into Journals. The final library must be
searchable, linkable, bilingual, structurally useful to automation, and
organized around how players and GMs actually use Foundry.

## 1. End-state library

The conversion has four complementary layers.

### Player Guide

The Player Guide is the curated entry point for players.

Target packs:

- `player-guide-en`
- `player-guide-fr`

These Journal Entries should explain character creation and point to the
reusable content rather than duplicate it.

Expected navigation:

1. What is Cypher?
2. Core Character
3. Creating a Character
4. Stats, Pools, Edge, Effort, and Skills
5. Type
6. Descriptor
7. Focus
8. Abilities
9. Equipment, Weapons, Armor, and Shields
10. Cyphers and Artifacts
11. Actions, Tasks, and Combat
12. Damage, Wounds, and Recovery
13. Advancement and XP
14. Genre-specific character creation
15. Quick Reference

The Player Guide is a navigation layer. Rules that already have a dedicated
entry should be linked by UUID instead of copied into the guide.

### GM Guide

The GM Guide is the curated entry point for running a game.

Target packs:

- `gm-guide-en`
- `gm-guide-fr`

Expected navigation:

1. Running Cypher
2. Task Difficulty and Modifiers
3. Actions and Time
4. Combat
5. Defenses
6. Damage, Wounds, and Recovery
7. GM Intrusions
8. Experience and Advancement
9. NPCs and Creatures
10. Encounters and Adversaries
11. Equipment, Rewards, and Treasure
12. Cyphers and Artifacts
13. Genre Guidance
14. Random Tables
15. Quick Reference

The GM Guide must link to detailed procedures, creatures, tables, and reusable
content instead of becoming a second copy of the CRD.

## 2. Foundational reference packs

These are the detailed reference layer behind the two guides.

| Family | Target representation | Status |
| --- | --- | --- |
| Core rules | JournalEntry | In progress |
| Quick Reference | JournalEntry | Planned |
| Skills | Item | Not started |
| Abilities | Item | In progress |
| Types | Item | In progress |
| Descriptors | Item | In progress |
| Foci | Item | In progress |
| Equipment | Item | Planned |
| Weapons | Item: attack | Planned |
| Armor | Item: armor | Planned |
| Shields | Item: shield | Planned |
| Cyphers | Item: cypher | Planned |
| Artifacts | Item: artifact | Planned |
| Oddities | Item: oddity | Planned |
| Genres | JournalEntry | Planned |
| Creatures / NPCs | Actor: npc | Planned |
| GM procedures | JournalEntry | Planned |
| Random tables | RollTable | Planned where the CRD contains actual tables |

## 3. Genre library

Genre material is a first-class part of the CRD conversion. It must not be
collapsed into a generic "genre" Journal.

The exact family list must be derived from the supplied CRD revision. Current
examples identified in the CRD include:

- Real World
- Fantasy
- Science Fiction
- Superhero
- Postapocalypse
- Horror and other genre-specific sections present in the source

Each genre should provide, where the CRD supplies the material:

- genre overview;
- character-creation procedure;
- genre skill list;
- recommended Types;
- recommended Foci;
- equipment;
- cyphers;
- genre-specific abilities;
- genre-specific rules;
- GM guidance.

Genre entries should link to reusable records instead of duplicating them.

## 4. GM tools and automation

The compendium project is also intended to provide the structured data needed
for later automation.

Potential GM-facing tools include:

- task/difficulty quick reference;
- attack and defense helpers;
- damage and wound application;
- group damage application;
- GM intrusion helper;
- recovery helper;
- random cypher generation;
- treasure/equipment generation;
- encounter and creature references;
- condition and status reference;
- initiative reference;
- loot and reward reference.

A tool must consume structured compendium data where possible. It must not
reimplement CRD content independently.

## 5. Quick Reference layer

Quick Reference is deliberately separate from the full Player and GM Guides.

Target entries include:

- Task Difficulty
- Task Steps
- Effort
- Edge
- Assets
- Range
- Movement
- Attack
- Defense
- Damage
- Wounds
- Recovery
- Cyphers
- Advancement
- XP
- GM Intrusions
- Conditions

Each entry should be concise and link to its detailed source rule.

## 6. Character-content completion order

The reusable player content should be completed in dependency order:

1. Skills
2. Abilities
3. Types
4. Descriptors
5. Foci
6. Equipment
7. Weapons
8. Armor
9. Shields
10. Cyphers
11. Artifacts
12. Oddities

Types and Foci depend on reusable Ability references. Genre-specific Skills
and content must use the same logical-key contract.

## 7. GM-content completion order

GM content should follow the same dependency-first approach:

1. Core GM procedures
2. Quick Reference
3. Creature/NPC model coverage
4. Creature records
5. Random tables
6. Rewards and treasure
7. Genre GM guidance
8. GM Guide landing/navigation entries

## 8. Bilingual contract

Every authored CRD content family must have matching English and French
logical keys.

Mechanical data must remain identical between language variants.

French localization may use the supplied French Character Book translation
when it corresponds to the English source. Otherwise the English source remains
the fallback until a faithful translation is available.

No translation may change a rule, number, cost, duration, range, tier,
prerequisite, or other mechanical value.

## 9. Provenance and audit

Every generated family must remain traceable to the CRD.

The audit must be able to detect:

- missing logical keys;
- duplicate logical keys;
- missing English/French pairs;
- broken document references;
- missing provenance;
- mechanical divergence between language variants;
- records that do not conform to their Foundry DataModel;
- registered packs without authored source;
- authored packs missing from `system.json`;
- compiled packs that are stale relative to their source.

Representative fixtures are regression boundaries, not substitutes for full
source extraction.

## 10. Implementation phases

### Phase 1 — Architecture

- Source envelope and provenance
- Pack boundaries
- Foundry document mapping
- Bilingual identifiers
- Build pipeline
- Contract tests

Status: complete.

### Phase 2 — Core CRD rules and character foundations

- Core rules Journals
- Effort and recovery
- Movement and combat
- Task resolution
- Special rolls
- XP and advancement
- Ability lifecycle and structured effects

Status: substantially complete.

### Phase 3 — Reusable player content

- Complete Skills
- Complete Abilities
- Complete Types
- Complete Descriptors
- Complete Foci
- Complete equipment families

Status: in progress.

### Phase 4 — Guides and quick reference

- Player Guide
- GM Guide
- Quick Reference
- Cross-linking and navigation

Status: planned.

### Phase 5 — Genres

- Complete genre-specific rules
- Genre Skills
- Genre content references
- Genre character creation
- Genre GM guidance

Status: planned.

### Phase 6 — GM library

- Creatures
- Creature abilities
- Random tables
- Rewards and treasure
- GM procedures
- GM Guide completion

Status: planned.

### Phase 7 — Automation and polish

- Compendium-driven macros and helpers
- Search-friendly folders and naming
- Icons
- Cross-language consistency
- E2E verification of representative player and GM workflows
- Final provenance and stale-build audits

Status: planned.

## 11. Immediate work queue

The next implementation steps are deliberately concrete:

1. Complete the coverage audit against `system.json` and authored
   `packs/*/_source` directories.
2. Add the Skills source packs and extract the CRD skill definitions.
3. Complete missing Ability/Type/Descriptor/Focus records without duplicating
   existing data.
4. Add the Equipment family with structured level, price, range, damage,
   depletion, and other source-established mechanics.
5. Add the Quick Reference layer.
6. Add Player Guide and GM Guide landing entries after their linked content
   exists.
7. Add genre packs and genre-specific navigation.
8. Add creature and GM-tool content once the underlying models are verified.

The order is intentional: guides and automation should sit on top of complete,
validated source data rather than becoming a second, manually maintained
content database.
