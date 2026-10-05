# CRD Ability Coverage Audit

## Scope

The standalone Ability compendiums are the canonical catalogue of reusable
character capabilities extracted from the 2026-07-29 Cypher Reference Document
(CRD).

This audit separates reusable Abilities from source-specific character benefits.
It is intentionally an inventory and architecture audit, not an extraction pass.

## Ability taxonomy

The Ability catalogue includes mechanically complete, reusable capabilities
that the CRD presents as abilities, including:

1. Type Abilities.
2. Focus Abilities.
3. Genre Abilities.
4. Genre-specific Type Abilities.
5. Other explicitly reusable character abilities presented by the CRD.

An Ability is identified by its mechanical identity, not by its display name.
Two abilities with the same name but different mechanics remain distinct.
One ability referenced by several sources remains one canonical Ability.

Type, Focus, and Genre records should reference canonical Ability logical IDs
rather than duplicate their mechanics.

## Benefits that are not automatically Abilities

Species and Descriptor packages contain character benefits that should remain
structured on their source record unless the CRD presents the benefit as a
standalone reusable Ability.

Examples of source-specific benefits include:

- Pool bonuses.
- Edge bonuses.
- Skill training.
- Skill specialization.
- Wound capacity changes.
- Conditional damage modifiers.
- Resistances.
- Other passive modifiers.

A special benefit becomes an Ability only when its CRD mechanics constitute a
standalone character capability that is meaningfully represented as an Ability:
for example an activatable effect with its own cost, action, target, range,
duration, Effort, or comparable mechanics.

This prevents the Ability catalogue from becoming a generic container for every
character modifier.

## Current inventory

| Pack | Current source records | Status |
| --- | ---: | --- |
| `abilities-en` | 38 | Partial |
| `abilities-fr` | 28 | Partial |

These records originated from earlier Type/Focus migrations and therefore do
not constitute complete CRD coverage.

## Required CRD inventory

The extraction pass must first enumerate, from the supplied CRD:

- every Type Ability;
- every Focus Ability;
- every Genre Ability;
- every genre-specific Type Ability;
- every other explicitly reusable Ability;
- the source lists from which each Ability is selectable or granted.

The inventory must then classify each source occurrence as:

- canonical Ability;
- reference to an existing canonical Ability;
- duplicate name with distinct mechanics;
- source-specific benefit that must remain on its Type/Focus/Species/etc.;
- unresolved model gap requiring documentation rather than invention.

## Identity and references

Each canonical Ability receives one stable, language-neutral logical ID.

Type, Focus, and Genre source records should reference that logical ID.
Foundry UUIDs are resolved during pack compilation and are not the canonical
source identity.

An Ability referenced by multiple sources must not be duplicated merely because
its source context differs.

A duplicate display name is allowed when the mechanical identity differs.

## Provenance

Every extracted English Ability must carry the CRD provenance envelope:

- `flags.cypherFoundry.crd.version`
- `flags.cypherFoundry.crd.logicalId`
- `flags.cypherFoundry.crd.language`
- `flags.cypherFoundry.crd.sourceKind`
- `flags.cypherFoundry.crd.section`
- `flags.cypherFoundry.crd.sourceLocator`
- `flags.cypherFoundry.crd.transformations`

French records must retain the same logical identity and include the English
`sourceLogicalId` convention already used by the Skills source packs.

## Structured mechanics

Only CRD-backed mechanics may be structured. Candidate fields include:

- Pool cost and cost options;
- Effort options;
- effects and effect options;
- action timing;
- target and range;
- duration/end conditions;
- damage;
- prerequisites and tier gates;
- equipment grants;
- weapon/armor permissions;
- skill or task interactions;
- ongoing effects;
- other mechanics explicitly supported by the CRD.

If the current data model cannot faithfully represent a CRD mechanic, preserve
the source text and document the model gap. Do not invent or silently simplify
rules.

## Extraction sequence

1. Build the complete CRD Ability inventory.
2. Classify every source occurrence using the taxonomy above.
3. Assign stable logical IDs to canonical abilities.
4. Match the existing 38 English records to the inventory.
5. Verify each matched mechanic against the CRD.
6. Add missing English canonical records.
7. Pair French records using the same logical IDs.
8. Preserve English source text in French records when no faithful CRD
   localization is available; do not invent translations.
9. Rebuild Type/Focus/Genre references from logical IDs.
10. Validate that every reference resolves uniquely.
11. Add business-level coverage tests that validate contracts instead of
    hard-coding individual JSON inventories.

## Acceptance criteria

The Ability extraction is complete when:

- all CRD reusable Abilities in scope have canonical source records;
- Type, Focus, and Genre source occurrences resolve to canonical Abilities;
- source-specific passive benefits are not incorrectly promoted to Abilities;
- same-name/different-mechanics Abilities remain distinct;
- every English Ability has CRD provenance;
- every French Ability retains stable English logical identity;
- no logical ID is duplicated within a language;
- no source-level Ability reference is dangling or ambiguous;
- structured mechanics are supported by the CRD;
- CI and pack compilation remain green.

## Non-goals

This audit does not:

- invent abilities absent from the CRD;
- translate missing French text from external sources;
- change Ability runtime behavior;
- redesign the Ability model without a CRD-backed requirement;
- compile or hand-edit Foundry LevelDB packs.
