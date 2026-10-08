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
| `range` | Persisted on the Item. | Stored only | Requires a reliable target token/distance and scene-grid contract, plus CRD-backed range adjudication. |
| `extremeRange` | Persisted separately from normal range. | Stored only | Same target-distance and range-resolution gap as `range`. |
| `weaponFamily` | Participates in the actor's free-use/familiarity rules. | Runtime | None identified in this field audit. |
| `attackSkillCategory` | Matches an owned attack-category Skill and participates in familiarity/skill adjustment. | Runtime | None identified in this field audit. |
| `freelyUsable` | Removes the unfamiliar-weapon penalty. | Runtime | None identified in this field audit. |
| `properties` | Preserves CRD weapon-note text for display and fidelity. The runtime does not parse arbitrary prose. | Descriptive-only | Keep this source-facing text; automate only mechanics backed by structured fields and explicit rules. |
| `mechanics.twoHanded` | Preserved in the Item model. It does not validate whether the actor can use the weapon one-handed or track occupied hands. | Stored only / model gap | Needs an explicit equipment-hand model and CRD-backed handling for using a two-handed weapon in one hand. |
| `mechanics.rapidFire` | Preserved in the Item model. No distinct rapid-fire action or resolution path consumes it. | Stored only / rule gap | Identify the exact CRD rule and expected player workflow before implementing. Do not infer extra attacks or damage. |
| `mechanics.ignoresPhysicalArmor` | Numeric Armor bypass is passed from the weapon to the attack resolver and applied once against selected NPC Armor. | Runtime | Source-specific exceptions still require explicit modelling. |
| `mechanics.cutsThroughMaterialsLevel` | Preserved in the Item model. | Stored only / model gap | Requires an interactable material/object model with levels and a CRD-backed resolution contract. |
| `mechanics.targetEffects` | `resolveWeaponTargetEffects` filters effects by the selected NPC's level. Matching effects are carried into the task result and chat flags. | Resolved/presented | Not yet applied to target state. Requires a persisted target-effect/status model and lifecycle for effects such as losing the next action or being hindered for a duration. |
| `mechanics.requiresTripod` | Preserved in the Item model. | Stored only / model gap | Requires deployment/positioning state and a rule for resolving attacks when the requirement is unmet. |
| `mechanics.requiredOperators` | Preserved in the Item model. | Stored only / model gap | Requires a group/operator participation model and a rule for enforcing the minimum. |
| `mechanics.alternateConfiguration` | Preserves whether an alternate configuration exists, its attack category, and its action label. | Stored only / model gap | Requires a persisted active configuration and an action that switches configurations without losing the source record. |

## Existing runtime contracts

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

1. Define and test the attack-to-target damage contract, including whether
   successful attacks automatically update NPC Health or remain a GM-confirmed
   chat action. This decision gates armor penetration.
2. Once target damage is defined, apply `ignoresPhysicalArmor` through a pure
   damage-resolution helper and test zero, partial, and fully bypassed Armor.
3. Design the persisted target-effect lifecycle before applying
   `targetEffects`; include effect start, duration/expiration, rerolls, and
   target deletion or replacement.
4. Resolve range only after the system has an explicit token-distance contract.
5. Handle two-handed use, rapid fire, tripod/operators, alternate configuration,
   and material cutting only when their CRD rule and necessary state model are
   explicit.

## Non-goals

- Do not infer mechanics from `properties` prose or weapon names.
- Do not add extra attacks, damage, penalties, or target conditions based on
  field names alone.
- Do not add creature extraction: the supplied CRD has no creature inventory.
- Do not hand-edit generated LevelDB compendiums; edit source records and build
  artifacts through the repository scripts.
