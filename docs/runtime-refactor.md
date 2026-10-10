# Runtime contracts and safe refactoring

The supplied CRD is the sole authority for game rules and all compendium
content. Code, tests, generated packs, translations, and other books cannot
establish alternative content or mechanics. Record the version and section
before changing behavior. Consult private references in place; do not publish
the reference files or copy them into build artifacts.

## Source grounding

This refactor consulted `Cypher-Reference-Document-2026-07-29.docx` in the
private local reference library:

| Contract | CRD locator |
| --- | --- |
| Paid rerolls, retaining the better result, repeated rerolls | Spending Experience Points > Rerolling |
| XP cost and attack hindrance | Spending Experience Points > Lucky Shot |
| Inclusive depletion range and final use | Artifacts > Depletion |
| Natural 19/20 choices and natural 20 point-cost refund | Special Rolls |

These are source locators, not a substitute for reading the CRD. Numeric table
positions do not establish which outcome a player prefers: unordered table
rerolls offer a choice. Depletion compares usable/depleted consequences;
task and recovery rolls retain the higher value.

## Reading the runtime

Start with the public Actor facade, follow its application service, then read
the pure calculation it calls. The facade preserves existing macro entrypoints.

| Module | Responsibility |
| --- | --- |
| `module/applications/task-service.mjs` | Orchestrate preparation, costs, dice, consequences, and chat |
| `task-preparation.mjs` | Validate current Actor state and compute a read-only task plan |
| `task-consequences.mjs` | Await target damage, effects, wounds, and shield writes |
| `task-message.mjs` | Render localized task presentation |
| `module/rules/task-outcome.mjs` | Resolve success, explicit special-effect choices, and damage |
| `module/rules/rerolls.mjs` | Validate stored metadata and select the retained outcome |
| `module/applications/reroll-service.mjs` | Charge XP, evaluate the original formula, and persist retained metadata |
| `module/applications/action-guard.mjs` | Reject overlapping requests in the same local Actor/action category |
| `module/sheets/dialogs.mjs` | Collect roll, weapon, and target choices without document writes |

Relative module names in this table share the preceding directory. Rules have
no Foundry globals. Services own mutations. Dialogs return input or cancellation;
token choices retain the actual synthetic Actor rather than substituting its
world Actor. Follow [the comment guide](code-comments.md) for public contracts,
units, important phases, side effects, and surprising behavior.

Dialogs explicitly use `rejectClose: false` so dismissal resolves to cancellation,
as documented by the [Foundry DialogV2 API](https://foundryvtt.com/api/classes/foundry.applications.api.DialogV2.html#prompt).

## Costs, permissions, and failures

Validate the acting Actor, target permissions, stat, and resources before
spending XP or Pool points. An accepted task commits its XP and Pool costs in
one Actor update. A task rejected during preparation, or a cancelled pre-action
dialog, spends nothing. Target writes complete before the task publishes success chat.

Foundry does not provide a transaction spanning several Actor/Item documents.
If a later write fails, the service throws and releases its guard; already
committed costs or consequences may remain. Do not restore stale snapshots
over another client's changes. A GM must reconcile partial state. Local guards
prevent overlapping requests only within the same client, Actor instance, and
action category. They are not distributed locks and do not serialize unrelated
action categories.

Foundry permission checks are platform constraints, not new game rules.
When a player cannot update a target, a GM must resolve the action. The runtime
does not invent a privileged socket or bypass document ownership.

## Reroll persistence and limits

Each accepted reroll costs 1 XP. Both the original card and the new card retain
the current best result, so repeated clicks and later reloads compare against
that result. Metadata records the formula and relevant context; malformed or
unsupported metadata is rejected before XP is spent. Legacy depletion cards
with an upper threshold retain their original 1..threshold interpretation.

A retained natural 20 refunds a recorded task Effort cost only once. XP spent
on rerolls remains spent. Depletion rerolls update the Item's depleted state.
Recovery rerolls retain the recovery value without consuming another interval
or replaying wound healing. Table rerolls do not consume another Cypher; closing
a post-roll result choice keeps the old result and still costs the accepted XP.

Task rerolls report the retained result but do not replay or reverse previously
applied damage, wounds, shield changes, weapon effects, or Ability activation
costs. Those consequences require GM reconciliation. Older cards lacking cost
metadata cannot automatically refund an unrecorded cost. The chat UI currently
offers rerolls through the owning Actor; it does not implement selecting another
PC to pay for someone else's roll. A service call can use another payer only
when its document writes are permitted. These limits must stay explicit when
adding future automation.

## Source normalization

`scripts/migrate-ability-sources.mjs` remains the public CLI. Its Node-only
helpers now live under `scripts/source-migration/`: context and source paths,
identity/provenance, parent normalization, cleanup, and the bilingual registry.
Persisted world migrations remain separate under `module/migrations/`.

The extraction preserved IDs, hashes, pairing, ordering, and output text.
An isolated before/after comparison found the same 2,771 normalized JSON files
with identical SHA-256 hashes. No compendium content was authored by this
refactor. A permanent isolated test verifies normalization idempotence.

## BDD and TDD maintenance

1. Locate the CRD contract and describe observable Given/When/Then behavior.
2. Add a deterministic regression at the lowest useful layer. Demonstrate RED
   for the intended defect, then implement GREEN.
3. Refactor with those tests green. For a behavior-preserving extraction,
   establish passing characterization tests before moving code.
4. Cover rejection, permissions, cancellation, repeated activation, persisted
   state, and meaningful partial failures when the action touches documents.
5. Use real Foundry scenarios for UI/runtime boundaries; deterministic dice
   inputs must preserve Foundry's actual formulas and Roll implementation.
6. Run static checks and `npm test`; normalization/builds/E2E belong in owned
   temporary checkouts. Inspect final Git scope for generated artifacts.

Behavior tests cover Lucky Shot cost rejection, combined costs, forbidden
targets, failed target writes, overlapping requests, repeated rerolls, retained
depletion outcomes, recovery formulas, one-time refunds, and table choice.
Dialog tests cover cancellation and synthetic Actor identity. Live scenarios
verify sheet rejection, repeated original-card rerolls, and persisted depletion
restoration. Architecture checks parse imports and re-exports, ignoring comment
and string text that merely resembles an import.

`npm run typecheck` checks the explicit pure-module scope in
`jsconfig.rules.json`: weapon Ability resolution, task costs, task outcomes,
and reroll selection. Expand it using precise JSDoc contracts rather than broad
`any` declarations. This does not claim complete Foundry runtime typing.
