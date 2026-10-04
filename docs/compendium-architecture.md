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

## 9. Authoring rules

- English and French records use the same logical identifiers.
- Mechanical fields remain language-independent where possible.
- Localized names and descriptions belong in the corresponding language pack.
- Do not put UI implementation details into compendium content.
- Do not hand-edit compiled LevelDB files.
- Do not duplicate reusable Ability definitions.
- Preserve CRD wording accurately when the license permits its inclusion.
- Keep attribution/licensing metadata with the generated content and repository documentation.
