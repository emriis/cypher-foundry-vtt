# CRD to Foundry Content Mapping

This document defines the current mapping from the 2026-07-29 Cypher Reference
Document (CRD) to the Foundry document and data-model types supported by the
system.

The mapping is structural. It does not rewrite CRD rules.

## 1. Canonical mapping

| CRD family | Foundry document | Foundry type/model | Current source status |
| --- | --- | --- | --- |
| Ability | Item | ability | Complete |
| Armor | Item | armor | Complete |
| Cypher | Item | cypher | Complete |
| Descriptor | Item | descriptor | Complete |
| Equipment | Item | equipment | Complete |
| Focus | Item | focus | Complete |
| Skill | Item | skill | Complete |
| Type | Item | type | Complete |
| Weapon | Item | attack | Complete source inventory |
| Shield | Item | shield | Complete source inventory |
| Artifact | Item | artifact | Source-blocked: no Artifact inventory in supplied CRD |

Weapon -> Item attack reflects the repository's existing data model. Weapon
remains the CRD source family.

The repository also supports JournalEntry content for rules and genre/reference
material, but the full CRD Journal conversion remains future work.

The repository contains a general Actor NPC/creature model. It is not listed as
a CRD extraction family because the supplied CRD contains no creature inventory.

## 2. Existing domain models

The CRD conversion uses existing Foundry models rather than creating parallel
CRD-only mechanical models.

### Ability

Structured data includes:

- tier;
- canonical key;
- enabler/repeatable state;
- stat cost and cost options;
- action requirement;
- free weapon/armor/skill categories;
- weapon attack-category choices;
- ability effects and modifiers;
- recovery-based end conditions;
- roll tables;
- description.

Types and Foci reference standalone Ability Items rather than embedding their
definitions.

### Type

Structured data includes:

- tier;
- genre/subgenre;
- Pool bonuses;
- Edge choices;
- wound bonuses;
- weapon/armor access;
- weapon families;
- weapon skill categories;
- skill choices;
- Ability UUID references;
- stat choices;
- description.

### Focus

Structured data includes:

- standalone Ability UUID references;
- flowchart edges;
- description.

### Descriptor

Structured data includes:

- descriptor/species category;
- genre availability;
- second-descriptor behavior;
- stat choices and amount;
- skill choices;
- fixed granted skills;
- benefits;
- description.

### Skill

Structured data includes:

- associated stat;
- training level;
- attack skill category;
- tier restrictions;
- description.

### Weapon

Weapons use the existing attack Item model. Structured data includes:

- attack category;
- range and extreme-range information;
- damage;
- associated stat;
- weapon family;
- attack skill category;
- mechanical properties;
- target effects;
- price/equipment metadata where source-backed;
- free-use and equipped state;
- description.

The source layer preserves these mechanics even when a particular runtime effect
is not yet executed.

### Armor

Structured data includes:

- armor category;
- free-use state;
- equipped state;
- Block-related behavior;
- source-backed equipment metadata;
- description.

### Shield

Structured data includes:

- equipped state;
- independent minor/moderate/major wound track;
- source-backed equipment metadata;
- description.

### Equipment

Structured data includes:

- level;
- price category;
- quantity;
- weight;
- equipped state;
- optional depletion;
- description.

### Cypher

Structured data includes:

- subtle/manifest category;
- level;
- power level and power-level metadata;
- depletion state;
- depletion range/die where supplied;
- variants;
- random ranges;
- roll tables;
- description.

### Artifact

The Artifact DataModel exists and supports level, form, identification, depletion,
and related state. The supplied CRD does not contain an Artifact inventory, so
there is no CRD Artifact source extraction to map at present.

## 3. Rules and genre content

General rules and genre references are represented as Journal Entries when they
are primarily reference and navigation material.

Actual random tables should become RollTables only when the source is genuinely
a random table. A prose list must not be converted into a RollTable merely
because it contains several choices.

## 4. Mechanical-field policy

The source extractor must prefer the existing domain model for mechanical data.

When a CRD weapon provides damage, range, category, or target effects, those
values must populate the corresponding structured fields without changing their
meaning.

If the CRD contains a mechanic with no faithful representation in the current
model, the extractor must not silently discard it or invent a new interpretation.

The correct action is to:

1. preserve the source text where possible;
2. record the model gap;
3. extend the domain model only after the source requirement is established;
4. add tests before runtime consumption.

## 5. Language pairing

English and French records use the same CRD logical identifier.

For example:

    weapon.some-weapon

identifies the same source content in both English and French packs.

Foundry _id values are implementation identifiers and are not used as the
cross-language key.

## 6. References

Source authoring uses stable logical IDs. Pack compilation resolves those
references to Foundry UUIDs after the complete source set is known.

For example:

    Type
      -> Ability logical ID
      -> compiled Ability UUID

    Focus
      -> Ability logical ID
      -> compiled Ability UUID

No build may leave a dangling or ambiguous reference.

## 7. Automation-first authoring rule

Structured Item fields are intended for both presentation and automation.

When a CRD mechanic has a corresponding structured field, extraction must put
the mechanic in that field rather than relying only on prose.

Examples include:

- Ability Pool cost, action, and tier-specific effects;
- Type tiered Ability grants;
- Skill tier restrictions;
- Weapon range, damage, price category, properties, and target effects;
- Equipment level and price category;
- Cypher power level, depletion, variants, and roll-table data.

The description remains the source wording and context, but it is not a
substitute for structured mechanics.

A structured field must never be populated by inference when the CRD does not
support the mapping.

## 8. Current model extensions

The extraction work has already justified structured representation for:

- CRD range categories and extreme range;
- equipment level and price category;
- weapon mechanical properties and target effects;
- Type Ability-to-tier relationships;
- Ability additional-Effort cost markers;
- Ability tier-specific effects;
- Skill tier restrictions;
- Cypher power levels;
- Cypher variants and roll-table metadata.

These are source-backed model capabilities. Runtime consumption is tracked
separately from extraction fidelity.

## 9. Runtime integration boundary

The content mapping intentionally distinguishes extraction from runtime behavior.

Currently:

- Ability structured costs/effects/lifecycle are runtime-functional;
- Type/Focus advancement benefits are runtime-functional for supported categories;
- core weapon attacks are runtime-functional;
- Cypher depletion is runtime-functional;
- weapon target effects are extracted and validated but not yet fully consumed
  by attack resolution;
- generic Cypher variants/random ranges/roll tables are not yet fully executed
  by a generic runtime layer.

This distinction prevents the content documentation from overstating automation
coverage.
