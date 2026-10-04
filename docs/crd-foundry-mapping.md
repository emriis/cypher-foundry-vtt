# CRD to Foundry Content Mapping

This document defines the Phase 2 mapping from CRD content families to the
Foundry document and data-model types already supported by the system.

The mapping is structural. It does not rewrite CRD rules.

## 1. Canonical mapping

| CRD family | Foundry document | Foundry type/model | Source form |
| --- | --- | --- | --- |
| Ability | Item | ability | reusable Item |
| Artifact | Item | artifact | reusable Item |
| Armor | Item | armor | reusable Item |
| Cypher | Item | cypher | reusable Item |
| Descriptor | Item | descriptor | reusable Item |
| Equipment | Item | equipment | reusable Item |
| Focus | Item | focus | reusable Item |
| Skill | Item | skill | reusable Item |
| Type | Item | type | reusable Item |
| Weapon | Item | attack | reusable Item |
| Shield | Item | shield | reusable Item |
| Creature | Actor | npc | reusable Actor |
| General rule | JournalEntry | — | Journal Entry |
| Genre reference | JournalEntry | — | Journal Entry |

The Weapon → Item attack mapping reflects the repository's existing data model:
weapon attacks are represented by item-attack.mjs. It does not mean the CRD
calls the content an attack; Weapon remains the CRD source family.

## 2. Existing domain models

Phase 2 does not create parallel CRD-specific mechanical models when an existing
Foundry model already represents the same domain.

The current repository models provide these mechanical structures:

### Ability
- tier
- key
- enabler/repeatable state
- stat cost
- activation category
- weapon and armor grants
- ability effects
- roll tables
- description

Types and Foci reference standalone Ability Items rather than embedding them.

### Type
- tier
- genre/subgenre
- Pool bonuses
- Edge choice
- wound bonuses
- weapon/armor access
- weapon families
- skill choices
- Ability UUID references
- stat choices
- description

### Focus
- Ability UUID references
- flowchart edges
- description

### Descriptor
- descriptor/species category
- genre availability
- second-descriptor behavior
- stat choices and amount
- skill choices
- fixed granted skills
- benefits
- description

### Skill
- associated stat
- training level
- attack skill category
- description

### Weapon
Weapons use the existing attack Item model:
- attack category
- range
- damage
- associated stat
- weapon family
- attack skill category
- free-use state
- equipped state
- description

### Armor
- armor category
- free-use state
- equipped state
- Block-related value
- description

### Shield
- equipped state
- independent minor/moderate/major wound track
- description

### Equipment
- quantity
- weight
- equipped state
- optional depletion
- description

### Cypher
- subtle/manifest category
- level
- internal state
- identification
- depletion state
- description

### Artifact
- level
- form
- identification
- depletion die and threshold
- depleted state
- description

### Creature
Creatures use the existing Actor NPC model:
- level
- health
- armor
- damage
- movement
- modifications
- combat
- interaction
- use
- loot
- GM notes

The extraction phase must not invent additional structured creature fields when
the CRD source does not map reliably to the existing model. Information that is
not safely representable in a structured field remains source text or is flagged
for model review.

## 3. Rules and genre content

General rules and genre references are Journal Entries rather than Items because
their primary purpose is reference and navigation.

A Journal Entry may contain multiple pages when the CRD section is naturally
structured that way.

Actual random tables should become RollTables only when the source is genuinely
a random table. A prose list must not be converted into a RollTable merely
because it contains several choices.

## 4. Mechanical-field policy

The source extractor must prefer the existing domain model for mechanical data.

When a CRD weapon provides damage, range, and category, these values must
populate the corresponding existing weapon fields without changing their meaning.

If the CRD contains a mechanic that has no faithful representation in the
current model, the extractor must not silently discard it or invent a new
interpretation.

The correct action is to:
1. preserve the source text where possible;
2. flag the model gap;
3. extend the domain model only after the source requirement is established.

## 5. Language pairing

English and French records use the same CRD logical identifier.

For example:

    weapon.some-weapon

must identify the same source content in both English and French source packs.

Foundry _id values are implementation identifiers and are not used as the
cross-language key.

## 6. References

Reusable relationships use Foundry document UUIDs.

    Type
      -> Ability UUID

    Focus
      -> Ability UUID

No extractor may create a dangling UUID reference. The build/test layer must
verify that every referenced Ability exists in the corresponding authored
content.

## 7. Model-extension rule

Phase 2 defines the mapping against the current repository models.

If extraction of the actual CRD reveals a required field that cannot be
represented faithfully, that discovery creates a model-extension task. It does
not justify weakening the fidelity requirement.

A model extension must include:
- the exact source requirement;
- the proposed field and semantics;
- tests;
- documentation;
- compatibility considerations;
- provenance for the affected content.

Only then should the extractor use the new field.
## 8. Automation-first authoring rule

The purpose of the structured Item fields is not merely presentation. They are
the contract used later by character creation, rolling, equipment handling,
depletion, reference resolution, and other automation.

When a CRD mechanic has a corresponding structured field, extraction must put
the mechanic in that field rather than relying only on prose in description.

Examples include:
- an Ability's Pool cost and whether additional Effort can be applied;
- an Ability's tier-specific effects;
- a Type's tiered Ability grants;
- a Skill's tier restriction;
- a Weapon's range, extreme-range behavior, damage, price category, and
  mechanical properties;
- Equipment level and price category;
- Cypher power level;
- Artifact depletion.

The description remains the authoritative source text for wording and context,
but it is not a substitute for structured mechanics.

A structured field must never be populated by inference when the CRD does not
support the mapping. If a mechanic cannot be represented faithfully, the
extractor must report a model gap instead.

## 9. CRD-specific model extensions

Phase 2 has identified several mechanics that the existing models did not
represent sufficiently for automation:

- the full CRD range categories;
- equipment level and price category;
- weapon extreme-range information and mechanical properties;
- Type ability-to-tier relationships;
- Ability additional-Effort cost marker;
- Ability tier-specific effects;
- Skill tier restrictions;
- manifest Cypher power levels.

These are model extensions, not changes to CRD rules. Their values will only be
populated from source material during extraction.
