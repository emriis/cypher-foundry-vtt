# CRD to Foundry Mapping

This is the working conversion map for the 2026 Cypher Reference Document. It is organized around Foundry usage rather than page ranges so it remains useful across CRD revisions.

## Core character and rules

| CRD subject | Foundry | Pack |
| --- | --- | --- |
| Creating Your Character | JournalEntry | rules |
| Core Character | JournalEntry | rules |
| Tier | JournalEntry | rules |
| Might, Speed, Intellect | JournalEntry | rules |
| Pools and Edge | JournalEntry | rules |
| Wounds | JournalEntry | rules |
| Skills and Inabilities | Item + JournalEntry | skills + rules |
| Effort | JournalEntry | rules |
| Assets | JournalEntry | rules |
| Cyphers overview | JournalEntry | rules |
| Recoveries | JournalEntry | rules |
| Healing Wounds | JournalEntry | rules |
| Weapons and Armor rules | JournalEntry | rules |
| Equipment and pricing | JournalEntry + Items | rules + equipment |

## Character options

| CRD subject | Foundry | Pack |
| --- | --- | --- |
| Types | Item | types |
| Descriptors | Item | descriptors |
| Species-style descriptors | Item | descriptors |
| Foci | Item | foci |
| Abilities | Item | abilities |
| Ability prerequisites | Focus flowchart edges | foci |
| Genre skills | Item | skills |
| Languages as skills | Item | skills |

## Equipment and expendable content

| CRD subject | Foundry | Pack |
| --- | --- | --- |
| Weapons | Item: attack | equipment |
| Armor | Item: armor | equipment |
| Shields | Item: shield | equipment |
| General equipment | Item: equipment | equipment |
| Price categories | JournalEntry + equipment metadata | rules + equipment |
| Cyphers | Item: cypher | equipment |
| Artifacts | Item: artifact | equipment |
| Oddities | Item: oddity | equipment |

## Genre material

The CRD genre sections become Journal Entries with links to reusable content.

Expected genre families include:
- The Real World
- Fantasy
- Science Fiction
- Superhero
- Horror
- Modern / contemporary variants
- Other genre-specific sections present in the supplied CRD revision

The final list is derived from the supplied CRD rather than hard-coded from an older edition.

## GM material

| CRD subject | Foundry | Pack |
| --- | --- | --- |
| GM rules | JournalEntry | gm-tools |
| GM Intrusions | JournalEntry | gm-tools |
| Encounter guidance | JournalEntry | gm-tools |
| Creature rules | JournalEntry | gm-tools |
| Creatures / NPCs | Actor | creatures |
| Creature abilities | Item: ability | abilities or creatures |
| Random tables | RollTable where applicable | gm-tools |
| Rewards / treasure guidance | JournalEntry | gm-tools |
| Quick references | JournalEntry | gm-tools |

## Bilingual contract

For every translated content family:
- English and French source records expose the same logical key.
- Cross-document relationships resolve to the correct language pack.
- Mechanical identifiers are identical in both languages.
- Translation must not change numeric values, prerequisites, costs, or rules.

Tests should compare logical structure rather than translated display text.

## Foundry-first principle

A CRD passage becomes an Item or Actor when the Foundry document itself is useful during play. Otherwise it remains a Journal Entry.

For example:
- "A medium weapon deals 4 damage" belongs in rules/quick-reference Journal content.
- "Broadsword" belongs in the equipment Item pack.
- A character Type belongs in the Type Item pack.
- A creature with Armor, health, attacks, and abilities belongs in the Actor pack.

This prevents the reference library from becoming a collection of static pages while avoiding the opposite mistake of modelling every sentence as an Item.
