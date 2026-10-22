# Round execution

Authority: supplied CRD, **Actions**, **First Actions**, **Last Actions**,
**Waiting to Act**, **Readying an Action**, **Extra Actions** (paragraphs
7645–7693 in the local DOCX). Paragraph 7647 defines a one-round effect's
source-turn boundary; 7663 permits immediate movement with a heavy Last attack
at one hindered step. No timing or trigger is inferred from prose or coordinates.

## Execution and declarations

The GM opens **Round sequence** in the combat tracker and plans the first or
next round. Each special timing is an explicit GM declaration of eligibility.
Choices made during an ongoing round apply to the next round. Slots execute as:

1. First actions, in initiative order, with no separate minor activity.
2. Ordinary actions, in initiative order, with one optional minor nonattack activity.
3. First users' Follow-up minor nonattack activities, in initiative order.
4. Last actions, in initiative order, with no separate activity.

The original Combatant initiative scores and base sorted order remain intact.
A new round defaults to ordinary initiative order unless another declaration
applies. First-capable actions can instead be ordinary actions. Heavy attacks
require Last timing; the attack dialog's explicit immediate-movement choice
adds one hindered step. Granted extra attacks from supported multi-attack
services retain their independent Effort costs, including during Last timing.

An unspent ordinary turn can wait. A conditional wait stores its declared
trigger; the GM explicitly confirms that event and the feasibility of acting
just before it. Resuming inserts one slot before the current event. Unused waits
expire with the round. A preparation slot permits no ordinary action or minor
activity; completing it grants optional First timing for the following round
only. Defenses remain available. This does not create a banked extra action.

## State and resource boundaries

`flags.cypher.roundFlow` on Combat records the versioned queue, current slot,
plans, waiting entries, preparation and completed-round history. The core `turn`
points to the actual Combatant for that slot. Follow-up may therefore revisit a
Combatant without becoming another primary turn.

`flags.cypher.roundActionUsage` belongs to the actual Actor, including an
unlinked token Actor. Players can record usage without ownership of the GM's
Combat. Accepted tasks record usage after cost/prerequisite validation and
before costs or dice. A cancelled or rejected task consumes no action. Defenses,
initiative and shield-return continuation do not consume a new action. Paid
rerolls reconcile the original action and do not reopen its slot or refund its
cost, except for the existing retained natural-20 rule.

Cooperation declarations, starting guard, Rally, action-length recovery and NPC
attacks also consume their action. Longer recovery calls declare a completed
rest rather than an extra combat action. Descriptive actions and unsupported
item/Ability powers still require adjudication; the panel can record an action
without a roll. An explicitly minor nonattack task is available in roll options.

Rewinding changes presentation only. Next first returns to the saved present;
it does not rebuild an already-played round. Completed slots cannot be replayed and
costs, injuries and expiration counters are not restored. Local document
reservations are not distributed locks across multiple clients. Failures after
usage persistence retain the used action rather than restoring stale state.
Shield-loss skips record a cleanup checkpoint so a failed Actor flag-clear can
be retried before progression rather than consuming another turn.

## Effects and unavailable turns

Only primary turn entry increments `flags.cypher.turnRevisions`. Follow-up,
waiting resumption, initiative reordering and rewinds do not increment it again.
Stunned or unconscious combatants and pending Unyielding Shield turn losses
skip their applicable slots. Conditions expiring at the new primary boundary
are evaluated before deciding whether that turn is lost. Paralysis does not
skip all actions because explicitly motionless actions may remain legal.

New source-attributed round weapon effects retain the source Combatant and
application revision, including in paid-reroll history. They survive a round
change until the source's next primary turn; Stunstick's explicit GM extension
uses two source turns. Legacy effects lacking source attribution retain their
existing round-number contract; no historical source is invented.
Overlapping source-bound hindrances retain their independent intervals in
storage while exposing only the accepted nonstacking benefit. An earlier
source's turn therefore cannot erase another source's still-active contribution,
even when waiting or declarations change their future order.

Native index-based turn events are suppressed for queue movement because an
index can move backward or revisit a Combatant during Follow-up. Cypher's own
source clocks own these intervals. Third-party modules that assume core index
progression need their own integration; this is not a general replacement for
their ActiveEffect lifecycle.

The focused tests are `round-flow.test.mjs`, `combat-flow.test.mjs`, task/weapon
effect regression tests, and `foundry-round-flow.spec.mjs`. Report Node checks,
isolated builds and observed Foundry versions separately.
