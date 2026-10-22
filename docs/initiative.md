# Initiative

Authority: supplied CRD `Cypher-Reference-Document-2026-07-29.docx`, Rules of
the Game / Actions and Initiative, paragraphs 7641–7651. The private reference
remains in `docs/local/`.

The standard Foundry combat tracker delegates initiative rolls to
`CypherCombat`. A PC makes a Speed task with the usual pre-roll skill, Effort,
assets and declared circumstance choices. Net easing adds three points per step;
net hindrance subtracts three. Scores are not clamped at zero or twenty. Wounds,
unfamiliar armor and active task modifiers follow the shared Speed pipeline.
The natural twenty point-cost exception remains active. NPCs use level times
three with no dice or Effort. A PC tied with an NPC acts first. Remaining ties
use stable combatant IDs; the CRD permits players to agree on their relative
order, which the GM can adjust through normal tracker initiative editing.

The tracker uses an initiative-specific dialog and card, without a success
threshold or a routine-success choice. An initiative always rolls a die. Cancel
before rolling to leave that PC's resources and score untouched. Batch tracker
actions process owned combatants sequentially; a cancellation skips that PC,
and a later write failure preserves earlier completed combatants. Formula
overrides other than the CRD d20 are unsupported. NPC grouping remains an
explicit GM adjustment rather than inferring groups from names or token positions.

Scores and a unique roll identity persist on the actual Combatant. New PC chat
cards retain the encounter UUID, combatant ID, original net steps and that roll
identity. Paid rerolls use the best natural die with those frozen steps; they
update only that original combatant. A new initiative roll, manual score edit,
missing encounter or revoked permission rejects a stale card before spending XP.
Synthetic Actors remain token-specific; world Actor IDs are never substituted.

Every paid reroll still spends one XP. Original Effort is neither spent again
nor refunded merely because of a reroll. A newly retained twenty refunds its
recorded original Pool cost once. A pending original-card checkpoint precedes
score correction or refund, so retrying an uncertain partial completion cannot
repeat those writes. Such a reroll retains the best die and explicitly asks the
GM to reconcile tracker state and costs. The original chat card remains
authoritative after reload and when a prior reroll card is clicked.

Combatant score/identity writes use one embedded-document update with turn
events disabled. Core maintains the active combatant across reordering. Cypher's
shield turn-loss hook ignores this context: editing initiative does not consume
a pending lost turn. Scores retain their normal order across round boundaries.
`updateTurn: false` preserves core's explicit alternative of keeping the turn
index instead. These APIs are described in the official
[V13 Combat contract](https://foundryvtt.com/api/v13/classes/foundry.documents.Combat.html)
and [V14 Combat contract](https://foundryvtt.com/api/v14/classes/foundry.documents.Combat.html).

Client-local guards reserve the encounter and actual Actors. This is not a
distributed transaction across clients; failures propagate without restoring
stale snapshots. No persisted DataModel schema or world migration is introduced.

First/Last and Follow-up scheduling, waiting, readiness and source-turn intervals
are documented in [round-flow.md](round-flow.md). Grouped NPC adjudication
remains explicit GM input. Owning an Ability
does not automatically grant initiative training without its own supported
structured contract.

Deterministic tests cover unclamped scores, NPCs, PC ties, cancellation, costs,
permissions, stale rolls, partial writes and repeated rerolls. Live checks cover
tracker controls, a real pre-roll dialog, synthetic identity, active-turn
preservation, natural-twenty refunds and reload persistence. Report live
versions separately from deterministic results.
