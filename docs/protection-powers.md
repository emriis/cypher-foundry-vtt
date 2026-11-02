# Protection and resistance powers

The first protective family implements Mage Armor, Armoring Debris and Elemental
Protection. The PC sheet has a dedicated Protections section; macro entrypoints
are exposed through `game.cypher.protections`. The supplied 2026-07-29 CRD is the
sole rule authority. Independently reviewed clauses are recorded in
`data/crd-protection-powers.json`.

## Source contracts

| Ability | CRD locator | Activation and duration |
| --- | --- | --- |
| Mage Armor | Fantasy Genre / Dungeon Fantasy / Mage, paragraphs 956–957 | 1 Intellect, action, until the recipient's ten-hour recovery. |
| Armoring Debris | Foci / Masters Telekinesis, paragraph 4537 | 5 Intellect, action, nearby small objects, until ten-minute-or-longer recovery. |
| Elemental Protection | Fantasy Genre / Mid-Tier Fantasy Abilities, paragraphs 1745–1747 | 4+ Intellect, action, caster and designated immediate-range creatures, one energy kind, until each recipient's own hour-or-longer recovery. |

Elemental Protection already comes from the Genre catalogue during source
normalization. No duplicate compendium entry or translation is authored.

Two user adjudications complete the source contract:

- Each paid Effort level devoted to Elemental Protection adds one severity step,
  up to three total steps. Zero, one and two levels grant one, two and three
  steps respectively; further allocation is rejected rather than wasted.
- Protected NPCs take 3 less numerical damage per step: 3, 6 or 9. This extends
  the explicit NPC correspondence in Automaton Force Field Upgrade, paragraph
  3601. It is an accepted extrapolation for Elemental Protection, not a claimed
  general CRD conversion between NPC Health and wounds.

The separate Damage to Pools table, paragraphs 7722–7733, converts excess damage
after a PC Pool reaches zero: 1–4 minor, 5–8 moderate, 9+ major. It is not an
invertible NPC Health conversion or a player-versus-player damage rule.

## Block and damage resolution

Mage Armor is an explicit choice on Block rolls. It uses Intellect instead of
Might and eases that roll by one step, or two total at tier three or higher.
Ordinary physical Block remains available. A successful magical Block reduces
the wound by the ordinary one step; it does not reduce it twice. Physical armor
still provides its general Block easing under the Armor and Shields rules.

Armoring Debris requires confirmation that nearby small objects are available.
It adds one step of Block easing, including a selected Mage Armor Block, and
does not ease Dodge. Repeated copies do not multiply the same bonus. These
powers do not create physical armor Items or invent held-object requirements.

Elemental Protection affects only wounds from the declared energy. Dedicated
energy fields are available in attack/defense, NPC damage/attack and environment
dialogs. Names and descriptions of Items never establish an energy type.
Custom energy categories are explicit GM data, normalized for matching. Existing
fire/heat and cold/ice damage tags remain supported; conflicting energy tags
require an explicit choice. An empty energy field leaves untyped attacks
unprotected unless their existing tags establish the type.

Identical energy/step bonuses do not stack. Distinct bonus magnitudes apply
together, capped at three severity steps, following the accepted exact-bonus
non-stacking policy. Species reductions remain separate. The automaton's general
field is distinct from energy-specific protection. NPC reduction applies after
Armor and survives Armor bypass; an attack's actual capped Health contribution
is still recorded by the existing attack-history pipeline.

PC Pool damage is not reduced numerically by Elemental Protection. If that Pool
hit overflows into a wound, the energy protection applies to the resulting
wound. A chosen physical shield still absorbs the original incoming wound,
including its ordinary destruction/overflow rules; personal resistance does not
silently change shield capacity or damage.

Environmental profiles use the same energy declaration and resistance. A fully
protected wound-only exposure completes its occurrence without defense dice or
Effort spending. Pool damage and conditions retain their own defenses. Do not
repeat tracked Ability protection in the profile's manual reduction fields.

## Activation, recovery and partial writes

The elected active GM confirms debris, immediate-range recipients and energy.
All actual Actors are resolved and permission/resource prerequisites checked
before mutation. Synthetic Actors retain their token UUIDs; neither their base
Actor nor another token is substituted. The caster is always included in
Elemental Protection. Dedicated Effort uses the shared score/ceiling allocator,
with Edge once across activation and allocated levels. No attack roll or
natural-20 refund is invented for these non-rolled activations.

One source Actor update checkpoints payment and the complete pending plan.
Recipient receipts then record the original recovery revision. A batch grants
no benefits until the source acknowledges completion. Lost recipient responses
resume after reload or source removal without payment, another action, healing
or duplicate duration. A recipient recovery during partial settlement is not
overwritten or renewed when the batch resumes. The GM can abandon a partial
activation without a refund; its retained receipts remain inactive.

Each recipient's actual recovery advances their own relevant revision in the
same Actor update as the recovery. The caster resting ends only their own
Elemental Protection, leaving the other creatures protected. NPCs have no PC
recovery counters: an explicit GM control confirms a completed hour-or-longer
rest and expires their protection without inventing Health restoration. A
recipient may explicitly end one protection without ending other recipients'
effects. Open protection sheets refresh after source acknowledgements.

Optional versioned flags hold uses, receipts and recovery revisions. No schema
migration or new currency store is required. Local guards serialize participating
Actors on the elected GM client; they are not distributed locks against arbitrary
external edits. No stale snapshot rollback overwrites later wounds or Health.

## Rerolls and boundaries

Defense history stores the energy reduction actually applied. A later successful
Block reroll uses that original reduction even if the protection expired or the
source Item disappeared. Redirection through Take the Attack also retains the
original defender's reduction. Attack history stores the original numerical NPC
protection, including a miss that later becomes a hit. Later unrelated damage
is preserved; intervening healing keeps the existing manual reconciliation
boundary. Rerolls do not reactivate these protections or repay their casting
costs. Existing retained natural-20 behavior for the rerolled task is unchanged.

Awesome Force Field and its remote barriers, Ice Armor/Improved Ice Armor and
Electric Armor remain separate contracts because they introduce additional
barrier, retaliation, touch-attack or damage mechanics. This family does not
claim blanket automation of all defensive Abilities or Cypher effects.

## Validation

Focused rule/service/content tests cover exact sources, costs, Effort allocation,
permissions, fiction, selected Pool, tier scaling, Block versus Dodge, individual
recovery, identical/different bonuses, numerical NPC damage, lost responses,
source removal, abandonment, environmental immunity, Pool overflow, original
shield wounds and attack/defense corrections after expiry. Live scenarios are
scoped by `protection powers:`. Observed results are recorded after execution.

### Observed validation — 2026-11-02

The final isolated `npm test` passed **1,254 tests** across 32 suites, with no
failures or skips. All 16 focused rule/service/content tests passed. Lint, the
existing type-checking pilot, architecture, native locale consistency,
system/E2E syntax and Git whitespace checks passed.

All **three** scoped Foundry scenarios passed together on **14 build 369**,
Chromium **153.0.8010.12**, system **0.2.0-alpha.1**, in disposable Data:

- Actual EN/FR compendium imports, light/dark themes and a 640 × 700 PC sheet;
  activation through keyboard/mouse controls, declared debris, selected Intellect
  Block, correct paid costs, preserved ordinary Block reduction, reload and
  distinct ten-minute/ten-hour expiration.
- Two paid protection Effort levels, an actual synthetic NPC, typed attack
  mitigation and untouched base-Actor Health; caster, PC ally and NPC recovery
  independence, the NPC rest control and a paid attack reroll retaining its
  original nine-point protection after expiry.
- A committed-but-unacknowledged recipient write, source deletion, reload and
  sheet resumption without repayment, Health restoration or renewed recipient
  duration; a paid defense reroll after protection ended removes only its
  attributable wound and preserves a later unrelated major wound.

All 15 compiled-pack readability checks and packaged-tree verification passed.
No V13 live result is claimed; compatibility metadata remains unchanged.
Authoring changes are limited to rules/services and damage/recovery/defense/
environment integrations, sheets/templates, reviewed evidence/audit coverage,
tests, documentation, paired locale sources and their intentionally compiled
native bundles. Compendium sources, generated pack databases, distribution
artifacts and the manifest remain unchanged in the authoring checkout. The
configured user world and Foundry installation were not modified.
