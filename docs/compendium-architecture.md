# CRD Compendium Architecture

This document defines how the 2026 Cypher Reference Document (CRD) is represented as Foundry VTT content.

The goal is to make the CRD useful from inside Foundry rather than importing it as one large Journal Entry. Content should become searchable, linkable, draggable, and reusable wherever the Foundry document model provides a meaningful representation.

## 1. Source and build pipeline

The CRD is the reference source. Repository source data is the editable representation; compiled LevelDB files remain generated artifacts.

    Cypher Reference Document
            |
            | extraction / normalization
            v
    packs/*/_source/
            |
            | deterministic pack build
            v
    Foundry LevelDB packs

The CRD itself is not copied into JavaScript modules. Structured content belongs in compendium source records.

The common CRD source-record envelope is defined in
docs/crd-source-schema.md. It establishes stable logical identifiers, bilingual
pairing, and provenance without replacing the domain-specific Foundry schemas.

Every public distribution must retain the attribution and licensing information required by the Cypher Open License. The repository license file and system manifest already identify the CRD as licensed content from Monte Cook Games.

## 2. Pack organization

### Player content

| Pack | Foundry type | Purpose |
| --- | --- | --- |
| abilities-en/fr | Item | Reusable abilities referenced by Types and Foci |
| descriptors-en/fr | Item | Descriptors and species-style descriptors |
| types-en/fr | Item | Character Types |
| foci-en/fr | Item | Character Foci |
| skills-en/fr | Item | Reusable skill definitions |
| equipment-en/fr | Item | Equipment, weapons, armor, shields, and related gear |

The existing four character-content pack families remain authoritative. New packs extend the same source/build conventions.

### Rules and reference content

| Pack | Foundry type | Purpose |
| --- | --- | --- |
| rules-en/fr | JournalEntry | Core rules and detailed procedures |
| genres-en/fr | JournalEntry | Genre rules and genre-specific reference |
| gm-tools-en/fr | JournalEntry | GM procedures, tables, and quick-reference material |

General rules are Journal Entries because they are primarily consulted rather than embedded on actors.

### GM content

| Pack | Foundry type | Purpose |
| --- | --- | --- |
| creatures-en/fr | Actor | Reusable NPC/creature records that can be dragged into scenes |

Creature abilities remain reusable Ability Items when they are mechanically meaningful outside a single creature.

## 3. Player and GM navigation

### Player entry point

1. Core Character
2. Skills
3. Types
4. Descriptors
5. Foci
6. Abilities
7. Equipment
8. Quick Reference

### GM entry point

1. Core Rules
2. Task and Difficulty Rules
3. Combat
4. Damage and Recovery
5. Advancement and XP
6. GM Intrusions
7. Creatures
8. Equipment and Rewards
9. Genres
10. Quick Reference

Navigation will use Foundry Journal links and document UUIDs rather than duplicated text.

## 4. Content classification

| CRD content | Foundry representation |
| --- | --- |
| General rule | JournalEntry |
| Procedure / rules explanation | JournalEntry page |
| Quick-reference rule | JournalEntry |
| Skill | Item: skill |
| Ability | Item: ability |
| Type | Item: type |
| Descriptor | Item: descriptor |
| Focus | Item: focus |
| Weapon / attack | Item: attack |
| Armor | Item: armor |
| Shield | Item: shield |
| General equipment | Item: equipment |
| Cypher | Item: cypher |
| Artifact | Item: artifact |
| Creature / NPC | Actor: npc |
| Creature ability | Item: ability where reusable |
| Genre overview | JournalEntry |
| Random table | RollTable where a real random-table mechanic exists |

## 5. Reuse and references

The existing standalone Ability architecture is preserved. Types and Foci store UUID references to Ability Items and must not embed copies of ability data.

Reference resolution follows the repository convention:

    reference
        |
        v
    resolve document
        |
        v
    validate expected type
        |
        v
    use document

## 6. Genre separation

Genre rules should not be mixed into the core rules pack when they change the available character options, skills, equipment, or assumptions of play.

Genre material should therefore be represented as:
- a genre overview Journal Entry;
- genre-specific rules and character-creation guidance;
- links to reusable Skills, Types, Descriptors, Foci, and Equipment;
- GM guidance specific to the genre.

## 7. Quick Reference

A dedicated quick-reference layer should provide short Journal Entries for:
- Difficulty and task steps
- Common modifiers
- Effort
- Edge
- Assets
- Range
- Movement
- Damage
- Wounds
- Recovery
- Combat
- XP and advancement
- GM Intrusions
- Conditions

Quick Reference entries should be concise and link to the detailed rule entry instead of duplicating the full rule text.

## 8. Extraction phases

### Phase A — Architecture and mapping
- Define pack boundaries.
- Define document-type mapping.
- Preserve standalone Ability/Type/Focus architecture.
- Establish bilingual logical identifiers.
- Define the common CRD source-record envelope and provenance contract.
- Add source and pack contract tests.

### Phase B — Core rules
Convert core character and core rules sections into Journal Entries and Quick Reference entries.

### Phase C — Reusable player content
Convert Skills, Equipment, Weapons, Armor, Shields, Cyphers, and Artifacts into real Items.

### Phase D — Character options
Complete Type, Descriptor, Focus, and Ability collections and link them to reusable Skills.

### Phase E — Genres
Convert genre and real-world sections while keeping genre-specific content discoverable.

### Phase F — GM content
Convert creature/NPC material, GM procedures, tables, and GM quick references.

### Phase G — Navigation and polish
Add player/GM landing Journals, cross-links, folders, icons, search-friendly names, and final bilingual consistency tests.

Each phase should remain independently testable and compilable.

## 9. Fidelity and translation policy

The CRD conversion is a transcription and localization
project, not a rewriting project.

For every CRD-derived record:

- English rules text must remain faithful to the supplied 2026-07-29 CRD.
- No rule, example, exception, value, prerequisite, duration, range, cost,
  damage value, table result, or mechanical qualifier may be invented,
  simplified, modernized, or paraphrased.
- Structural conversion into Foundry fields is allowed only when it preserves
  the source meaning exactly.
- Formatting may change to fit Foundry presentation; the underlying wording and
  mechanical content must not change.
- Apparent source ambiguity or editorial errors must not be silently corrected.
  Preserve the source and flag the issue for review.
- Automation that cannot establish a reliable source-to-record mapping must
  stop rather than guess.

### French localization

The French packs are faithful translations of the CRD-derived English/source
content.

Translation is a separate localization layer. It must not introduce a rules
interpretation absent from the source.

For every translated record:

- Preserve all mechanical meaning exactly.
- Preserve numbers, units, ranges, durations, costs, tiers, levels,
  prerequisites, table probabilities, and conditions exactly.
- Preserve the distinction between rules text, examples, explanations, and
  descriptive text.
- Do not translate by summarization.
- Keep a stable logical source key so English and French records can be compared.
- Flag uncertain translations for review instead of guessing.

### Source provenance

Each generated content family must be traceable back to its CRD section. The
conversion process should retain enough provenance to answer:

1. Which CRD section produced this record?
2. Which source passage or table produced each mechanical field?
3. Which English record is the source of the French translation?
4. Which transformations were structural only?

Provenance may live in source metadata and build-time manifests; it must not
pollute user-facing rules text.

### Automated fidelity checks

Tests should reject:

- missing source keys;
- duplicate logical keys;
- English/French relationship mismatches;
- changed numeric or mechanical fields between language variants;
- Type or Focus references to non-existent Ability records;
- compiled packs missing from authored source packs;
- content records without required provenance.

Representative source-to-record fixtures should cover high-risk content such as
tables, abilities, equipment statistics, and rules containing exceptions.

## 10. Authoring rules

- English and French records use the same logical identifiers.
- Mechanical fields remain language-independent where possible.
- Localized names and descriptions belong in the corresponding language pack.
- Do not put UI implementation details into compendium content.
- Do not hand-edit compiled LevelDB files.
- Do not duplicate reusable Ability definitions.
- Preserve CRD wording accurately when the license permits its inclusion.
- Keep attribution/licensing metadata with the generated content and repository documentation.


## 11. Curated Player and GM guides

The detailed reference packs are not themselves the user-facing reading order.
The final library also contains two curated navigation layers:

- `player-guide-en/fr`: player-facing character creation and play guidance;
- `gm-guide-en/fr`: GM-facing procedures, preparation, adjudication, and reference.

These guides are Journal Entries and link to the authoritative detailed records.
They must not become a second manually maintained copy of the CRD.

The same principle applies to Quick Reference: it provides short, high-frequency
lookups while linking to the full rule entry for detail.

The complete roadmap, including the Player Guide, GM Guide, genre library, GM
library, quick-reference layer, and future automation, is maintained in
`docs/crd-content-roadmap.md`.
