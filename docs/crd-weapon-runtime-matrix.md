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
| `attackType` | Supplies default damage when explicit damage is falsy; light attacks receive one ease step. Weapon category also participates in weapon familiarity. | Runtime | Verify source-specific exceptions and zero-damage handling separately; do not change without CRD evidence. |
| `damage` | Becomes the base damage for the task result. A successful attack against a selected NPC now persists numeric damage to the target Health after Armor mitigation. | Runtime | Wound/Pool target damage remains a separate contract. |
| `stat` | Chooses the Pool and stat used for the attack task. | Runtime | None identified in this field audit. |
| `range` | Preserved on the Item and included in the attack result's range-adjudication record. The GM explicitly declares whether the target is at the weapon's range limit. | Runtime (explicit adjudication only) | No token-distance or grid measurement is inferred. A future distance contract would be a separate feature. |
| `extremeRange` | Preserved separately from normal range and recorded with the GM's explicit extreme-range declaration. A declared extreme-range attack is hindered by one step. | Runtime (explicit adjudication only) | The system does not automatically determine whether the target is within normal or extended range. |
| `weaponFamily` | Participates in the actor's free-use/familiarity rules. | Runtime | None identified in this field audit. |
| `attackSkillCategory` | Matches an owned attack-category Skill and participates in familiarity/skill adjustment. | Runtime | None identified in this field audit. |
| `freelyUsable` | Removes the unfamiliar-weapon penalty. | Runtime | None identified in this field audit. |
| `properties` | Preserves CRD weapon-note text for display and fidelity. The runtime does not parse arbitrary prose. | Descriptive-only | Keep this source-facing text; automate only mechanics backed by structured fields and explicit rules. |
| `mechanics.twoHanded` | Preserved in the Item model; does not track occupied hands. | Stored only / model gap | Needs an explicit equipment-hand model before enforcing two-handed use. |
| `mechanics.hinderedWhenUsedOneHanded` | CRD-explicit flag on affected weapons; the PC attack dialog exposes a one-handed choice and adds one hindrance step when selected. | Runtime | E2E covers unmarked weapons, the marked option left off, and the selected one-handed hindrance. |
| `mechanics.rapidFire` | Ability prerequisite resolver consumes the flag for abilities whose structured CRD prerequisites require rapid fire. Pure Spray/Arc Spray rule contracts now describe use counts and per-target attack modifiers. | Rule contract | Connect the contracts to PC sheet actions, dice rolls, resource transactions, target selection, attack resolution, chat cards, and Foundry E2E tests. |
| `mechanics.ignoresPhysicalArmor` | Numeric Armor bypass is passed from the weapon to the attack resolver and applied once against selected NPC Armor. | Runtime | Source-specific exceptions still require explicit modelling. |
| `mechanics.cutsThroughMaterialsLevel` | Preserved in the Item model. | Stored only / model gap | Requires an interactable material/object model with levels and a CRD-backed resolution contract. |
| `mechanics.targetEffects` | Filters effects by target level, persists them to targeted NPCs on a successful attack, and consumes supported `hindered` / `loseNextAction` effects according to duration. | Runtime | Extend only when additional CRD effect semantics are structured. |
| `mechanics.requiresTripod` | Preserved in the Item model. | Stored only / model gap | Requires deployment/positioning state and a rule for resolving attacks when the requirement is unmet. |
| `mechanics.requiredOperators` | Preserved in the Item model. | Stored only / model gap | Requires a group/operator participation model and a rule for enforcing the minimum. |
| `mechanics.alternateConfiguration` | Persists primary/alternate selection; the switch action is announced in chat and the active category determines attack ease/familiarity, category damage, and action timing. | Runtime (configuration switch) | Switch action cost and attack timing are recorded/presented but not enforced by a turn/action economy. Only the CRD-defined alternate category is modeled; no other weapon fields are inferred. |
| active weapon category timing | Light resolves to `firstAction`, medium to `action`, and heavy to `lastAction`; timing is included in attack chat flags and shown on the roll card. | Resolved/presented | Not enforced because turn/action-economy state is not implemented. Timing is derived from category, never from `twoHanded`. |

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
- Core attack resolution computes damage and persists successful numeric damage
  to a selected NPC target, including the declared physical Armor bypass.

## Weapon-dependent Ability contracts

The pure `resolveSprayUse` rule models the CRD's 1d6 + 1 uses, the cap imposed
by an explicitly supplied available-use count, one attack asset, and one less
damage on a successful attack. The pure `resolveArcSprayAttacks` rule requires
three distinct targets with explicit adjacency confirmation and returns a
separate one-step-hindered attack profile for each.

These are **rule contracts**, not complete playable actions. The PC sheet,
resource persistence, attack execution, chat presentation, and E2E scenarios
remain to be integrated. See `docs/weapon-ability-execution.md`.

## Recommended implementation order

1. Wire the pure Spray/Arc Spray contracts to the PC sheet and Foundry
   application services, including target selection, explicit resource tracking,
   and separate attack results.
2. Tripod/operator requirements still need reliable equipment setup and
   participation state. Two-handed occupancy and material cutting remain
   blocked on equipment/object models.
3. Continue the remaining structured weapon and ability audit without inferring
   mechanics from descriptive text or names.

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
