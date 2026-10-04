# CRD Source Schema

This document defines the authored source contract for content extracted from the
2026-07-29 Cypher Reference Document.

The schema defines the common provenance and identity envelope while each Foundry
document type keeps its existing domain-specific system schema.

## 1. Source record envelope

A CRD-derived Foundry source record contains:

| Field | Requirement | Purpose |
| --- | --- | --- |
| _id | Required | Stable Foundry document identifier |
| _key | Required | Foundry LevelDB record key |
| name | Required | User-facing document name |
| type | Required | Foundry content type |
| system | Type-specific | Mechanical/domain data |
| flags.cypherFoundry.crd | Required | CRD identity and provenance |

The schema does not replace the existing Type, Focus, Descriptor, Ability, or
other Foundry data models.

## 2. Provenance

The canonical provenance path is:

    flags.cypherFoundry.crd

Required fields:

- version: supplied CRD version.
- logicalId: stable identifier shared by language variants.
- language: en or fr.
- sourceKind: section, passage, table, or record.
- section: CRD section containing the source material.
- sourceLocator: human-readable page, section, or table locator.
- transformations: structural transformations applied during extraction.

French records additionally require sourceLogicalId, identifying the English
record they translate.

## 3. Logical identifiers

Logical identifiers are stable semantic keys, not Foundry UUIDs.

Recommended format:

    <content-type>.<stable-slug>

Examples:

    ability.inspiring-defense
    skill.athletics
    type.barbarian
    descriptor.charming
    focus.rides-the-lightning
    equipment.backpack

The logical identifier is unchanged between English and French records.
Foundry _id values remain implementation identifiers.

## 4. Mechanical data

Mechanical values stay in the domain-specific system fields wherever the current
data model permits it.

This includes costs, tiers, levels, ranges, durations, damage, prerequisites,
table results, conditions, depletion values, and document references.

Localized prose belongs in the language-specific record.

The schema does not translate, normalize, infer, or otherwise rewrite mechanics.

## 5. Structural transformations

Allowed transformations include:

- converting a CRD heading into a Journal Entry title;
- converting an actual random table into a Foundry RollTable;
- representing Type or Focus abilities as UUID references to standalone Ability
  Items;
- converting source formatting into Foundry HTML or structured fields.

Transformations must be recorded in the transformations array.

Forbidden transformations include paraphrasing, summarizing, changing numbers or
units, changing prerequisites or costs, silently resolving ambiguities, or
inventing missing mechanics.

If extraction cannot establish a reliable mapping, the extractor must stop.

## 6. Bilingual pairing

The pairing model is:

    CRD source
       |
       +-- logicalId: ability.inspiring-defense
       |
       +-- English record
       |     language: en
       |
       +-- French record
             language: fr
             sourceLogicalId: ability.inspiring-defense

French is a localization layer, not an independent mechanical source.

## 7. Validation contract

The source validator rejects:

- invalid Foundry identity;
- unsupported content types;
- missing CRD version;
- missing logical identifiers;
- invalid language;
- missing section or source locator;
- invalid source kind;
- missing transformation metadata;
- French records without an English source identifier.

The validator does not attempt to judge the correctness of CRD prose. Fidelity
must be established against the extracted source material.

## 8. Phase 2 content types

The initial contract covers:

    ability
    artifact
    armor
    cypher
    descriptor
    equipment
    focus
    genre
    journal
    shield
    skill
    type
    weapon

Creature/Actor-specific source fields will be defined with the creature
extraction phase rather than guessed now.

## 9. Extraction boundary

Every automated extractor must:

1. identify the CRD section;
2. assign a stable logical identifier;
3. preserve source text and mechanics;
4. record provenance;
5. validate the resulting source record;
6. refuse to emit a record when the source mapping is ambiguous.
