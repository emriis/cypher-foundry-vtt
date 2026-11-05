# CRD to Foundry Mapping

This is the current conversion map for the 2026-07-29 Cypher Reference Document.
It describes what is implemented, what is planned, and what is source-blocked.
Inventory completion below does not certify every source clause or its runtime
effect. Use the [current coverage review](crd-coverage-review.md) for that distinction.

## Core character and rules

| CRD subject | Foundry representation | Status |
| --- | --- | --- |
| Core rules | JournalEntry / system rules | Rules foundation available; full CRD Journal conversion remains planned |
| Skills | Item | Complete |
| Abilities | Item | 701 normalized definitions; specialized effect automation remains partial |
| Types | Item | Complete |
| Descriptors | Item | Complete |
| Foci | Item | Complete |
| Character advancement | Application services + structured content | Runtime implemented |
| Recoveries and wounds | Application/rules services | Runtime implemented |

## Equipment and expendable content

| CRD subject | Foundry representation | Status |
| --- | --- | --- |
| Equipment | Item | Complete W4 inventory |
| Weapons | Item/attack | Complete W4 inventory; runtime special mechanics audit ongoing |
| Armor | Item/armor | Complete W4 inventory |
| Shields | Item/shield | Complete W4 inventory |
| Subtle Cyphers | Item/cypher | 86 definitions; common lifecycle, particular effects remain descriptive |
| Manifest Cyphers | Item/cypher | 103 definitions; generation/variants/tables, particular effects remain descriptive |
| Power Boost Cyphers | Item/cypher | 9 definitions; common lifecycle, particular effects remain descriptive |
| Artifacts | Item/artifact | Source-blocked: no Artifact inventory in supplied CRD |

The W4 source inventory contains 259 English records and 259 French paired
records across equipment, weapons, armor, and shields.

## Genre material

| CRD subject | Foundry representation | Status |
| --- | --- | --- |
| Genre-specific Abilities | Ability Items | Complete canonical integration |
| Genre overview/rules | JournalEntry | Planned |
| Genre navigation | JournalEntry | Planned |

## GM material

| CRD subject | Foundry representation | Status |
| --- | --- | --- |
| GM procedures | JournalEntry | Planned |
| Tables actually present in the CRD | RollTable or JournalEntry as appropriate | 61 Word tables inventoried; cypher generation/inline tables have consumers; remaining destinations/classification open |
| Creatures/NPCs | Actor/npc | Not a CRD extraction target; supplied CRD contains no creature inventory |
| Rewards/treasure | JournalEntry / Items where source-backed | Planned |

The repository still supports generic NPC/creature Actors. That capability is
separate from CRD content extraction.

## Bilingual contract

English and French records:

- share one language-neutral logical ID;
- retain equivalent mechanical data;
- preserve CRD provenance;
- author canonical English content under `packs/*-en/_source/`;
- render French through source-hashed proposals in `translations/fr/`, compiled
  without changing canonical English mechanics;
- use wording aids only when faithful to the supplied CRD; they establish no rules.

The current normalized audit finds 1,373 reviewed French proposals and 2,981
translated fields. Editorial status and automated safeguards are not a new
sentence-by-sentence semantic certification; see [localization coverage](localization-content-audit.md).

Localized display names are never used as canonical identity keys.

## Foundry-first principle

Use the smallest meaningful Foundry representation:

- reusable character options and equipment become Items;
- actual random tables become RollTables;
- rules and navigation become Journals;
- creatures remain Actors when a source actually provides them;
- runtime state remains on Actors, not in static CRD source records.

## Player and GM guides

The intended guides are navigation layers. They should link to authoritative
Items and Journals rather than duplicate their mechanics.

## Additional planned libraries

The following remain valid future work:

- full CRD Journal library;
- Quick Reference;
- Player Guide;
- GM Guide;
- genre reference/navigation;
- GM procedures and rewards;
- per-table destination/classification beyond the completed 61-table inventory;
- final cross-language/reference/provenance audits.

The old creature-extraction plan is intentionally not retained: there is no
source inventory to extract from the supplied CRD.
