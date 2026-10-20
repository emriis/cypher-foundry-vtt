# Physical shield Abilities

## Source contract

The supplied CRD 2026-07-29 is read in place in the private reference library.
This implementation covers physical shield Abilities, not every power containing
the word "shield" or every effect capable of damaging or disarming equipment.

| Source | Locator | Runtime contract |
| --- | --- | --- |
| Genre Character Abilities from Types and Foci | 630–632 | An Effort option takes a dedicated level, separate from easing/damage. |
| Fantasy / Extra Actions | 852 | Each additional attack is an extra action with its own Effort. |
| Superheroes / Power Shift Advice | 3063 | An applicable Power shift provides the special Effort benefit. |
| Superheroes / Origin Superhero Abilities / Unyielding Shield | 3425–3429 | Designated shield survives a major wound; next turn is lost unless the GM substitutes an intrusion. Recovery removes minor/moderate shield wounds. Light melee and short-range thrown attacks; difficulty-2 Speed catch; 1d6-day replacement. |
| Foci / Fuses Flesh and Steel / Hidden Shield | 4256–4259 | A concealed body shield, light melee use, an extra melee attack hindering both attacks, and resource-based repair taking about a day. |
| Foci / Stands Like A Bastion / Shield Master | 4968 | Existing +1 moderate shield capacity remains independent of these exceptions. |
| Foci / Stands Like A Bastion / Throw Shield | 4971–4974 | Short-range light attack; difficulty-2 Speed catch even after a miss; failed catch usually leaves the shield a short distance away. |
| Foci / Stands Like A Bastion / Bouncing Shield | 4985–4987 | Three separately resolved light attacks in declared order; only the third may revisit the first target. Difficulty-2 Speed catch, otherwise immediate-distance landing. |
| Rules / Attack; Edge; Special Rolls | 7699, 7552–7553, 7578 | Melee chooses Might/Speed, thrown uses Speed; activation and first attack share Edge; a retained natural 20 refunds the recorded action cost once. |

The user confirmed the dedicated Effort allocation on 2026-10-19. It consumes
one paid level and its share of the normal limit/cost, granting neither easing
nor extra damage. A hit applies one hindered step for one round. Repeated shield
hits refresh that identical hindrance instead of adding steps. Existing combat
round and narrative NPC-action expiration remain authoritative.

## Physical identity and persisted state

`shield.abilityItemId` references the owning PC's actual Hidden/Unyielding Ability
Item. The stable Ability key determines behavior; localized names and descriptive
text never do. The Ability's sheet action creates its shield or designates an
intact existing shield, at most one per Ability. Other inventory shields remain
ordinary. Removing the Ability removes its exception without erasing wounds.

Unyielding Shield records the major wound but replaces destruction with a pending
lost turn. It remains equipped and usable, even on later major hits. A completed
recovery clears its minor/moderate wounds only, preserving major wounds and
unrelated shields. A cancelled recovery, checkbox edit or recovery reroll does
not perform that healing again.

`flags.cypher.shieldTurnLossPending` represents the next turn, not an accumulating
counter. The active GM's forward `updateCombat` handler consumes the flag and
advances past that actual combatant, including a synthetic Actor. Rewinding is
not an automatic replay. Outside combat, the PC sheet explicitly acknowledges
the lost turn. The GM can substitute an intrusion before that turn is consumed;
the system announces the choice, while the GM adjudicates its content and XP.
Without an active GM client, the pending loss remains visible for adjudication.

`inHand` is separate from `equipped`: a thrown shield is unavailable for defense
and another throw until caught or explicitly retrieved. Its `flightId` binds
the catch task to that particular throw. A successful paid reroll catches it
only while that flight still owns its away state. An old catch card cannot
retrieve a newer throw or a completed replacement. Catch rerolls checkpoint the
original card before returning the shield or refunding a natural-20 point cost.
An interrupted completion requires reconciliation and cannot refund again.
Retrieval declares that the
character has reached the shield; no token coordinates establish distance.

These additive shield fields hydrate ordinary existing Items with safe defaults:
`abilityItemId=""`, `inHand=true`, `flightId=""`, and null work deadlines. There
is no world rewrite, schema-version bump, source-description parser or startup
guess. Saved capacities and existing wound counts are preserved.

## Attacks, work and failure boundaries

The Ability control gathers the physical shield, mode, ordered actual NPC
targets, range declaration, melee stat and optional main attack. It collects
the first roll before mutation, then asks fresh choices for additional attacks.
Hidden Shield permits an existing main attack plus its extra shield melee
attack; both receive one hindrance step. Each target's actual Actor is retained.

`shield-attack-service.mjs` adapts the shield to a read-only light attack profile
and delegates to the shared task engine. No duplicate weapon Item is created.
The first Bouncing Shield attack includes its 3 Speed activation cost; later
attacks do not repay activation and have independent Effort/Edge. The task's
recorded cost includes activation, so the initial or a later retained 20 uses
the existing once-only refund contract. Each paid reroll still costs XP.
[Attack rerolls](attack-rerolls.md) reconcile recorded NPC damage and newly
earned structured target effects within their original interval. They do not
replay shield throws, activation costs or additional attacks. Catch and defense
consequences retain their explicit reconciliation contracts; see
[defense rerolls](defense-rerolls.md).

Hidden Shield work starts only for its destroyed designated shield after
confirmation that resources are provided. Unyielding replacement starts only
when the designated shield is away and the resources, skill or outside
arrangements are confirmed. The CRD specifies no fixed resource quantity: no
Resource Points or currency are invented or deducted.

`repairReadyAt` and `replacementReadyAt` store deadlines in game-world seconds:
one day for repair and a rolled 1d6 days for replacement. Completion additionally
confirms that the sustained work happened; merely advancing the clock does not
do the work. Finishing clears the shield wounds and old flight identity, and
leaves it unequipped. Replacement renews the same inventory record. Duplicate
starts/completions and premature completion do nothing.

Ownership, designation, initial targets/range and first costs are checked before
throwing/spending. Local action guards reserve all actual participants. After
the first write, document operations are sequential rather than atomic. Later
cancellation, lost permissions or write failure may preserve earlier attacks,
costs or an away shield. No historical snapshot overwrites intervening changes.
There is no cross-client transaction lock. Failed partial operations require
review of current documents/chat rather than automatic re-execution.

## Validation

Pure tests cover designation-dependent survival, ordered rebounds and special
Effort costs. Service regressions cover damage/recovery, repairs, replacements,
permissions, costs/refunds, catch rerolls, repeated hindrance and turn loss.
Live scenarios exercise actual imported Abilities, the PC sheet's paired attack,
synthetic combat turn loss, reload-safe catch rerolls and elapsed repair work.
Observed on 2026-10-19: `npm test` passed 812 tests in the isolated normalized
checkout, with no failures or skips. The final runtime suite passed 558 tests
with no failures or skips, including the strengthened failed-catch fixtures.
Lint, the typecheck pilot, architecture audit and locale bundle check
passed. The isolated build passed 15 assertions covering all 14 compiled packs,
and the packaged ZIP/manifest matched the tested source snapshot.

Foundry V14.369, system `0.2.0-alpha.1`, Chromium 153.0.8010.12 and the French
interface: all five new live scenarios passed. These exercise source-imported
English Ability Items, actual sheet buttons, synthetic Actor isolation, combat
turn skipping, timed repair, reload persistence and the once-only natural-20
point refund on catch rerolls. The full existing E2E suite,
V13, the English interface, keyboard-only operation and alternate theme/viewport
combinations were not rerun; paired UI locales pass the static locale checks.
