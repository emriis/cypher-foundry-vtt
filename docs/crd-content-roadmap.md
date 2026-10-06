# CRD Content Roadmap

This document is the master implementation roadmap for converting the
2026-07-29 Cypher Reference Document (CRD) into a Foundry-first reference
library and automation-ready content source.

The target is not a PDF copied into Journals. The final library must be
searchable, linkable, bilingual, structurally useful to automation, and
organized around how players and GMs actually use Foundry.

This document is also the project status board. Each work item has an explicit
state and completion criteria so implementation can continue without
reconstructing the plan from individual pull requests.

## 1. Status legend

- **Complete** — implementation and acceptance tests are complete and merged.
- **In progress** — implementation exists but the family is not yet complete.
- **Planned** — not yet implemented.
- **Blocked** — requires a model, source, or architectural decision before
  implementation can proceed.

A family is not complete merely because a few representative records exist.
Completion requires source coverage, bilingual pairing where applicable,
structured mechanics, provenance, reference integrity, and passing CI.

## 2. Program status at a glance

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Architecture and source/build foundations | **Complete** |
| 2 | Core CRD rules and character foundations | **In progress** |
| 3 | Reusable player content | **In progress** |
| 4 | Journals, Quick Reference, and guides | **Planned** |
| 5 | Genres | **In progress** |
| 6 | GM library | **Planned** |
| 7 | Automation, E2E, and final polish | **Planned** |

Current priority:

1. Complete the reusable character-content pipeline.
2. Build the CRD Journal/reference layer from canonical source data.
3. Complete equipment and remaining content families.
4. Build the Player Guide, GM Guide, and Quick Reference on top of validated
   reference data.
5. Expand genre and GM content.
6. Drive automation from structured compendium data.

## 3. End-state architecture

The CRD conversion has four complementary layers:

    CRD
      |
      | extraction / normalization
      v
    canonical source records
      |
      +--------------------+
      |                    |
      v                    v
    structured data      Journal/reference data
      |                    |
      v                    v
    Foundry Items/Actors   Foundry Journals
      |                    |
      +---------+----------+
                |
                v
           automation

Compiled LevelDB packs are generated artifacts and must never be edited
manually.

### 3.1 Structured reusable content

| CRD family | Foundry representation | Status |
| --- | --- | --- |
| Skills | Item: skill | **Complete** |
| Abilities | Item: ability | **Complete catalogue** |
| Types | Item: type | **Complete** |
| Descriptors | Item: descriptor | **In progress** |
| Foci | Item: focus | **In progress** |
| Equipment | Item: equipment | **Complete** |
| Weapons | Item: attack | **Complete** |
| Armor | Item: armor | **Complete** |
| Shields | Item: shield | **Complete** |
| Cyphers | Item: cypher | **Complete — subtle, manifest, and Power Boost extracted** |
| Artifacts | Item: artifact | **Model ready — extraction planned** |
| Creatures / NPCs | Actor: npc | Planned |

### 3.2 Reference Journals

| Reference family | Representation | Status |
| --- | --- | --- |
| Core rules | JournalEntry | **In progress** |
| Quick Reference | JournalEntry | Planned |
| Genres | JournalEntry | Planned |
| GM procedures | JournalEntry | Planned |
| Player Guide | JournalEntry | Planned |
| GM Guide | JournalEntry | Planned |

The Journal layer is not a second source of truth. It must be generated from
or linked to canonical CRD source data.

### 3.3 Automation

Automation consumes structured data and must not maintain a parallel hand-written
rules database.

## 4. Phase 1 — Architecture and foundations

**Status: Complete**

Completed foundations include source provenance, stable logical identifiers,
bilingual identity, pack boundaries, Foundry mapping, deterministic builds,
migrations, architecture audits, contract tests, CRD fixtures, fidelity
assertions, Foundry E2E infrastructure, and CI validation.

The architecture is now stable enough that new CRD content should extend it
rather than trigger another broad architectural rewrite.

## 5. Phase 2 — Core rules and character foundations

**Status: In progress**

### 5.1 Core rules source layer

- [x] Existing core rule model/configuration foundations
- [ ] Complete CRD core-rules Journal inventory
- [ ] Extract authoritative Journal source records
- [ ] Preserve section/provenance relationships
- [ ] Validate EN/FR rule pairing

### 5.2 Rules used by automation

- [x] Core stat/pool/Edge configuration foundations
- [x] Effort cost calculation foundations
- [x] Damage/wound rule foundations
- [x] Advancement-related rule foundations
- [ ] Complete CRD fidelity coverage for core procedures
- [ ] Link structured automation rules to CRD reference entries

### 5.3 Ability runtime model

- [x] Structured Ability data model
- [x] Action categories
- [x] Enabler handling
- [x] Costs and cost options
- [x] Structured effects
- [x] Tier-specific effects
- [x] Ability references from Types/Foci
- [ ] Complete runtime application of all structured Ability effects
- [ ] E2E coverage for representative Ability activation workflows

## 6. Phase 3 — Reusable player content

**Status: In progress**

Dependency order:

    Skills -> Abilities -> Types -> Descriptors -> Foci -> Equipment

### 6.1 Skills — Complete

- [x] Complete 2026-07-29 CRD Master Skill List inventory
- [x] English and French source records
- [x] Stable logical IDs
- [x] Descriptions and tier restrictions
- [x] Provenance and source pairing
- [x] Contract/fidelity tests

French records may retain English CRD text when no faithful supplied French
localization exists.

### 6.2 Abilities — Complete catalogue

PR62 established the current baseline:

- [x] Global inventory across standalone, Type, Focus, Genre, and other
  explicitly reusable sources
- [x] Canonical identity independent of display name
- [x] Same-name/different-mechanics variants preserved
- [x] Identical canonical abilities deduplicated
- [x] English canonical records
- [x] French pairing
- [x] Provenance
- [x] Editorial-artifact filtering
- [x] Genre Ability integration
- [x] Type/Focus references
- [x] Structured mechanics
- [x] Deterministic migration and CI coverage
- [ ] Multi-source provenance array for one canonical Ability
- [ ] Complete runtime exploitation of every structured effect

The remaining items are runtime/provenance work, not another identity rewrite.

### 6.3 Types — In progress

- [x] Complete CRD Type inventory
- [x] Audit current Type source records against the CRD
- [x] Canonical logical IDs and EN/FR pairing
- [x] Pool, Edge, wound, weapon, armor, and skill mechanics
- [x] Stat choices and selectable benefits
- [x] Canonical Ability and Skill references
- [x] Tier-specific Ability relationships
- [x] Provenance
- [x] Fidelity fixtures
- [x] Business/content contract tests
- [x] Full CI validation

**Completed in PR64. Next implementation target: Descriptors.**

### 6.4 Descriptors — In progress

- [ ] Complete CRD Descriptor inventory
- [ ] Standard and species-style descriptors
- [ ] Stat modifications
- [ ] Skill training/specialization
- [ ] Fixed benefits
- [ ] Genre availability
- [ ] Second-descriptor rules
- [ ] EN/FR pairing and provenance
- [ ] Fidelity and contract tests
- [ ] Model-gap review for automation-sensitive benefits

Source-specific passive benefits must not become standalone Abilities unless
the CRD presents them as reusable abilities.

### 6.5 Foci — In progress

- [ ] Complete CRD Focus inventory
- [ ] Canonical Ability references
- [ ] Flowchart nodes and edges
- [ ] Tier progression
- [ ] Prerequisites
- [ ] EN/FR pairing
- [ ] Provenance
- [ ] Fidelity tests
- [ ] Reference-integrity tests

### 6.6 Equipment family — In progress

- [ ] General equipment
- [ ] Weapons
- [ ] Armor
- [ ] Shields
- [x] Subtle Cyphers — complete 2026-07-29 CRD inventory
- [x] Manifest Cyphers — 103-record 2026-07-29 CRD inventory / 106 random-table placements
- [x] Power Boost Cyphers — complete 2026-07-29 CRD inventory
- [ ] Artifacts — source-blocked: the supplied 2026-07-29 CRD contains no Artifact inventory

Where supplied by the CRD, preserve structured level, price, range, damage,
weapon/armor category, depletion, identification, special properties,
quantity, weight, and equipment state.

No source mechanic should be discarded because the current model lacks a field.
Document and test a model extension instead.

## 7. Phase 4 — CRD Journals, Quick Reference, and guides

**Status: Planned**

The Journal layer is a product feature, not a cosmetic final step.

### 7.1 Core CRD Journal

- [ ] Inventory reference/procedure sections
- [ ] Define Journal page hierarchy
- [ ] Create EN/FR source records
- [ ] Preserve section provenance
- [ ] Link rules to structured Items/Actors
- [ ] Link related procedures and cross-references
- [ ] Validate against duplicated authoritative text

### 7.2 Quick Reference

- [ ] Task Difficulty
- [ ] Task Steps
- [ ] Effort
- [ ] Edge
- [ ] Assets
- [ ] Range
- [ ] Movement
- [ ] Attack
- [ ] Defense
- [ ] Damage
- [ ] Wounds
- [ ] Recovery
- [ ] Cyphers
- [ ] Advancement
- [ ] XP
- [ ] GM Intrusions
- [ ] Conditions

### 7.3 Player Guide

Target packs: player-guide-en and player-guide-fr.

The guide is a navigation layer covering character creation, core character
rules, Types, Descriptors, Foci, Abilities, equipment, combat, recovery,
advancement, genre creation, and Quick Reference. It must link to authoritative
content instead of duplicating it.

### 7.4 GM Guide

Target packs: gm-guide-en and gm-guide-fr.

The guide is a navigation layer covering running Cypher, tasks, combat,
damage/recovery, GM Intrusions, advancement, creatures, rewards, genres,
tables, and Quick Reference.

## 8. Phase 5 — Genres

**Status: In progress**

### 8.1 Genre inventory

- [ ] Derive the complete genre list from the supplied CRD revision
- [ ] Record genre-specific sections and provenance
- [ ] Identify genre-specific skills, Types, Foci, equipment, cyphers, and
  abilities

### 8.2 Genre Abilities — Complete canonical extraction

- [x] Fantasy Genre Abilities
- [x] Science Fiction Genre Abilities
- [x] Superhero Genre Abilities
- [x] Global canonical identity integration
- [x] Same-key/different-mechanics variants
- [x] EN/FR materialization
- [x] Provenance
- [x] Contract tests

### 8.3 Genre Journals

- [ ] Genre overview
- [ ] Character-creation procedure
- [ ] Genre rules
- [ ] Genre skill guidance
- [ ] Recommended character options
- [ ] Genre equipment/cyphers
- [ ] Genre GM guidance
- [ ] Cross-links to reusable content

## 9. Phase 6 — GM library

**Status: Planned**

### 9.1 GM procedures

- [ ] GM rules
- [ ] GM Intrusions
- [ ] Encounter guidance
- [ ] Creature rules
- [ ] Rewards and treasure
- [ ] Preparation and adjudication guidance

### 9.2 Creatures and NPCs

- [ ] Audit the Actor model against actual CRD requirements
- [ ] Extend the model only for source-backed requirements
- [ ] Complete creature inventory
- [ ] Structured level/health/armor/damage/movement
- [ ] Attacks and combat data
- [ ] Modifications
- [ ] Interaction/use/loot
- [ ] Ability references
- [ ] EN/FR pairing where appropriate
- [ ] Provenance
- [ ] Fidelity tests

### 9.3 Random tables

- [ ] Inventory actual CRD random tables
- [ ] Represent genuine random tables as RollTables
- [ ] Keep prose lists as Journal content
- [ ] Validate results and weights

## 10. Phase 7 — Automation, E2E, and final polish

**Status: Planned**

### 10.1 Compendium-driven automation

- [ ] Ability activation and cost handling
- [ ] Skill/task helpers
- [ ] Character creation
- [ ] Equipment handling
- [ ] Weapon attacks
- [ ] Armor/shields
- [ ] Cypher/artifact depletion
- [ ] Damage/wounds
- [ ] Recovery
- [ ] GM intrusion helper
- [ ] Random generation
- [ ] Encounter/creature helpers

Automation may be implemented incrementally whenever the required structured
data is available; Phase 7 is the completion/coverage phase, not a ban on
earlier automation.

### 10.2 Usability

- [ ] Search-friendly names
- [ ] Consistent folders
- [ ] Icons
- [ ] Cross-language navigation
- [ ] Journal landing pages
- [ ] Cross-links between rules and reusable content

### 10.3 Verification

- [ ] Representative player E2E workflows
- [ ] Representative GM E2E workflows
- [ ] Cross-language consistency audit
- [ ] Provenance audit
- [ ] Broken-reference audit
- [ ] Stale-build audit
- [ ] Public-data/license audit

## 11. Cross-cutting contracts

### Identity

- Display name is never the canonical deduplication key.
- Same name + identical content/mechanics may share one canonical record.
- Same name + different content/mechanics must remain separate.
- Reuse by several sources must not create duplicate canonical Items.

### Bilingual content

- English and French records share canonical logical identity.
- Mechanical data remains equivalent between languages.
- French may temporarily retain English CRD text when no faithful supplied
  localization exists.
- Translation never changes rules, numbers, costs, durations, ranges, tiers,
  prerequisites, or other mechanics.

### Provenance

Every CRD-derived record must be traceable to its source section and language.
The build pipeline must preserve source identity and structural transformations.

### Automation-first data

If a CRD mechanic maps to a supported structured field, it belongs in that
field rather than only in prose.

If the model cannot faithfully represent a mechanic:

1. preserve source text;
2. document the model gap;
3. extend the model only from an explicit source requirement;
4. add tests before using the new field.

### Testing

Business/content tests validate contracts and invariants rather than arbitrary
compendium counts.

Completed families require, as applicable:

- schema tests;
- identity tests;
- provenance tests;
- EN/FR pairing tests;
- reference-integrity tests;
- mechanical fidelity tests;
- build/compile validation;
- CI validation.

## 12. Definition of done for a CRD content family

A family is complete only when all applicable items are true:

- [ ] Complete source inventory
- [ ] Source classification
- [ ] Canonical logical IDs
- [ ] English source records
- [ ] French paired records
- [ ] Structured mechanics
- [ ] Provenance
- [ ] Reference integrity
- [ ] Model-gap review
- [ ] Representative fidelity fixtures
- [ ] Business/content contract tests
- [ ] Deterministic migration/build
- [ ] CI green
- [ ] Documentation updated
- [ ] No duplicate canonical records
- [ ] No dangling references

A documented genuine source/model limitation may be an explicit exception.

## 13. Current work queue

### W1 — Complete Types

- [x] Audit current Type source records against the 2026-07-29 CRD
- [x] Build complete Type inventory
- [x] Normalize Type mechanics
- [x] Resolve Ability and Skill references
- [x] Complete EN/FR pairing and provenance
- [x] Add fidelity and contract tests
- [x] Merge only after CI is green

### W2 — Complete Descriptors

- [x] Inventory descriptors and species-style descriptors
- [x] Normalize stat/skill/benefit mechanics
- [x] Review source-specific benefits versus reusable Abilities
- [x] Complete EN/FR pairing and provenance
- [x] Add fidelity and contract tests

### W3 — Complete Foci

- [x] Inventory all Foci
- [x] Rebuild Ability references
- [x] Validate flowchart structure and tier progression
- [x] Complete EN/FR pairing and provenance
- [x] Add structural inventory and reference contracts
- [x] Add CRD fidelity tests

**Completed after PR72: all 42 Foci have standalone Ability references, flowchart integrity/tier checks, EN/FR identity checks, provenance contracts, and representative CRD fidelity coverage.**

### W4 — Equipment foundations

**Status: Complete for all source-backed equipment families in the supplied 2026-07-29 CRD. Artifact extraction is source-blocked because the supplied CRD contains no Artifact inventory.**

- [x] Build the complete canonical inventory of the equipment, weapons, armor,
  shields, and Cyphers present in the supplied CRD
- [x] Validate current model fields against the core CRD mechanics
- [x] Document model gaps and source-backed extensions
- [x] Validate weapon-specific mechanical properties against representative CRD
  tables
- [x] Implement justified model extensions
- [x] Extract content with provenance and bilingual pairing
- [x] Add fidelity and contract tests

### W5 — CRD Journal foundation

- [ ] Inventory reference/procedure sections
- [ ] Define Journal source schema and page hierarchy
- [ ] Implement deterministic Journal generation
- [ ] Link Journal entries to structured records
- [ ] Add EN/FR and provenance tests

### W6 — Quick Reference

- [ ] Extract high-frequency rules
- [ ] Create concise Journal entries
- [ ] Link to authoritative detailed rules
- [ ] Add navigation and tests

### W7 — Player/GM Guides

- [ ] Build player navigation after linked content exists
- [ ] Build GM navigation after linked GM content exists
- [ ] Validate all links

### W8 — Genres and GM library

- [ ] Complete genre inventory and reference layer
- [ ] Complete creature/NPC source coverage
- [ ] Add actual CRD random tables
- [ ] Add GM procedures and rewards

### W9 — Automation and E2E

- [x] Define the first player-facing alpha vertical slice

- [ ] Consume structured compendium data from application services
- [ ] Automate high-value player workflows
- [ ] Automate high-value GM workflows
- [ ] Expand E2E coverage
- [ ] Run final provenance/reference/stale-build audits

## 14. Historical milestones

- Architecture foundations: complete.
- Skills: complete 2026-07-29 CRD Master Skill List extraction.
- Ability identity hardening: complete.
- Ability catalogue: PR62 merged; canonical identity, variants, provenance,
  localization, Genre Ability integration, and reference integrity are the
  current baseline.
- CI diagnostics: unit-test output uses Node's spec reporter.

Future PRs should be referenced here only when they represent a meaningful
roadmap milestone, not for every implementation commit.

## 15. Source and governance rules

- The 2026-07-29 CRD remains the source revision tracked by this roadmap.
- Do not invent missing rules or silently repair source ambiguities.
- Do not make Journals a second source of truth.
- Do not duplicate reusable Abilities.
- Do not use display names as canonical identity keys.
- Do not weaken tests to make extraction pass.
- Do not hand-edit generated LevelDB packs.
- Keep repository documentation in English.
