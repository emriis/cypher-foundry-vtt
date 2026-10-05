# CRD Ability Inventory

Source: `Cypher-Reference-Document-2026-07-29.docx` (2026-07-29).

This is the first extraction inventory for the canonical Ability catalogue.
Names are transcribed from the supplied CRD; no rules are inferred here.

## Canonical scope

The inventory includes:

- Type abilities, including genre-specific Type abilities.
- Focus abilities.
- Fantasy Genre mid- and high-tier abilities.
- Science Fiction Genre mid- and high-tier abilities.
- Origin Superhero abilities.
- Reusable abilities selected by multiple sources, canonicalized once.
- Same-name abilities with different mechanics, kept as distinct records.

It excludes ordinary source-specific benefits such as Pool/Edge bonuses,
wound capacity, skill training, weapon permissions, and passive modifiers unless
the CRD explicitly presents the benefit as a standalone Ability.

## Genre inventory

### Fantasy

The CRD contains 26 named Fantasy Genre abilities:

- Cypher Use
- Danger Instinct
- Disappear Into Shadow
- Discerning Mind
- Elemental Protection
- Enhanced Stat
- Exceptional Follower
- From the Shadows
- Fury
- Pry Open Defense
- Puncturing Attack
- Snipe
- Strategize
- Tough
- Winning Smile
- Assassin Strike
- Concussive Force
- Inspire Action
- Invisibility
- Jump Attack
- Magic Portal
- Mask
- Spellbreaker
- Spin Attack
- Will of a Leader

### Science Fiction

The CRD contains 19 named Science Fiction Genre abilities:

- Black Thumb
- Cypher Use
- Disable Mechanism
- Enhanced Stat
- Exceptional Follower
- Hands on the Wheel
- Incredible Health
- Machine Companion
- Mind Reading
- Snipe
- Spray
- Arc Spray
- Improved Machine Companion
- Inspire Action
- Knowledge Expert
- Lethal Capability
- Severe Machine Disruption
- Technology Expert
- Telepathic Network

### Origin Superhero

The CRD contains 26 named Origin Superhero abilities:

- Adhesive Mobility
- Amazing Invulnerability
- Amazing Tools
- Armored Body
- Astonishing Teleport
- Awesome Force Field
- Duplicate
- Extraordinary Leap
- Fantastic Armament
- Fantastic Vehicle
- Incredible Instinct
- Incredible Velocity
- Intangible
- Invisible Knack
- Power Cypher Use
- Powerful Blast
- Regenerative Healing
- Shrink
- Skill Exemplar
- Stretchy
- Superhero Versatility
- Team-Up Ally
- Telepathic Prodigy
- Unbelievable Transformation
- Uncanny Flight
- Unyielding Shield

## Type inventory

The CRD has Type-specific Ability sections for the following 49 Type
contexts in the supplied document:

- Barbarian
- Bard
- Cleric
- Druid
- Fighter
- Mage
- Monk
- Necromancer
- Paladin
- Ranger
- Rogue
- Archer
- Axe Fighter
- Knife Fighter
- Priest
- Sorcerer
- Sword Fighter
- Thief
- Two-Weapon Fighter
- Witch
- Burglar
- Noble Warrior
- Swashbuckler
- Warrior
- Wizard
- Diplomat
- Engineer
- Medic
- Operative
- Pilot
- Soldier
- Android
- Noble
- Psion
- Scoundrel
- Starpilot
- Tech
- Trader
- Dealer
- Heavy
- Survivor
- Tender
- Crimefighter
- Vigilante
- Enhanced Hero
- Powerstar
- Superhuman
- Powerhouse
- Living God

The Type pass must distinguish actual named abilities from the surrounding
benefit package. For example, Crimefighter's Pool bonuses, wound capacity,
weapon/armor permissions, and power shifts are source benefits, while
Always Tinkering and Sleuthing are canonical Ability candidates. The CRD uses
the same structure across superhero Types.

## Focus inventory

The CRD lists 41 unique Foci:

- Abides in Stone
- Blazes With Fire
- Builds Allies
- Carries a Gun
- Casts Spells
- Changes Shape
- Commands Mental Powers
- Consorts With the Dead
- Controls Beasts
- Crafts Illusions
- Doesn’t Do Much
- Employs Magnetism
- Entertains
- Explores
- Fights Dirty
- Fights Unarmed
- Fights With Panache
- Fuses Flesh and Steel
- Fuses Mind and Machine
- Grows to Towering Heights
- Howls at the Moon
- Hunts
- Infiltrates
- Leads
- Masters Telekinesis
- Masters Weaponry
- Moves Like the Wind
- Never Says Die
- Performs Feats of Strength
- Quells Evil
- Reveres a Supernatural Force
- Rides the Lightning
- Sneaks Through the Shadows
- Solves Mysteries
- Speaks for the Land
- Stands Like a Bastion
- Strikes With Mystic Might
- Talks to Machines
- Tends to the Wounded
- Walks Through Walls
- Wears a Sheen of Ice
- Works for a Living

The focus chapter states that a character chooses two tier-1 special abilities
from the chosen focus and then follows its flowchart at later tiers. Focus
ability occurrences therefore become references to canonical Ability records;
the flowchart remains a separate Focus structure.

## Initial overlap findings

Several names are explicitly reused across source families. Examples include:

- Cypher Use
- Combat Prowess
- Expert Combatant
- Fast Talk
- Inspiring Suggestion
- Mind Reading
- Prepare Spell
- Quarry
- Sneak Attack
- Snipe
- Successive Attack

These are not automatically separate records. Their mechanics must be compared.
If mechanics differ, the records receive different logical IDs even when their
display names match.

## Extraction rules

1. Match mechanics before creating a new Ability.
2. Assign one stable language-neutral logical ID per canonical mechanical
   identity.
3. Keep same-name/different-mechanics records distinct.
4. Type, Focus, Genre, and Origin Superhero sources reference logical IDs.
5. Preserve source-specific passive benefits on their source record.
6. Structure only mechanics directly supported by the CRD.
7. Preserve source text and document a model gap when faithful structuring is
   not possible.
8. Add CRD provenance to every extracted English record.
9. Pair French records using the English logical ID; do not invent missing
   French translations.

## Next extraction pass

The remaining work is mechanical reconciliation rather than discovery:

1. Enumerate every named Focus Ability occurrence.
2. Enumerate every named Type Ability occurrence, including genre-specific
   Type abilities.
3. Compare all occurrences against the existing 53 English Ability records.
4. Assign logical IDs and provenance.
5. Add missing canonical English records.
6. Pair the French records.
7. Replace Type/Focus source-level UUID duplication with logical-ID references.
8. Add coverage tests for the inventory contracts.
