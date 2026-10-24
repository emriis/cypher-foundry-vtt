# Environmental hazards

## Authority and adjudication

The sole rule source is the supplied CRD, **2026-07-29**, **Special Damage**
(paragraphs 7815–7823 in the private reference extraction), together with the
ordinary wound, Pool-damage, defense, and paid-reroll rules. That reference
does not provide a general falling, fire, cold, drowning, or suffocation damage
table. Those names never determine numbers, a defense stat, or an interval.

The approved implementation therefore executes **explicit GM declarations**.
The GM supplies consequences and, when applicable, a defense stat and difficulty.
The workflow targets PCs, including unlinked-token synthetic Actors. NPC Health
continues to use the existing explicit NPC damage controls.

## Play workflow

The PC sheet's environmental panel offers the elected active GM a declaration
dialog. Saving creates a ready exposure without damage, dice, resource spending,
or combat-action consumption. Other users can read the saved danger; the active
GM triggers its occurrences. Players retain the normal ability to pay for a
reroll of their own environmental-defense card.

Choose one resolution mode:

- **Immediate:** apply the declared consequences without a defense, Effort cost,
  or reroll. This is appropriate only when the GM adjudicates the damage as
  unavoidable. Its chat card records the actual wound/Pool contribution.
- **Defense:** choose Might, Speed, or Intellect and an explicit difficulty.
  The usual task dialog collects applicable Effort, skill, and modifier choices.
  A failed defense applies the declared wounds, Pool loss, and conditions.

A profile can combine wounds, Pool damage, and conditions. Pool depletion and
wound overflow use the existing damage pipeline. Conditions remain separate
general effects until explicitly ended; ending exposure does not heal damage
or remove those conditions. A defense requiring no physical movement must be
explicitly marked so the normal paralysis restrictions remain meaningful.

There are no automatic Armor, shield, Item-name, Ability, token-distance, or
height deductions. Applicable protection requires an explicitly named source.
The GM may reduce each **declared** wound by severity steps, reduce the declared
Pool hit by points, or declare immunity to all consequences in this profile.
Pool overflow follows the ordinary damage rules after the Pool-hit reduction.
Complete protection avoids rolling and spending defense resources. Protection
is part of the saved declaration: end and replace the profile if its applicability
changes. These controls do not activate equipment or Ability mechanics.

## Repeated exposure

An interval of zero in the interface means a single occurrence. Otherwise the
GM declares a positive interval in **game seconds**. The first occurrence is
available immediately; each completed occurrence schedules the next from the
current game time. A later occurrence requires either enough advanced game
time or explicit confirmation that its interval passed in the fiction.

Nothing rolls dice unattended, measures wall-clock time, or applies a burst of
missed occurrences. Each activation resolves one occurrence. The saved sequence
number rejects stale buttons after a completed activation or reload. Ending a
profile prevents future occurrences and preserves its history.

## Persistence, errors, and rerolls

Records live in versioned `flags.cypher.environmentalExposures` on the actual
Actor UUID. Missing flags mean no exposures; no Actor/Item schema migration or
source-pack rewrite is needed. The Actor facade provides
`declareEnvironmentalExposure(profile)`,
`resolveEnvironmentalExposure(id, {expectedSequence, ...rollChoices})`, and
`endEnvironmentalExposure(id)`.

After read-only profile, permission, and resource validation, application saves
a processing checkpoint before the first cost, die, or damage write. A local
guard prevents overlapping Actor actions; the active GM owns hazard application.
This is not a cross-client database lock, including across simultaneous tabs of
the same GM. Saved readiness and sequence checks prevent ordinary replay, not
arbitrary concurrent edits to Actor flags.

If a write or chat publication fails, some costs or consequences may already
be committed. The profile remains processing/manual and cannot automatically
apply again. The GM reconciles the sheet and chat, explicitly confirms that
reconciliation when ending the interrupted profile, then declares a replacement
if needed. No stale snapshot rollback overwrites unrelated state. Ending an
interrupted profile through the API requires `{reconciled: true}`.

Defense chat metadata records the exposure identity, sequence, and name alongside
the shared task engine's actual consequence attribution. Paid rerolls correct
those contributions through the existing defense history, preserving unrelated
later damage and original Effort costs. A retained natural 20 keeps the CRD cost
refund exception; the reroll's XP remain spent. Intervening healing or an
interrupted correction follows the existing explicit GM-reconciliation limits.
A successful reroll does not reset the environmental exposure clock or restart
an already completed occurrence.

## Verification scope

Pure tests cover explicit profile validation, declared protection, and occurrence
readiness. Application tests cover permissions, resource rejection, cancellation,
synthetic Actors, stale/repeated activation, partial failures, paid rerolls,
later damage, and the natural-20 refund. Scoped disposable Foundry scenarios
exercise EN/FR controls in both themes, saved synthetic defenses after reload,
game-time repetition, protection, and ending exposure. See the task's validation
report for observed results rather than treating scenario definitions as proof.

Observed on 2026-10-24:

- The complete normalized, isolated Node suite passed **989 tests**, with no
  failures or skips, including 16 focused environmental rule/application/UI
  contracts.
- All **three scoped Foundry scenarios** passed on Foundry **14.369.0** with
  Chromium **153.0.8010.12**. They exercised EN/FR in light/dark themes at a
  640-by-700 PC sheet size, keyboard controls, cancellation, actual synthetic
  Actor persistence, paid rerolls after reload, protection, elapsed game time,
  stale activation rejection, and ending exposure.
- Temporary compendium compilation passed all 15 readability contracts and
  package verification passed. Lint, pilot type checking, architecture, locale
  consistency, and runtime/E2E syntax checks passed.

These are scoped live results on Foundry 14; they do not expand the manifest's
verified compatibility or claim an execution of the entire E2E suite.
