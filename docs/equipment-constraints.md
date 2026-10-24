# Equipment constraints

## Authority

Source: supplied CRD, 2026-07-29, **Weapons** (5267–5269), explicit one-handed
weapon notes (5401, 5405, 5763), the two-handed medium weapon (5589), and the
tripod/two-operator weapon (5814). Heavy weapons require two hands. The explicit
one-handed hindrance exception takes precedence; medium weapons explicitly
requiring two hands retain that requirement. Weapon names are never parsed.

## Declared grips and compatibility

The PC sheet distinguishes inventory possession from actual held objects. Its
hand/setup panel records held/stowed state and occupied hands for attacks,
shields and ordinary equipment. Stowing keeps the Item in inventory. A grip
conflicting with another held object is refused; nothing else is unequipped.

The default hand capacity is two. The GM can explicitly change it, including
zero or additional hands, without deriving anatomy from species or prose.
Capacity cannot be reduced below current occupancy. Nonphysical or hands-free
attacks require an explicit zero-hand declaration approved by the GM for that
Item; the player may subsequently reuse that approval. Zero cannot bypass the heavy
or explicit two-handed minimum. The GM revokes a hands-free declaration by
readying that Item with a positive hand count again. A source not structurally
describing its grip, including ordinary descriptive gear, remains a player/GM
declaration.

The generic shield occupies at least one hand while readied. Existing equipped,
possessed shields retain that declared readiness. Thrown and destroyed shields
release their allocation. Retrieving a shield restores possession without
automatically readying it. Catching checks room before dice/costs; a successful
catch restores readiness and its saved grip in one Item update. A later paid
reroll cannot force a caught shield into hands occupied since the original
attempt; the existing stale-catch note requires adjudication instead.

Actual grip determines a marked weapon's one-handed hindrance. The roll dialog
shows the saved one-handed state; unchecking an option cannot bypass the penalty.
Changing to a configuration requiring more hands is refused while its current
held grip is insufficient. Configuration switching retains its existing action
cost announcement; this change does not newly enforce that action cost.

## Setup and operators

Required tripod deployment is an explicit saved declaration. The acting PC
counts as one operator. Additional operators are distinct actual PC/NPC Actor
UUIDs, including synthetic Actors sharing a world base. Missing, unconscious,
stunned, paralyzed or dead participants do not satisfy the requirement.
Compendium templates are not participants. Operators are re-resolved from the
current world/token cache before each attack, so a later incapacity or deletion
blocks further attacks before costs or dice.

The source does not supply an installation action cost, distance requirement or
assistant bonus here. The system invents none and does not spend another
operator's action. Selecting participants declares that their participation is
fictionally applicable; their documents are never modified by this workflow.

## Persistence and mutation boundaries

Versioned `flags.cypher.equipmentUse` on each actual Item stores the declaration;
`flags.cypher.handCapacity` on its actual Actor stores a GM adjustment. No
existing schema field is renamed, removed or transformed. Missing weapon/gear
declarations remain unknown, not automatically held; the sheet asks before the
attack options dialog. Direct Item attack APIs refuse missing declarations.
Existing macro callers must explicitly configure their grip first.

Use `configureEquipmentUse(item, {held, hands, deployed, operators})` from
`module/applications/equipment-hands-service.mjs`; cancellation writes nothing.
The explicit equipment declaration is its own accepted action: cancelling a
subsequent roll does not undo an already accepted grip change. Source Abilities
reuse the same preflight, including each multi-attack and thrown-shield flight.
There is no generic exemption inferred from an Ability's display name.

Equipment changes and attacks share the local actual-Actor reservation.
Prerequisites are rechecked at the task boundary before resource mutation.
No cross-client database lock is claimed, and raw/manual document edits can
create inconsistent declarations; an actual physical weapon attack still
rechecks them. A generic task without an identified physical inventory weapon
remains an explicitly adjudicated task, not an inferred equipment operation.

No automatic world migration or pack rewrite is required. Existing inventory,
unrelated flags and Item descriptions survive; legacy data are not assigned
invented grips. The behavior change for old weapon macros is explicit above.

## Scope remaining

Object/material interaction for `cutsThroughMaterialsLevel`, broad ammunition
consumption rules, source-specific hand exceptions not yet represented by
structured fields, and generic equipment power effects remain separate work.
Passing this workflow does not mark all equipment or Ability mechanics complete.

## Observed validation — 2026-10-24

After the French-source refactors on `main` (`5200f66`), `npm test` passed all
1,002 tests in an isolated normalized checkout containing this equipment work.
There were no failures or skipped tests.

The current runtime suite passes 692 tests, including regression coverage for
hand conflicts, explicit hands-free approval, unavailable crew, configuration
changes and cancellation before costs. Lint, the scoped typecheck, architecture
dependencies and locale source/bundle consistency checks pass.

Eleven distinct scoped Foundry scenarios passed across the initial run and a
targeted rerun of the equipment UI scenario. The initial UI test exposed a
dialog-close timing issue in its selector; the rerun waits for the old dialog
to close. Observed live coverage uses Foundry 14.369 and Chromium 153, including
EN/FR, light/dark themes at 640×700, reload persistence, synthetic operator
identity, thrown-shield catches, paid rerolls and existing shield Abilities.
The isolated E2E preparation also passed 15 pack-readability contracts and
package verification. This is targeted gameplay coverage, not a claim that the
entire E2E suite or Foundry V13 was validated. No compatibility declaration was
changed.
