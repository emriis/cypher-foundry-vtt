# Objects and materials

## Source and adjudications

The supplied CRD, **Damage to Objects** (paragraphs 7741–7748 of the reference
extraction), is authoritative. Objects have no wounds or stat Pools. Current
level supplies both attack difficulty and Armor. Successful damage exceeding
Armor reduces level point for point. Level 0 means broken and unusable;
subsequent damage equal to the original level destroys the object.

Accepted adjudications for this implementation:

- Surplus from the hit that breaks an object is discarded. Only subsequent hits
  contribute to destruction.
- The monomolecular blade's **Science Fiction Equipment** entry (paragraph 5798)
  still requires an attack roll. Its structured cutting threshold ignores
  protection for physical materials at or below current level 6.
- Physical-tool compatibility is explicitly declared. A softer tool has no
  effect; the system invents no material hardness table. Unknown compatibility
  rejects the action before costs, except when the cutting threshold applies.

For example, a level-6 steel door hit for 7 damage falls to levels 5, 3, then 0.
It remains broken after that third hit and needs 6 further damage to be destroyed.
Defensive PC shields retain their separate wound and destruction rules.

## Playable workflow

Create an Actor of type **Object**, set its original level and describe its
material. Physical material is an explicit checkbox. Use its token as the one
selected target when attacking from a PC weapon card. The roll dialog displays
the material, fixes base difficulty to current level, and asks for the attack
method and tool compatibility. Normal weapon prerequisites, skill modifiers,
Effort, Edge, action timing and natural-roll results still apply.

Only the actual owned weapon's `mechanics.cutsThroughMaterialsLevel` and
`mechanics.ignoresPhysicalArmor` supply the cutting/physical Armor exception;
client-declared numeric overrides and names do not establish those properties.
NPC-specific weapon target effects are not applied to objects.

The GM sheet also provides **Apply raw damage**, which subtracts current Armor
after the GM has adjudicated applicability, and a confirmed **Reset damage**.
Reset is an authoring/adjudication control, not a resource-point repair action.
Destruction retains the Actor and token, displaying their status without deletion.

Existing Foundry permissions apply: the acting client must own the PC and the
target object to persist consequences, as with current NPC attacks. A GM can
perform the attack or grant ownership; this feature adds no privileged socket.

Macros can call an owned weapon's `rollAttack` with an actual target Actor:

```js
await weapon.rollAttack({ target: objectActor,
  objectInteraction: { method: "physicalTool", toolHardEnough: true } });
```

Use `method: "other"` only for an explicitly adjudicated non-tool method.
`game.cypher.objects.damageObject(objectActor, rawDamage)` and
`resetObject(objectActor, { confirmed: true })` are GM-only entry points.

## Persisted state and relaunch

The new Actor schema stores `originalLevel`, `levelDamage`, `destructionDamage`,
`physical`, `material` and HTML `description`. Current level and functional,
broken or destroyed status are derived without writes. No existing Actor or
inventory Item is converted; existing worlds need no migration. Invalid joint
counter states are visible and reject damage until explicitly corrected.

Each attack card stores before/after state, material profile, target UUID and
revision. Paid XP rerolls use that saved target, including an unlinked token
Actor, after reload. They replace the original contribution only when the
object still matches the saved after-state and revision. Later hits, resets or
material edits require GM reconciliation; they are never erased. Partial writes
retain a pending checkpoint and also require reconciliation. Original attack
costs stay spent, with the existing natural-20 refund exception applied once.
Local action guards prevent overlapping writes within one client; they are not
distributed transactions between clients.

## Boundaries and verification

Objects are explicit interactable targets, not automatically generated from
inventory equipment, prices or descriptive text. Generic item repairs, crafting
and resource-point projects remain separate. The optional **Damage to Objects**
suggestion to treat hacking/lockpicking progress as level damage (paragraph 7749)
has no automatic damage conversion in this contract.

Pure and application tests cover the source examples, destruction phases,
material validation, cutting, revision invalidation, saved rerolls and costs.
The scoped `objects:` Foundry E2E scenarios cover the new sheets in EN/FR and
both themes, keyboard damage/reset actions, persistence, synthetic targets and
real compendium cutting mechanics. Record observed runs separately from the
existence of those tests. ApplicationV2 controls follow the official
[ActorSheetV2](https://foundryvtt.com/api/classes/foundry.applications.sheets.ActorSheetV2.html)
and [DialogV2](https://foundryvtt.com/api/classes/foundry.applications.api.DialogV2.html)
contracts; unchanged compatibility declarations do not imply a new V13 run.

### Observed live validation — 2026-10-26

All four scoped `objects:` E2E scenarios passed on Foundry 14 build 369 with
Chromium 153.0.8010.12 and system 0.2.0-alpha.1 in disposable Data. The sheet
scenario exercised EN/FR and light/dark themes at 640 × 700, keyboard damage
and confirmed/cancelled reset, horizontal overflow and persistence after reload.
The attack scenarios verified the real PC weapon dialog, raw level/Armor
reduction, breaking before destruction, unchanged synthetic base Actor,
compendium-backed cutting, paid rerolls and later-edit reconciliation. V13
was not live-tested. The runner also built and verified the package in its
temporary checkout; no generated packs or distribution artifacts were written
to the authoring checkout.

The final isolated `npm test` run passed all 1,071 tests, including 17 focused
object rule, application, model and audit regressions. Lint, the existing type
pilot, architecture dependency audit and native locale consistency also passed.
