# Weapon-dependent Ability execution contracts

## Scope

This change establishes deterministic rule contracts for the CRD's Spray and
Arc Spray abilities. It does not claim that either ability is available as a
complete action in the Foundry sheet.

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

## Remaining integration

The following are not implemented by these pure contracts:

- buttons and dialogs on the PC sheet;
- selecting a weapon or the thrown-weapons alternative;
- rolling the d6 for Spray;
- persisting ammunition/power or thrown-weapon consumption;
- rolling attacks and applying the Spray asset and damage reduction;
- resolving each Arc Spray target's attack against the real actor;
- chat cards and end-to-end Foundry tests for both abilities.

Those are the next integration tasks. Keep the rules pure and test them
independently before connecting them to Foundry services.
