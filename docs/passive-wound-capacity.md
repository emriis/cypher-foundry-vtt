# Passive Ability wound capacity

The supplied 2026-07-29 CRD is authoritative. This inventory covers additional
wound capacity in reusable Abilities, including passive clauses in mixed-action
superhero powers. Source `enabler` labels are not used to infer mechanics.

| Ability key | Capacity grant | CRD section |
| --- | --- | --- |
| `tough` | +1 minor | Fantasy / Mid-Tier Fantasy Abilities; Foci / Explores |
| `stone-body` | +2 minor | Foci / Abides in Stone, tier 1 |
| `improved-stone-body` | +1 moderate | Foci / Abides in Stone, tier 3 |
| `mineralization` | +1 major | Foci / Abides in Stone, tier 6 |
| `resilience` | +1 moderate | Fantasy / High-Tier Fantasy Abilities; Foci / Fights Unarmed; Tends to the Wounded |
| `hard-won-resilience` | +1 moderate | Foci / Sneaks Through the Shadows; Stands Like A Bastion; Works for a Living |
| `push-on-through` | +1 moderate | Superheroes / Superhuman, Powerhouse, Living God; Foci / Never Says Die |
| `armored-body` | +1 moderate and +1 major, rank 2+ | Superheroes / Origin Superhero Abilities |
| `stretchy` | +1 moderate | Superheroes / Origin Superhero Abilities |
| `shield-master` | +1 moderate on the used shield | Foci / Stands Like A Bastion, tier 2 |

The same typed grant is authored for all corresponding EN/FR Ability records
and genre manifest occurrences. Normalization preserves it without changing
existing source text or logical identity. This table certifies capacity clauses,
not other effects in these definitions. In particular Armored Body's minor-wound
immunity, Stone Body's combat modifiers, and Stretchy's reach/grab effects are
separate contracts. Type packages, species benefits, ignoring a wound, healing,
and incoming extra damage are not additional Ability capacity in this inventory.

## Species capacity grants

Drakain, Orc and Prota each grant one additional minor wound. Their paired
`descriptors-en/fr` source benefits explicitly declare `passiveModifiers` with
`woundCapacity`, `minor`, and amount 1. The CRD locators are Fantasy Species /
Orc and Science Fiction Species / Drakain / Prota (2026-07-29).

Applying one of these species copies its typed modifiers into the generated
owned benefit Ability and records its species origin. The species-only track
therefore gains one minor slot automatically; with Tough it gains two in total.
Two copies of Tough still provide only one Ability-group bonus. Other species
characteristics remain descriptive unless they have their own structured rules.
The copy is independent of the compendium source, and reapplying an already
selected species is rejected before any further grants or Skill upgrades.

`Descriptor.system.benefits[].passiveModifiers` uses the existing modifier
schema and defaults to an empty array. Existing descriptive records therefore
hydrate without a migration or guessed mechanics. This authoring/runtime change
does not retrofit existing PCs; migration of earlier species grants remains a
separate operation. Saved wound maxima and received wounds are preserved.

## Runtime and saved data

`system.passiveModifiers` stores the definition. `woundCapacity` affects the PC;
`shieldWoundCapacity` affects its shield independently. `minimumRank` defaults to
zero; Armored Body's grants explicitly require rank 2. All consumers read current
rank rather than copying eligibility into activation state.

PC and shield `effectiveWounds` are read-only derived tracks. Saved `wounds.max`
values remain base capacities; damage and Healing Hand use effective capacity.
Preparation and Item removal never delete existing wounds, including a count
above the resulting capacity. Shield Master does not add capacity to the PC,
and an unowned shield receives no bonus. Owned shield capacity is the capacity
available when that character uses it; each shield retains its own wound counts.

The additional modifier kind and optional rank field require no destructive
world transformation. Existing modifiers without `minimumRank` retain their
behavior. Previously imported Ability Items still require an explicit source
refresh to receive the newly authored grants; no startup code reads prose or
rewrites owned Items.

## Capacity stacking

CRD / Genre Character Abilities from Types and Foci / Name and Cost contains
a callout excluding duplicate Abilities and differently named Abilities with
the same effect. The user's 2026-10-18 adjudication applies this separately to
each severity and recipient: one extra minor wound and one extra moderate wound
both apply, while two extra-minor grants do not stack. PC and shield capacity
are separate recipients. Within one severity/recipient group, the strongest
positive grant applies; existing negative modifiers retain their prior additive
behavior. Pool and Edge modifiers are unaffected by this capacity-specific rule.

The 2026-10-18 clarification limits that non-stacking group to ordinary
genre/Type/Focus Ability grants. Benefits from species or Descriptors add outside
the group, even when represented as Ability Items. Content application records
`flags.cypher.grantOrigin` with a language-independent `kind` and the granting
document's `sourceId`. Type/Focus grants also record their origins. Modifier
aggregation preserves this scope for both passive and active effects; names and
prose never determine it. Existing saved base capacities remain additive too.
Generated species/Descriptor benefits also receive a nonblank technical Ability
key derived from the source ID and authored benefit slot, so real Foundry
validation accepts their creation without using a localized label as identity.

Standalone/legacy Ability Items without this flag retain their existing Ability
scope. Previously generated descriptive benefits are not reclassified by guessing
their source names, and this change does not automatically structure their
descriptive mechanics. No existing world Items or flags are rewritten at startup.

## Validation observed on 2026-10-18

- Isolated normalized `npm test`: 734 passed, zero failures or skips.
- Current-source runtime lane: 484 passed. Focused schema and derived threshold
  checks also passed independently.
- Lint, the type-check pilot, architecture audit and system/E2E syntax passed.
- Isolated build: all 15 compiled-pack checks and ZIP/manifest verification passed.
- Foundry 14.369.0 / Chromium 153.0.8010.12: four focused live scenarios passed.
  They imported all ten grant families from EN and FR packs, checked rank and
  shield scope, combined minor/moderate grants with duplicate effects, and
  retained Tough's capacity/wound data across reload and Item removal.
  The origin scenario also created species/Descriptor benefits through content
  application, explicitly configured fixture modifiers, and verified their
  additive capacity and preserved origin flags after reload. An initial live
  failure exposed the missing required Ability key on generated benefits;
  generation now supplies it and a focused regression protects that contract.

The complete live gameplay suite and V13 were not rerun for this slice. Generated
packs, packages and the disposable Foundry world stayed outside the authoring
checkout; previously imported world Items were not rewritten.

## Species grant validation observed on 2026-10-19

- Isolated normalized `npm test`: 744 passed, zero failures or skips.
- Current-source runtime lane: 490 passed, zero failures or skips.
- Lint, the type-check pilot, architecture audit and E2E syntax passed.
- Isolated build: all 15 compiled-pack checks and ZIP/manifest verification passed.
- Foundry 14.369.0 / Chromium 153.0.8010.12: five focused live scenarios passed.
  The new scenario applied all six actual Drakain, Orc, and Prota EN/FR sources
  without manually configuring modifiers. It checked capacity four, capacity
  five with duplicate Tough Items, repeated-application rejection, wound overflow,
  persistence after reload, and the rendered capacity limit.

The complete live gameplay suite and V13 were not rerun. Generated artifacts
and the disposable world remained isolated; existing PCs were not migrated.
