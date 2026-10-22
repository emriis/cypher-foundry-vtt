# Intrusions

## Rule authority

Source: supplied CRD, 2026-07-29, **GM Intrusions**, **Player Intrusions**,
**Reacting to a GM Intrusion**, and **Experience Points** (paragraphs 7399–7402,
7412–7414, 7422, 7995, and 8116 in the private reference extraction).

A GM intrusion awards 2 XP to the affected player, who immediately gives 1 XP
to another player. It cannot be refused. A retained natural 1 permits a free
GM intrusion with no XP award. Player intrusions require GM agreement and cost
1 XP only after acceptance; rejection costs nothing. Neither ordinary player
intrusions nor reactions consume an action.

The project's explicit adjudication of the reaction timing is the character's
next primary turn, without consuming its action. Follow-up turns and rewinding
the tracker do not open a reaction window. Both submission and acceptance check
that window. Narrative changes remain GM adjudication; text is never parsed
into healing, damage, or arbitrary document updates.
Outside a started tracked combat, ordinary player requests remain available;
reaction timing is adjudicated narratively rather than inventing a turn counter.

## Interface and decisions

The PC sheet offers player requests and a GM declaration control. A retained
natural-one task card offers the GM a free declaration control. Shared chat
cards retain the description, decision, source Actor UUID, and reaction deadline.
An accepted or rejected request cannot be decided again. An intrusion on a
canonical task card is reused when requested through its reroll card.

For a paid declaration, the affected player chooses another user and that
user's assigned PC. Offline players are eligible. The chosen user must own the
recipient PC; both the user and actual Actor must differ from the source.
There is no refusal button for a GM intrusion.
The affected player is inferred from character assignment or a unique player
owner. For ambiguous shared ownership, assign that PC to its affected player
or pass `sourcePlayerId` explicitly to `game.cypher.intrusions.createGMIntrusion`.

After the choice, the system applies the mandatory award and immediate transfer
as net **+1 XP to each PC**. Until a recipient is chosen, the award remains
pending rather than making the unshared XP spendable. A GM may select on the
player's behalf. Assign a character to another player if no recipient is listed.

## Persistence and recovery

The elected active GM is the sole settlement authority. Other clients submit
chat requests without needing permission to edit the recipient. Pending share
choices are settled automatically on creation and on readiness or user
connection; pending player intrusions always require explicit acceptance.

Settlement checkpoints the decision and freezes its recipient before XP writes.
Each contribution writes current XP and an intrusion receipt together in one
Actor update. A retry skips committed receipts, preserving unrelated intervening
XP changes. A conflicting later choice cannot redirect a frozen award and is
marked superseded. Actor UUID resolution preserves synthetic Actors.

A failed write leaves a resumable card. The active GM can use **Resume
settlement**; already authorized shares also retry after reload. This is a
resumable sequence across Actors, not a database transaction across documents.
Keep its chat cards and Actor receipts until resolved. Manually deleting or
altering that history requires GM reconciliation. Concurrent XP edits from
unrelated clients are outside the local action guard's guarantees.

## Validation boundaries

Pure tests cover XP plans and exact reaction windows. Application tests cover
permissions, decisions, duplicate requests, partial writes, lost acknowledgements,
recipient freezing, synthetic Actors, and recovery without snapshot rollback.
Disposable Foundry scenarios exercise real chat controls, two-client permissions,
reload persistence, natural-one declarations, and reaction timing.

Observed on 2026-10-22:

- The complete isolated Node suite passed 972 tests. After the final secondary-PC
  ownership guard, all 19 focused intrusion/character contracts passed.
- All five scoped live scenarios passed across the focused runs on Foundry
  14.369 with Chromium 153.0.8010.12, including EN/FR and light/dark controls.
  The final secondary-PC ownership guard is covered by application tests.
- Temporary compendium compilation passed all 15 pack-readability contracts;
  package verification passed. Lint, pilot type checking, architecture,
  locale consistency, and runtime/E2E syntax checks passed.
