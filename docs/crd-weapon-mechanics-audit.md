# CRD weapon mechanics audit — reconciled 2026-11-05

This audit uses only `docs/Cypher-Reference-Document-2026-07-29.docx` and the
implementation at `22e2f2a`. It distinguishes completed weapon consumers,
remaining general combat procedures and source-specific Ability effects.
See the [field matrix](crd-weapon-runtime-matrix.md) and
[current coverage review](crd-coverage-review.md) for detailed boundaries.

The earlier version of this document mixed current behavior with an obsolete
backlog and several claims without reviewed CRD locators. Those claims are
corrected below; they must not be used as alternative rule authority.

## Source and implementation map

| CRD mechanic | Source locator | Current implementation and boundary |
| --- | --- | --- |
| Light/medium/heavy base damage, familiarity and ranges | 5264–5277 | `item-service.mjs`, `rules/weapon-mechanics.mjs` and `rules/weapon-skills.mjs` consume structured category, free-use and selected Skill data. Explicit zero damage remains zero. Names and price never determine a mechanic. |
| First/Last category timing | 5267–5269, 7652–7663 | Managed round flow enforces timing from the active category. Light may use First or ordinary timing; heavy uses Last, including its declared immediate-movement exception. A two-handed medium weapon does not thereby become a Last attack. |
| Familiarity versus trained/specialized/expert attacks | Skills and source-specific grants; 5265 | The pure weapon-Skill resolver combines supported familiarity and actual Skill levels once, instead of a second proficiency scale. This does not execute every Ability that could grant temporary or conditional training. |
| Hand requirements and exceptional one-handed use | Category rule 5269 and source equipment rows | Explicit held/stowed state, available hands, structured two-hand requirements and one-hand hindrance are enforced. Descriptive exceptions require their own source contract. |
| Extreme range | 5274–5277 | The GM declares the range-limit case; it adds one hindrance and saves the adjudication. No token/grid distance is inferred. |
| Rapid-fire prerequisites | Spray and Arc Spray definitions | `weapon-ability-service.mjs` checks eligibility and runs supported source-specific sequences. A rapid-fire flag does not grant a generic extra attack. Spray consumes its explicitly tracked available-use store. |
| NPC damage and physical Armor bypass | 7734–7740 and source weapon notes | Supported attacks persist Health damage and explicit physical Armor penetration. NPC-to-PC wound/Pool damage uses the separate defense contract. Do not invent an unsupported numeric-to-wound conversion. |
| Material cutting | Source Monomolecular blade notes and 7741–7749 | `object-service.mjs` uses the actual owned weapon threshold, explicit material/tool intent, an attack roll, level damage and subsequent destruction. This is implemented, not a pending model foundation. |
| Target effects, including Stunstick | Science Fiction equipment table, Stunstick row starting at 5768 | Supported level-gated hindrance/lost-action effects are applied and consumed in NPC attacks, with duration and reroll history. General opposing-task/NPC-defense projection still needs closure. |
| Tripod and multiple operators | Source weapon notes | Explicit deployment and distinct eligible Actor participants are checked before costs, including synthetic Actors. Neither a universal setup time nor a helper action cost is inferred. |
| Alternate configuration | Equipment paragraph 5806 | Selection and active category behavior work; consuming the announced switch action in managed round flow remains open. |

The application contracts and tests are linked from
[equipment constraints](equipment-constraints.md),
[weapon Ability execution](weapon-ability-execution.md),
[object damage](object-damage.md), [attack rerolls](attack-rerolls.md) and
[round flow](round-flow.md). Their scoped live results remain dated evidence.

## Explosives and general area attacks

Paragraphs **5278–5281** give the explosive-weapon procedure; **7944–7949** give
the general area procedure. Source targets/area, separate or GM-simplified attack
rolls, PC defenses, delivery range, miss/minimum damage and shared Effort need a
coordinated area contract. The existing `areaAttack` calculation already gives
only **two** damage per allocated damage-Effort level. That formula alone does
not implement multi-target resolution or the hindered area Dodge.

The explosive rule describes usually one point of damage on a miss, with its
qualifiers; other area effects have their own minima or explicit exceptions.
Do not hardcode that every missed area attack deals one point, or that every
successful defense completely cancels every source's minimum damage. Preserve
the distinction between shared allocation and source-defined extra actions.
Specialized Arc Spray/Bouncing Shield sequences do not close the general area
workflow. See review entry C3.

## Ammunition and limited-use equipment

The CRD prices ammunition at **5271**, includes concrete equipment quantities
such as energy packs, permits ignoring ammunition counts in favor of GM
intrusions at **5438**, and gives depletion advice at **5594**. It does not
establish the previously asserted three-way universal campaign procedure of
exact tracking, abstract upkeep or no tracking.

Keep actual quantity/use stores, ordinary depletion and source-specific Ability
consumption distinct. Do not invent magazine capacities, decrement all ranged
weapons automatically or reinterpret generic depletion as ammunition. Further
consumption procedures require the actual source and an explicit campaign
choice. Optional GM-intrusion handling is already compatible with the intrusion
workflow; its reference advice still needs a Journal destination.

## Circumstances, environment and source-specific attacks

The source tables at **7825–7902** cover conditions and declared circumstances
such as cover, light, mist, water, moving mounts/vehicles, gravity, aimed attacks
and movement. Existing generic extra-step controls can represent declared
modifiers; only some cases have dedicated automatic consumers.

For gravity, **7861–7862** specify physical-task hindrance and a one-category
change for thrown/projectile ranges. They do not establish the earlier claim
that weight-based heavy weapons lose two damage, or the claimed generic
low/high-gravity training exemptions. Those additions are excluded from this
CRD backlog. Apply only a separately sourced Ability exception when one exists.
Keep the field/condition/state model and source declaration explicit; do not
hide new unconditional environment penalties in ordinary weapon resolution.

Actual weapon-related Abilities include Spray, Arc Spray, Combat Prowess and
Expert Combatant. Their canonical definitions and variants need individual
contracts. Eligibility, action sharing, Edge, damage Effort, target effects,
partial writes and rerolls belong in those services, not in a weapon-name parser.

## Source limits: spacecraft and Artifact weapons

The supplied CRD contains **Gunnery** at 188, **Piloting spacecraft** at 218 and
individual Pilot/Starpilot powers, including **Redline Maneuver** at 2439–2442.
These do not establish the detailed standalone spacecraft-combat model previously
claimed here (weapon stations, target lock, subsystem attacks and coordinated
fire). No reviewed CRD locator supports that combined system, so it is excluded
from the CRD implementation queue. Review the actual Skills and Abilities in
their existing families instead.

The general Artifact discussion at **5293–5298** describes reusable effects and
depletion. There is no dedicated Artifact-weapon inventory/section to extract
from this CRD. The range-based depletion model and consumer already exist;
actual Artifact powers need source material. Do not fabricate a catalogue or
uncategorized level-based weapon damage as a pending CRD rule.

## Current closure order

1. General area/explosive resolution and source-specific minima (C3).
2. Actual configuration-switch action spending (C4).
3. Broader NPC modifier projection and declared circumstances (C5), coordinated
   with movement penalties (C1).
4. Additional source-specific weapon/Ability effects, secondary defenses and
   defeat outcomes, with explicit source/target/timing contracts.
5. Reference navigation for equipment rules, ammunition advice and circumstance
   tables; complete the extracted/modelled/executed/verified matrix.

Preserve completed category timing, Skill resolution, hand/setup requirements,
physical Armor bypass, object cutting and supported target-effect lifecycles.
Every new rule needs source evidence and tests at the lowest useful layer;
Foundry UI/persistence changes also require scoped live validation. Narrative
appearance, legality, technology explanations and genre suitability remain GM
adjudication and reference content.
