# CRD Compendium Architecture

This document describes the current representation of the 2026-07-29 Cypher
Reference Document (CRD) in Foundry VTT.

The goal is a searchable, linkable, bilingual, automation-ready library rather
than a PDF copied into one Journal.

## 1. Source and build pipeline

```
CRD
 |
 | extraction / normalization
 v
packs/*/_source/
 |
 | deterministic migration / pack build
 v
Foundry LevelDB packs
```

The `_source/` records are authoritative. Generated LevelDB files are build
artifacts and must not be edited manually.

CRD provenance is recorded under `flags.cypherFoundry.crd`.

## 2. Current content families

| Family | Foundry representation | Current status |
| --- | --- | --- |
| Skills | Item | Complete source-backed inventory |
| Abilities | Item | Complete canonical catalogue |
| Types | Item | Complete source-backed inventory |
| Descriptors | Item | Complete source-backed inventory |
| Foci | Item | Complete source-backed inventory and flowcharts |
| Equipment | Item | Complete source-backed W4 inventory |
| Weapons | Item/attack | Complete source-backed W4 inventory; runtime mechanics still being closed |
| Armor | Item | Complete source-backed W4 inventory |
| Shields | Item | Complete source-backed W4 inventory |
| Subtle Cyphers | Item/cypher | Complete source-backed inventory |
| Manifest Cyphers | Item/cypher | Complete source-backed inventory |
| Power Boost Cyphers | Item/cypher | Complete source-backed inventory |
| Artifact | Item/artifact | Model exists; source-blocked because the supplied CRD has no Artifact inventory |
| Creatures/NPCs | Actor/npc | General system capability; not a CRD extraction family because the supplied CRD has no creature inventory |
| Journals | JournalEntry | Rules packs exist; full CRD Journal conversion remains future work |

The W4 equipment source inventory currently contains 259 English records paired
with 259 French records across equipment, weapons, armor, and shields.

## 3. Pack organization

Current bilingual packs include:

- `abilities-en/fr`;
- `skills-en/fr`;
- `descriptors-en/fr`;
- `types-en/fr`;
- `foci-en/fr`;
- `equipment-en/fr`;
- `rules-en/fr`.

Types and Foci reference standalone Ability Items. They do not duplicate the
full Ability definition.

## 4. Identity and references

Every CRD-derived source record uses a stable logical ID independent of its
Foundry UUID and display name.

English and French records share that logical ID. French records additionally
identify the English source logical ID.

Source-to-source references use logical IDs. Pack compilation resolves them to
Foundry UUIDs only after the complete source set is known.

Builds reject unresolved or ambiguous references.

## 5. Structured mechanics

The source architecture is deliberately stronger than a prose-only conversion.

Mechanically meaningful CRD data should be represented structurally whenever the
current DataModel supports it. Examples include:

- Ability costs, effects, modifiers, and recovery end conditions;
- Ability roll tables;
- weapon damage, range, properties, and target effects;
- armor/shield categories and mechanical behavior;
- cypher levels, depletion, variants, and roll-table data;
- Type and Focus advancement benefits.

Extraction alone is not runtime integration. A structured field is fully
integrated only when the runtime consumes it where the game rule requires it.

## 6. Current runtime closure gaps

The current content layer already preserves more mechanics than the runtime
currently executes.

Known gaps are:

### Weapons

`system.mechanics.targetEffects` is extracted, modeled, and fidelity-tested,
but attack resolution does not yet generically apply those effects.

Other structured weapon properties must be audited to distinguish mechanics that
require runtime behavior from properties that are descriptive.

### Cyphers

Depletion is runtime-functional.

Generic runtime handling for structured:

- `variants`;
- `randomRange`;
- `rollTables`;
- item-specific structured effects

is still being completed.

The implementation should remain generic rather than hardcoding individual
Cyphers such as Teleporter.

### Granted benefits

Type/Focus benefit handling is already implemented for several structured
categories. Remaining work is to verify that every source-backed benefit is both
stored and applied correctly in actual gameplay, including granted armor where
applicable.

## 7. Journals, Quick Reference, and guides

The intended navigation layer remains:

- authoritative rules in Journals;
- reusable character/equipment content as Items;
- a Quick Reference layer for high-frequency rules;
- Player and GM navigation guides linking to authoritative content.

These are future content work, not replacements for the existing structured
Items.

Journals must not become a second source of truth for mechanics already modeled
as reusable Items.

## 8. Genre content

Genre-specific Abilities are already integrated into the canonical Ability
catalogue with stable identity, variants, localization, provenance, and contract
tests.

The broader genre reference/navigation layer remains future work.

## 9. Translation and provenance

English CRD content is the mechanical authority.

French records:

- share the canonical logical ID;
- preserve equivalent mechanics;
- use the supplied Character Book localization when it faithfully matches the
  CRD content;
- otherwise retain the English content for later translation.

Every CRD-derived record remains traceable through its provenance envelope.

## 10. Build contract

Source changes should be followed by:

```powershell
npm run migrate:packs
npm run test:content
npm run build:packs
```

The generated LevelDB packs are never hand-edited.

## 11. Definition of done

A CRD content family is complete when all applicable contracts are satisfied:

- complete source inventory;
- stable logical IDs;
- bilingual pairing where applicable;
- structured mechanics;
- provenance;
- reference integrity;
- model-gap review;
- representative fidelity fixtures;
- business/content contract tests;
- deterministic build;
- CI green;
- documentation updated;
- no duplicate canonical records;
- no dangling references.

A genuine source limitation is documented explicitly rather than worked around by
inventing content.
