# CRD Source Schema

This document defines the authored source contract for content extracted from the
2026-07-29 Cypher Reference Document.

The schema defines the common provenance and identity envelope while each Foundry
document type keeps its domain-specific system schema.

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

The schema does not replace the existing domain DataModels.

## 2. Provenance

The canonical provenance path is:

    flags.cypherFoundry.crd

Required fields:

- version: supplied CRD version;
- logicalId: stable identifier shared by language variants;
- language: en or fr;
- sourceKind: section, passage, table, or record;
- section: CRD section containing the source material;
- sourceLocator: human-readable page, section, or table locator;
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
table results, conditions, depletion values, variants, and document references.

Localized prose belongs in the language-specific record.

The schema does not translate, normalize, infer, or otherwise rewrite mechanics.

## 5. Structured Ability end conditions

Ability effects may contain a structured endConditions collection when the CRD
states an explicit recovery boundary.

A recovery end condition uses:

| Field | Meaning |
| --- | --- |
| kind | recovery |
| interval | any, tenMinutes, hour, or tenHours |
| minimum | Whether the stated interval is a minimum threshold |

For example, explicit wording equivalent to a ten-minute-or-longer recovery is
represented by:

    {
      kind: "recovery",
      interval: "tenMinutes",
      minimum: true
    }

This is source data, not runtime state.

Only explicit recovery boundaries are structured by this contract. Other
termination conditions remain in source text until a separate source-justified
representation exists.

## 6. Runtime boundary

The source schema and actor runtime state are separate contracts.

The source record defines an Ability effect and its CRD-derived endConditions.
The actor runtime stores only which actor-owned Ability effects are currently
active:

    system.activeAbilityEffects[]
      - itemUuid
      - effectId

This runtime collection is not part of the CRD source record.

Recovery-driven expiration is implemented by the application/runtime boundary.
The persisted Ability reference is resolved first, then the pure rule evaluates
the source-defined recovery condition.

## 7. Structural transformations

Allowed transformations include:

- converting a CRD heading into a Journal Entry title;
- converting an actual random table into a Foundry RollTable;
- representing Type or Focus abilities as references to standalone Ability Items;
- converting source formatting into Foundry HTML or structured fields.

Transformations must be recorded in the transformations array.

Forbidden transformations include paraphrasing, summarizing, changing numbers or
units, changing prerequisites or costs, silently resolving ambiguities, or
inventing missing mechanics.

If extraction cannot establish a reliable mapping, the extractor must stop or
record an explicit model/source limitation rather than guessing.

## 8. Bilingual pairing

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

## 9. Validation contract

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
is established against the extracted source material and representative source
contracts.

## 10. Current source-backed content families

The current CRD source conversion covers:

    ability
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

The Artifact Item type remains part of the system's supported document model,
but the supplied CRD contains no Artifact inventory, so no Artifact source family
is currently emitted.

The Actor creature/npc type also remains a general system capability, but the
supplied CRD contains no creature inventory and therefore no CRD creature source
family is currently emitted.

## 11. Extraction boundary

Every automated extractor must:

1. identify the CRD section;
2. assign a stable logical identifier;
3. preserve source text and mechanics;
4. record provenance;
5. validate the resulting source record;
6. refuse to emit a record when the source mapping is ambiguous.

## 12. Logical identifiers and cross-language pairing

Every reusable CRD record has one language-neutral logicalId.

The canonical form is:

    <content-family>.<normalized-source-name>

The logical ID is a source key. It is not a Foundry _id, UUID, display name, or
translation key.

### Identifier rules

- The content-family prefix is one of the canonical CRD content families.
- The source name is normalized deterministically.
- Identifiers use lowercase ASCII characters, digits, and hyphens.
- The two components are separated by one period.
- Localized names never replace the logical ID.
- Foundry _id values remain implementation identifiers.
- Logical IDs remain stable across pack rebuilds and language variants.

### English/French pairing

English is the canonical source record for the CRD content key.

A French record carries the same logical ID and additionally records
sourceLogicalId pointing to the English logical ID.

### References

References between authored records should first be expressed using logical
IDs during source authoring and extraction.

The build phase resolves those logical IDs to Foundry UUIDs after all source
records are known.

A source reference that cannot be resolved to exactly one authored record is a
build error. The build must not guess between candidates.

### Duplicate detection

A source build must reject:

- duplicate logical IDs within one language;
- duplicate logical IDs across incompatible content families;
- French records without a matching English logical ID;
- references to missing logical IDs;
- references that resolve to more than one record;
- logical IDs derived from localized French names instead of canonical source
  names.

## 13. Source/model/runtime distinction

For each mechanically meaningful CRD field, the project distinguishes:

1. extracted;
2. modeled;
3. validated;
4. consumed by runtime;
5. covered by an appropriate behavior/E2E contract.

The source schema guarantees the first four content-layer requirements only
where the model supports them. Runtime completion is tracked by the application
and behavior documentation rather than being silently implied by extraction.
