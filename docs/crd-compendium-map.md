# CRD to Foundry Mapping

This is the current conversion map for the 2026-07-29 Cypher Reference Document.
It describes what is implemented, what is planned, and what is source-blocked.

## Core character and rules

| CRD subject | Foundry representation | Status |
| --- | --- | --- |
| Core rules | JournalEntry / system rules | Rules foundation available; full CRD Journal conversion remains planned |
| Skills | Item | Complete |
| Abilities | Item | Complete |
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
| Subtle Cyphers | Item/cypher | Complete |
| Manifest Cyphers | Item/cypher | Complete |
| Power Boost Cyphers | Item/cypher | Complete |
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
| Random tables actually present in the CRD | RollTable or JournalEntry | Planned inventory/conversion |
| Creatures/NPCs | Actor/npc | Not a CRD extraction target; supplied CRD contains no creature inventory |
| Rewards/treasure | JournalEntry / Items where source-backed | Planned |

The repository still supports generic NPC/creature Actors. That capability is
separate from CRD content extraction.

## Bilingual contract

English and French records:

- share one language-neutral logical ID;
- retain equivalent mechanical data;
- preserve CRD provenance;
- use the Character Book translation only when it faithfully matches the CRD;
- otherwise retain the English source text.

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
- actual CRD random-table inventory;
- final cross-language/reference/provenance audits.

The old creature-extraction plan is intentionally not retained: there is no
source inventory to extract from the supplied CRD.
