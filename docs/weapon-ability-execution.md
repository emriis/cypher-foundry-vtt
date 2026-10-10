# Weapon-dependent Ability execution

## Scope

Spray and Arc Spray are playable from an owned Ability card on the PC sheet.
Stable Ability keys select the action; localized display names are not used
to infer mechanics. The deterministic rules remain independent of Foundry.

The CRD remains the sole source of mechanics. The application layer is
responsible for dialogs, dice rolls, target selection, resource transactions,
and chat output.

## Spray

The pure `resolveSprayUse` rule receives the result of the CRD's 1d6 roll and,
when resource tracking is enabled for the use, the available number of
attacks-worth of ammunition, power, or thrown weapons.

It returns:

- requested uses: d6 result + 1;
- uses to consume: the requested amount, capped at the explicitly supplied
  available amount;
- one asset step for the attack;
- one less damage on a successful attack.

An explicitly empty store rejects the action without granting its benefits.
A `null` available-use count means the caller has not supplied a tracked store;
the rule does not invent a store or mutate an actor. The caller must not treat
this as permission to skip resource tracking when the campaign uses it.

## Arc Spray

The pure `resolveArcSprayAttacks` rule requires exactly three distinct target
IDs and explicit confirmation that all three targets are adjacent. It returns
three separate attack profiles, each hindered by one step.

Adjacency is deliberately supplied by the application/GM. The rule does not
infer distance from token coordinates or grid settings.

## Foundry integration

The PC sheet collects the weapon, NPC targets, roll modifiers, and explicit
adjacency/reach declarations. Selected unlinked tokens retain their synthetic
Actors, so damage does not accidentally affect the originating world Actor.

- Spray rolls its d6, consumes a tracked weapon `availableUses` store, and adds
  one asset (subject to the usual asset cap) while reducing base damage by one.
- The weapon Item sheet allows editing this store. Empty means untracked;
  zero means empty. This is an explicit attacks-worth count of ammunition,
  power, or available thrown weapons, rather than an inferred inventory.
- Arc Spray resolves three separate attacks, each hindered by one step, using
  the respective NPC level. It does not invent an ammunition count absent from
  its source contract.
- Both actions use the normal weapon engine for familiarity, configuration,
  range adjudication, Armor bypass, successful damage, and target effects.
- Activation is charged once. Edge is shared between activation and Effort on
  the first attack, and a natural 20 refunds that activation charge. Additional
  attacks are extra actions for Effort (CRD Actions); their task costs use the
  existing engine. All requested costs are checked before the first attack.
- The activation charge follows the Ability's structured cost stat. These
  source Abilities have fixed Speed costs; no stat choice is inferred.
- Attack cards identify the Ability and target, and chat flags retain the
  Ability identity and Spray resource count. The resource die has its own card.
- Application contracts and live sheet-driven E2E scenarios cover both actions.

Lucky Shot is not offered in these Ability dialogs. Target distance and
adjacency are not measured automatically. These actions currently target NPCs,
matching the system's PC-to-NPC numeric-damage contract.
