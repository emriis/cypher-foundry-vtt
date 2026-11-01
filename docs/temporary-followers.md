# Temporary followers

This family implements acquired Basic/Improved/Greater/True Necromancy,
Duplicate, and the companion branch of Recompile Machine. It uses actual NPC
documents, including synthetic token Actors. The elected active GM selects
prepared NPC profiles and confirms fictional eligibility and range. The system
does not invent a PC-to-NPC conversion or a universal Health/damage formula.

## Source and adjudications

The supplied 2026-07-29 CRD is authoritative. Reviewed paragraph evidence is
recorded in `data/crd-temporary-followers.json`:

| Source | Contract |
| --- | --- |
| Type Basic Necromancy, paragraphs 1018–1020 | 3 Intellect, level 1, immediate range, same size or smaller, action; destroyed bodies cannot return. |
| Focus Basic Necromancy, 3880–3881 | 3 Intellect, level 1, immediate range, last action; a repaired destroyed body can return. |
| Improved Necromancy, 3889–3890 | Focus Basic gains short range and additional bodies at +1 Intellect each. |
| Greater Necromancy, 3902–3904 | 5 Intellect, level 3, short range, up to twice the owner's size, +2 Intellect per additional body. |
| True Necromancy, 3910–3912 | 8 Intellect, level 5, short range, up to twice the owner's size, +3 Intellect per additional body. |
| Duplicate, 3366–3369 | 2 Might, level 2, short range; dedicated Effort buys additional instances or individual level increases. |
| Recompile Machine, 5068–5073 | 8 Intellect, non-damaging Intellect attack, long range, maximum machine level 4 plus dedicated Effort, last action. |

The two Basic occurrences use canonical CRD identities, never translated names.
The runtime profile preserves the Focus occurrence's last-action timing even
when an older acquired Item carries generic action metadata. Duplicate already
comes from the Genre catalogue during normalization; no duplicate source or
translation is authored here.

User adjudications resolve these source ambiguities:

- Each invocation starts a new profile at the source level plus its paid
  dedicated Effort. Temporary followers inherit no durable tier progression.
- Intact corpses retain damage. The repairable Focus versions restore full
  Health after destruction only when the GM confirms repair. Type Basic cannot
  bypass its destruction restriction through a manually healed old profile.
- Recompile control expires at the owner's ten-hour recovery. There is no
  additional strict 24-hour deadline. The GM declares reboot duration in rounds.

## Activation and lifecycle

The PC sheet offers acquired source choices and GM confirmation controls. NPC
profiles must already have the required level and declared Health/attacks.
Duplicate requires a fresh empty NPC profile for each instance. A single paid
allocation combines activation and dedicated Effort, applies Edge once, and
uses the existing Superheroics allowance. Rejected declarations, permissions,
profiles or resources spend nothing.

Basic without Improved replaces its previous body; Improved, Greater and True
support batches. Necromancy ends on hour-or-longer recovery. Duplicate ends on
ten-minute-or-longer recovery, replacement, death or explicit dismissal. Its
dismissal consumes an extra action on the owner's turn. Recovery revision flags
invalidate the grants in the same Actor update as the completed recovery.

Recompile uses the shared task/paid-reroll pipeline. Its successful attack
starts a reboot; help and independent actions remain unavailable until reboot
completion. Combat completion uses the deadline anchored to the original attack
round. When that combat no longer exists, the GM confirms elapsed rounds.
Retrying an uncertain write never restarts the interval. Expiration releases
the machine as an ordinary NPC without changing its Health.

Temporary help enters the existing follower asset cap and declared
attack/defense/independent modes. Inert corpses, absent duplicates, rebooting
machines and incapacitated followers cannot supply help. No proximity is
inferred from token coordinates.

## Copies, death and attack corrections

Duplicate copies attacks, armor, shields and ordinary equipment; cyphers and
artifacts are excluded. Copies carry their originating instance identity.
Inactive copies grant no attacks, protection or equipment benefits, including
when transferred to another Actor. Read-only derived preparation is refreshed
when their controller's state changes. Acquired later loot remains on the NPC
and available for GM distribution.

Inactive copied Items remain as identifiable records so an attributable attack
correction can restore them safely. Presentation hides them while the duplicate
is absent and removes its token visibility/sight. This is effective disappearance
without deleting the Actor or losing its acquired loot and attack history.

Health reaching zero records an undead death or a duplicate's moderate-wound
backlash. The controller's wound and its attribution receipt share one update,
so a lost response cannot apply the backlash twice. Manual/native damage uses
the same settlement hook; the PC exposes an explicit retry when settlement
could not complete. Administrative Actor deletion does not invent a death.

An attack reroll corrects only the wound contribution attributable to that
death, preserving unrelated later wounds. The dependent controller is reserved
before XP spending. If intervening healing makes attribution ambiguous, the
correction requests manual reconciliation rather than restoring a stale
snapshot or reviving the NPC with an unresolved backlash. Pool costs follow the
existing reroll contract, including the retained natural-20 exception.

## Persistence and boundaries

Versioned optional flags store source identity, NPC UUID, recovery revision,
paid allocation and pending settlement. No persisted schema migration is needed.
Payment and pending records share a PC update before dependent NPC/Item writes.
Partially created batches provide no benefits. Resume finishes acknowledged
work without paying again, duplicating Items or healing intervening damage,
including after reload or source removal.

The GM can abandon a partial invocation without a refund. Its copies become
inactive and another invocation becomes available; no earlier body's stale
state is restored. Unexpected profile or ownership changes require review.
Local guards serialize participating documents on the elected GM client;
they are not distributed locks against arbitrary external edits.

Recompile's bricking and explosion branches remain for the offensive Ability
family. Team-Up Ally and other command/allied powers remain separate work.

## Validation

Focused rules, service, content and DataModel tests cover the two Basic
identities, paid allocations, recovery invalidation, retained damage, repair,
partial writes, resumption/abandonment, copy exclusions, transferred armor,
death attribution and correction. Live scenarios are scoped by
`temporary followers:`. Final observed results are recorded after execution.

### Observed live validation — 2026-11-01

All three scoped scenarios passed together on Foundry **14 build 369**, Chromium
**153.0.8010.12**, system **0.2.0-alpha.1**, in disposable Data:

- Actual EN/FR compendium imports in light/dark themes at a 640 × 700 PC sheet,
  keyboard activation, synthetic corpse Health preservation, reload and recovery
  expiration.
- Duplicate equipment exclusions and acquired loot; copied armor transferred to
  another PC; death backlash, reload and a paid attack correction restoring only
  the attributable wound and the copied protection; recovery disappearance.
- Failed recompilation followed by a retained natural-20 paid reroll, the cost
  refund exception, no machine damage, explicit reboot completion, continued
  control beyond 24 hours and release at ten-hour recovery.

All 15 compiled-pack readability checks and packaged-tree verification passed.
No V13 live result is claimed and compatibility metadata remains unchanged.

The final isolated `npm test` passed **1,222 tests** across 32 suites, with no
failures or skips. The 24 focused rule/service/content/DataModel tests passed.
Lint, the existing type-checking pilot, architecture, locale consistency and
system/E2E syntax checks passed. The authoring checkout changes runtime rules,
services, sheet controls, source evidence/audit coverage, tests and documentation,
plus paired locale sources and their intentionally compiled native bundles.
Compendium sources, generated pack databases, distribution artifacts and the
system manifest remain unchanged.
