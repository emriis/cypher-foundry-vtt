# CRD Ability Coverage Audit

## Scope

This audit compares the current standalone Ability compendiums with the extraction
requirements defined by the 2026-07-29 Cypher Reference Document (CRD). It is an
inventory and structural audit, not an extraction pass.

The CRD remains the only authoritative content source. No ability is added from
memory or from an external source as part of this audit.

## Current inventory

| Pack | Current source records | Status |
| --- | ---: | --- |
| `abilities-en` | 38 | Partial |
| `abilities-fr` | 28 | Partial |

The current records originated from the earlier Type/Focus ability migration.
They therefore represent only the abilities already present in those authored
Type/Focus sources at migration time. They are not a complete CRD Ability
catalogue.

## CRD coverage boundary

The CRD defines reusable abilities in several content contexts:

1. Type abilities.
2. Focus abilities.
3. Genre ability lists used by Types and genre character creation.
4. Other explicitly reusable ability choices described by the CRD.

The standalone Ability pack must represent each mechanically distinct reusable
ability once per language, while allowing duplicate names when the mechanics
differ. Type and Focus records should reference these reusable records rather
than embedding their mechanics.

## Findings

### 1. The current catalogue is incomplete

The 38 English and 28 French records are insufficient to claim complete CRD
coverage. The next extraction pass must build a CRD-derived inventory before
adding or removing records.

The inventory must distinguish:

- missing abilities;
- existing abilities whose mechanics match the CRD;
- existing abilities whose mechanics require correction;
- mechanically distinct abilities sharing a display name;
- English records without a French counterpart;
- French records whose localization is not yet established.

### 2. Provenance is missing from current Ability source records

The source schema requires:

- `flags.cypherFoundry.crd.version`
- `flags.cypherFoundry.crd.logicalId`
- `flags.cypherFoundry.crd.language`
- `flags.cypherFoundry.crd.sourceKind`
- `flags.cypherFoundry.crd.section`
- `flags.cypherFoundry.crd.sourceLocator`
- `flags.cypherFoundry.crd.transformations`

French records additionally require `sourceLogicalId`.

The current standalone Ability records do not yet carry this provenance envelope.
This must be corrected as part of CRD Ability extraction rather than guessed
from existing Foundry UUIDs.

### 3. Mechanical identity must not depend on display names

The existing migration correctly separates a normalized ability key from its
mechanical signature. This principle must be retained.

Two abilities with the same name but different mechanics must remain distinct.
Conversely, localized names must never create a second logical identity.

### 4. Ability references need a source-level identity

The long-term source representation should use logical IDs during extraction
and resolve them to Foundry UUIDs during pack compilation. Direct UUIDs in
authored Type/Focus source are an implementation detail and should not become
the canonical CRD extraction key.

### 5. Action handling requires CRD verification

The current model supports:

- `action`
- `firstAction`
- `lastAction`
- `null` for cases not represented by the current activation model.

The extraction pass must verify the CRD wording before assigning an activation
value. It must not infer an action from unrelated prose or invent a new action
category.

### 6. Structured fields must be source-backed

Costs, Effort options, effects, roll tables, prerequisites/flowchart edges,
equipment grants, weapon/armor permissions, durations, ranges, damage, and
other mechanics must only be structured where the CRD provides an unambiguous
mapping.

When the current model cannot faithfully represent a CRD mechanic, the content
should remain in source text and the model gap should be documented rather than
silently normalized.

## Required next extraction work

1. Build a CRD Ability inventory from the supplied 2026-07-29 CRD.
2. Assign one stable language-neutral logical ID to every reusable ability.
3. Match the existing 38 English records against that inventory.
4. Identify all missing English records.
5. Verify existing mechanics against the CRD before modifying them.
6. Pair French records with English logical IDs.
7. Add missing French records using faithful CRD localization where the source
   provides it; otherwise preserve the English source text and record the
   English logical ID for later localization.
8. Add complete provenance to every extracted Ability source record.
9. Rebuild Type/Focus references from logical IDs and validate that no reference
   is dangling or ambiguous.
10. Add business-level coverage tests that validate extraction contracts rather
    than hard-coding the contents of individual JSON files.

## Explicit non-goals

This audit does not:

- invent abilities absent from the supplied CRD;
- translate missing French text from external sources;
- change Ability runtime behavior;
- redesign the Ability data model without a CRD-backed requirement;
- rebuild compiled LevelDB packs by hand.

## Acceptance criteria for the completion PR

The Ability extraction is complete only when:

- every CRD reusable Ability in scope has a source record;
- every English source record has CRD provenance;
- every French source record has a stable English logical ID;
- mechanically distinct same-name abilities remain distinct;
- no Type/Focus Ability reference is dangling;
- no duplicate logical ID exists within a language;
- source-level references resolve uniquely;
- structured mechanics are supported by the CRD;
- CI and pack compilation remain green.
