# CRD Source Schema

This document defines the authored source contract for content extracted from the
2026-07-29 Cypher Reference Document.

The schema defines the common provenance and identity envelope while each Foundry
document type keeps its domain-specific system schema.

The supplied CRD is the sole source of truth for rules and all compendium facts.
Editable `_source/` JSON is the authoring surface, not an independent authority.
Code, tests, translations, other books, and generated packs cannot override the
CRD. French records must render that CRD content faithfully; translation aids
may provide wording only and must not introduce different content or mechanics.

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

Physical shield runtime designation is stored on the owned shield as
`system.abilityItemId`, referencing an owned Hidden/Unyielding Shield Ability.
It does not alter compendium definitions or infer mechanics from text. Existing
source keys identify Throw/Bouncing Shield actions. See the [shield Ability
contract](shield-abilities.md) for additive defaults and persisted work/flight
state; no source content or saved base wound capacity is rewritten.

Standalone Abilities may also declare `system.passiveModifiers`, using the same
typed modifier records as effects (`kind`, `stat`, `severity`, `amount`). These
are owned benefits with no activation or expiration reference. A modifier's
optional `minimumRank` defaults to zero; Armored Body uses 2. The separate
`shieldWoundCapacity` kind applies only to a shield's effective track.
Missing fields default to an empty array; neither `enabler` nor a
localized name implies a passive modifier. Tough explicitly grants one minor
wound of capacity (CRD 2026-07-29, Fantasy Genre / Mid-Tier Fantasy Abilities;
also Foci / Explores). Both source occurrences preserve this structured grant.
The [complete reviewed capacity inventory](passive-wound-capacity.md) records
the other grants, their source sections, rank eligibility and shield scope.

Descriptor/species `system.benefits[]` may explicitly declare `passiveModifiers`
using that same schema. Content application copies these definitions into the
owned benefit Ability without modifying the source. Missing definitions default
to an empty array; they are never inferred from a benefit's label or prose.
Drakain, Orc and Prota have reviewed +1 minor-wound grants in both language sources.

When content application creates an owned Ability benefit, its runtime
`flags.cypher.grantOrigin` records the granting `kind` and `sourceId` separately
from CRD provenance. Species/Descriptor origins add outside the genre/Type/Focus
capacity group. This flag is not inferred from localized names and does not
automatically structure a benefit's prose. Legacy untagged Ability Items retain
their existing default scope; world documents are not rewritten on startup.

No world-data transformation is required for this additive field. Existing
owned Tough Items without the new metadata retain their previous behavior until
their source data is explicitly refreshed or the Item is replaced. Loading a
world never parses prose or rewrites owned Items. Saved wound maxima remain the
base capacities; `effectiveWounds` is derived without persistence. Removing an
Ability never deletes existing wounds, even when their count exceeds base capacity.

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

Author complete French editorial proposals under `translations/fr/`, against
the exact English fields and their source hashes. The maintained workflow and
glossary are in [Localization authoring and review](localization.md). Proposals
have an explicit `proposed` or `reviewed` status; neither legacy English fallback
text nor a successful build establishes French semantic approval.

Source normalization preserves the French identity and canonical English CRD
locators, aligns structured mechanics, and resolves references to the French
counterparts. Compilation applies eligible text-only proposals to temporary
JSON, leaving the authored `_source` records unchanged. Normal builds select
reviewed proposals; including proposed text is an explicit editorial-preview
option. Translation never determines source identity, action identifiers, costs,
semantic durations or graph edges.

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

The local `audit:crd` workflow compares every English record's description,
Effort text, equipment properties, nested effect/table descriptions, and Journal
pages with the supplied reference. See [the current audit](crd-compendium-audit.md).
Exact fragments establish matching words only; complete named definitions require
bounded passages or explicitly reviewed selections, including relevant callouts.
Headings may move into names/cost fields, and table cells may become HTML, while
their wording, numbers, and row order remain unchanged.

`data/crd-text-fidelity.json` records reviewed source locations and plain-text
SHA-256 evidence for CI. Its scopes distinguish fragments, whole passages,
selected sections, and excluded editorial callouts. These hashes protect reviewed
text against drift; they do not certify missing fields, numeric extraction,
catalogue completeness, or runtime automation. Updating evidence requires a new
comparison with the actual CRD, never regeneration from pack JSON alone.

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
- New slug-based identifiers use lowercase ASCII characters, digits, and hyphens.
- The two components are separated by one period.
- Localized names never replace the logical ID.
- Foundry _id values remain implementation identifiers.
- Logical IDs remain stable across pack rebuilds and language variants.

The equipment inventory originally used non-slug English genre/price/name
tuples (for example `equipment.Fantasy.inexpensive.Arrows (12)`). PR2
normalization now canonicalizes these to
`equipment.fantasy.inexpensive.arrows-12`. All tuple components remain
present; French display names never participate in identity computation.
Legacy editable source files and French editorial proposals may retain old
keys until normalization/translation materialization, but the published
normalized packs use only canonical identities.

Every normalized Item and JournalEntry document has the same `_id` in EN and
FR, computed as the first 16 hex characters of SHA-256 of the canonical UTF-8
logical ID. The parent-derived Folder IDs and English-anchored Journal page
IDs are deterministic too. The full UUID still differs by its EN/FR pack
collection. A translation-only edit cannot alter any of these identities.
This is an intentional breaking change for existing world-stored compendium
UUIDs; back up and reimport or migrate world documents explicitly.

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
