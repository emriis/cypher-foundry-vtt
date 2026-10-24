# CRD Weapon Runtime Matrix

This matrix audits the structured weapon fields extracted from the 2026-07-29
Cypher Reference Document (CRD) against the current Foundry runtime. It
distinguishes storing a mechanic, resolving its applicability, presenting it to
the GM, and applying it to game state. Those are separate completion criteria.

The CRD is authoritative. A field is not marked automated merely because it is
present in an Item, copied to a chat flag, or shown in descriptive text.

## Status definitions

- **Runtime** — the mechanic currently changes task resolution or game state.
- **Resolved/presented** — code selects or carries the mechanic into the roll
  result, but does not apply the resulting effect to the target.
- **Stored only** — the field is preserved in source data but is not consumed by
  gameplay logic.
- **Model gap** — correct automation needs a model or a rule interpretation not
  currently represented by the system. Do not infer that missing behavior.
- **Rule contract** — deterministic mechanics have a pure resolver and tests,
  but the application/UI has not connected the resolver to a playable action.

## Weapon fields

| Field | Current behavior | Status | Remaining work |
| --- | --- | --- | --- |
| `attackType` | Supplies default damage only when explicit damage is absent; explicit zero remains zero. Light attacks receive one ease step. Weapon category also participates in weapon familiarity. | Runtime | Source-specific exceptions need their own CRD contracts. |
| `damage` | Becomes the base damage for the task result. A successful attack against a selected NPC now persists numeric damage to the target Health after Armor mitigation. | Runtime | Wound/Pool target damage remains a separate contract. |
| `stat` | Chooses the Pool and stat used for the attack task. | Runtime | None identified in this field audit. |
| `range` | Preserved on the Item and included in the attack result's range-adjudication record. The GM explicitly declares whether the target is at the weapon's range limit. | Runtime (explicit adjudication only) | No token-distance or grid measurement is inferred. A future distance contract would be a separate feature. |
| `extremeRange` | Preserved separately from normal range and recorded with the GM's explicit extreme-range declaration. A declared extreme-range attack is hindered by one step. | Runtime (explicit adjudication only) | The system does not automatically determine whether the target is within normal or extended range. |
| `weaponFamily` | Participates in the actor's free-use/familiarity rules. | Runtime | None identified in this field audit. |
| `attackSkillCategory` | Matches an owned attack-category Skill and participates in familiarity/skill adjustment. | Runtime | None identified in this field audit. |
| `freelyUsable` | Removes the unfamiliar-weapon penalty. | Runtime | None identified in this field audit. |
| `properties` | Preserves CRD weapon-note text for display and fidelity. The runtime does not parse arbitrary prose. | Descriptive-only | Keep this source-facing text; automate only mechanics backed by structured fields and explicit rules. |
| `mechanics.twoHanded` | Enforces the structured two-hand minimum against a saved actual grip, including medium weapons; heavy active categories also require two hands unless the source explicitly permits hindered one-handed use. | Runtime | Descriptive exceptions still need structured source contracts. See [equipment constraints](equipment-constraints.md). |
| `mechanics.hinderedWhenUsedOneHanded` | Actual declared one-hand grip adds one hindrance step; a two-hand grip does not. The roll dialog reflects saved grip instead of allowing the penalty to be unchecked. | Runtime | E2E covers unmarked weapons and both declared grip states. |
| `mechanics.rapidFire` | Spray/Arc Spray sheet actions validate weapon eligibility and execute the source-backed attack contracts against selected NPCs. | Runtime | Additional rapid-fire Abilities require their own source-backed contracts. |
| `availableUses` | Optional, explicitly tracked ammunition/power/thrown-weapon store. Spray consumes the capped d6 + 1 count and persists the remainder. | Runtime | Ordinary attacks and Arc Spray do not infer consumption rules from this field. |
| `mechanics.ignoresPhysicalArmor` | Numeric Armor bypass is passed from the weapon to the attack resolver and applied once against selected NPC Armor. | Runtime | Source-specific exceptions still require explicit modelling. |
| `mechanics.cutsThroughMaterialsLevel` | Preserved in the Item model. | Stored only / model gap | Requires an interactable material/object model with levels and a CRD-backed resolution contract. |
| `mechanics.targetEffects` | Filters effects by target level, persists them to targeted NPCs on a successful attack, and consumes supported `hindered` / `loseNextAction` effects in NPC attack resolution according to duration. Repeated structured Stunstick hindrance keeps two steps and the latest expiry under the accepted user adjudication. | Runtime (NPC attack consumer) | Other opposed tasks/passive NPC defenses need contracts. |
| `mechanics.requiresTripod` | Requires explicitly declared deployment before weapon attacks, checked again before task costs. | Runtime | No deployment duration or positioning distance is invented. |
| `mechanics.requiredOperators` | Counts the acting PC plus distinct assigned actual PC/NPC UUIDs; missing or incapacitated participants do not satisfy the requirement. Synthetic identity survives reload. | Runtime | Participation remains explicit. No helper action cost or bonus is inferred. |
| `mechanics.alternateConfiguration` | Persists primary/alternate selection; the switch action is announced in chat and the active category determines attack ease/familiarity, category damage, and action timing. | Runtime (configuration switch) | Switch action cost is announced but not enforced; active attack timing is enforced by round flow. Only the CRD-defined alternate category is modeled; no other weapon fields are inferred. |
| active weapon category timing | Light supports First timing, medium ordinary timing, and heavy requires Last timing in the managed round flow. | Runtime | Special eligibility remains an explicit declaration. See [round execution](round-flow.md). Timing derives from category, not the `twoHanded` flag. |

## Existing runtime contracts

- Weapon range is not inferred from token coordinates. The attack dialog exposes
  an explicit extreme-range declaration after the GM's adjudication; when
  selected, the task receives one additional hindrance step and records the
  declared normal/extreme range in the chat flags. This records the adjudication
  without claiming an automatic range-limit check.
- Weapon familiarity combines explicit free-use state, actor free-use
  categories/families, and a matching attack-category Skill.
- A selected NPC target is used to resolve level-gated target-effect candidates.
  If no single target is selected, or the selected target is not an NPC with a
  valid level, no level-gated effects are selected.
- Matching target effects are persisted to a selected NPC on a successful attack
  and supported `hindered` / `loseNextAction` effects are consumed according to
  their declared duration.
- Stunstick inflicts zero damage as specified by the Science Fiction Equipment
  table. For its level-gated hindrance lasting "a round or two", the accepted
  adjudication is one round by default, with one explicit GM extension to two.
  The NPC sheet displays active effects and provides the extension control only
  to a GM who can update that Actor. Repeated, expired, and unauthorized extension
  requests perform no writes. Combat round changes determine expiration; outside
  combat the existing NPC-action boundary consumes the remaining narrative rounds.
  This boundary does not measure elapsed real time or infer the end of a fight.
- Core attack resolution computes damage and persists successful numeric damage
  to a selected NPC target, including the declared physical Armor bypass.

## Weapon-dependent Ability contracts

The pure `resolveSprayUse` rule models the CRD's 1d6 + 1 uses, the cap imposed
by an explicitly supplied available-use count, one attack asset, and one less
damage on a successful attack. The pure `resolveArcSprayAttacks` rule requires
three distinct targets with explicit adjacency confirmation and returns a
separate one-step-hindered attack profile for each.

Both contracts are connected to PC Ability cards, application services,
explicit target selection, Pool/resource persistence, normal weapon attack
resolution, chat cards, and sheet-driven E2E scenarios. See
`docs/weapon-ability-execution.md` for the supported scope.

## Recommended implementation order

Held/stowed state, finite hand capacity, weapon/shield conflicts, tripod setup
and actual operator participation are implemented in
[equipment constraints](equipment-constraints.md). Missing legacy grips require
explicit declaration; they are not inferred from carrying inventory.

1. Establish an interactable object/material contract before automating
   `cutsThroughMaterialsLevel`.
2. Address configuration-switch action spending and other remaining equipment
   interactions through their explicit source contracts. Do not invent generic
   ammunition consumption or setup durations.
3. Continue the remaining structured weapon and Ability audit, including
   additional rapid-fire Abilities, without inferring mechanics from prose.

The core PC-to-NPC numeric damage contract and physical Armor bypass are already
implemented and verified. NPC-to-PC wound/Pool attacks are also handled through
the separate player-defense contract; these are not prerequisites for the
remaining weapon mechanics.

## Non-goals

- Do not infer mechanics from `properties` prose or weapon names.
- Do not add extra attacks, damage, penalties, or target conditions based on
  field names alone.
- Do not add creature extraction: the supplied CRD has no creature inventory.
- Do not hand-edit generated LevelDB compendiums; edit source records and build
  artifacts through the repository scripts.
