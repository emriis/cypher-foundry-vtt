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
| `mechanics.twoHanded` | Preserved in the Item model; does not track occupied hands. | Stored only / model gap | Needs an explicit equipment-hand model before enforcing two-handed use. |\n| `mechanics.hinderedWhenUsedOneHanded` | CRD-explicit flag on affected weapons; the PC attack dialog exposes a one-handed choice and adds one hindrance step when selected. | Runtime | E2E covers unmarked weapons, the marked option left off, and the selected one-handed hindrance. |
| `mechanics.rapidFire` | Preserved in the Item model. No distinct rapid-fire action or resolution path consumes it. | Stored only / rule gap | Identify the exact CRD rule and expected player workflow before implementing. Do not infer extra attacks or damage. |
| `mechanics.ignoresPhysicalArmor` | Numeric Armor bypass is passed from the weapon to the attack resolver and applied once against selected NPC Armor. | Runtime | Source-specific exceptions still require explicit modelling. |
| `mechanics.cutsThroughMaterialsLevel` | Preserved in the Item model. | Stored only / model gap | Requires an interactable material/object model with levels and a CRD-backed resolution contract. |
| `mechanics.targetEffects` | Filters effects by target level, persists them to targeted NPCs on a successful attack, and consumes supported `hindered` / `loseNextAction` effects according to duration. | Runtime | Extend only when additional CRD effect semantics are structured. |
| `mechanics.requiresTripod` | Preserved in the Item model. | Stored only / model gap | Requires deployment/positioning state and a rule for resolving attacks when the requirement is unmet. |
| `mechanics.requiredOperators` | Preserved in the Item model. | Stored only / model gap | Requires a group/operator participation model and a rule for enforcing the minimum. |
| `mechanics.alternateConfiguration` | Preserves whether an alternate configuration exists, its attack category, and its action label. | Stored only / model gap | Requires a persisted active configuration and an action that switches configurations without losing the source record. |

## Existing runtime contracts

- Weapon range is not inferred from token coordinates. The attack dialog exposes a GM-only explicit extreme-range declaration; when selected, the task receives one additional hindrance step and records the declared normal/extreme range in the chat flags. This records the adjudication without claiming an automatic range-limit check.

- Weapon familiarity combines explicit free-use state, actor free-use
  categories/families, and a matching attack-category Skill.
- A selected NPC target is used to resolve level-gated target-effect candidates.
  If no single target is selected, or the selected target is not an NPC with a
  valid level, no level-gated effects are selected.
- Matching target effects are attached to the roll message as data. This is not
  equivalent to applying an effect to the target.
- Core attack resolution computes damage and now persists successful numeric damage
  to a selected NPC target, including the declared physical Armor bypass. Target
  effects remain resolved/presented until a persisted effect lifecycle exists.

## Recommended implementation order

1. Define and implement the persisted target-effect/status lifecycle for
   `mechanics.targetEffects`.
2. Range categories and explicit extreme-range hindrance are now handled by GM adjudication; token-distance calculation remains out of scope unless a separate grid contract is defined.
3. Handle two-handed use, rapid fire, tripod/operators, alternate configuration,
   and material cutting only when their CRD rule and necessary state model are
   explicit.

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
