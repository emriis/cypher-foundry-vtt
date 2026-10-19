# Defense rerolls and recorded consequences

## Authority and intended behavior

The supplied CRD (2026-07-29) is consulted in place under the private local
reference library. Relevant passages:

- Advancing Your Character / Spending Experience Points / Rerolling,
  paragraphs 8079–8081: pay 1 XP, keep the better result, and retain the best
  result across repeated rerolls. The example explicitly includes Dodge.
- Rules of the Game / Defending / Armor and Shields, paragraphs 7930–7935:
  successful Block reduces wound severity or transfers the entire wound to
  a chosen shield; a shield's first major wound destroys it.
- Rules of the Game / Rolling the Die / Special Rolls, paragraph 7578:
  the existing natural-20 point-cost exception is independent of damage.

The user's clarification on 2026-10-19 distinguishes replacing a roll's effects
from repeating its action. A reroll does not pay the original Effort again or
refund that expenditure merely because it is a reroll. Each accepted reroll
still costs 1 XP. Damage suffered in a Pool is a consequence, distinct from the
points spent to attempt the action.

The user explicitly retained the CRD natural-20 exception on 2026-10-19: a
retained 20 refunds the recorded original point cost once. It never refunds the
XP spent on any reroll, and another reroll cannot refund that point cost again.

| Retained result | Consequence |
| --- | --- |
| Failure remains failure | Keep the already applied damage; do not add it again. |
| Failed Dodge becomes successful | Remove only the failed defense's recorded damage. |
| Failed ordinary Block becomes successful | Remove the failed defense's contribution, then apply the one-step-reduced wound using current remaining capacities. |
| Failed Block becomes successful with its selected shield still available | Remove the PC contribution, then let that actual shield absorb the original wound. Overflow and destruction remain automatic. |
| Selected shield has since been destroyed, deleted or unequipped | Preserve that later equipment state and use ordinary Block reduction. |
| Defense already succeeded | Retain its consequences; a better die alone does not heal a shield that correctly absorbed a wound. |
| A later reroll uses an older card | Resolve the authoritative original card; never repeat a completed correction. |

## Attribution instead of snapshot restoration

New task messages store `flags.cypher.defenseConsequences`: a versioned record
of the actual PC wound increments by severity, the actual Pool damage when
applicable, and attribution revisions. Costs and any push wound happen before
this record is captured, so they are never confused with incoming damage.

The recorded severity is the tier actually changed after overflow. If an
incoming minor wound filled a major slot, correcting it removes that one major
wound, without resetting minor/moderate counters or discarding later major
wounds. New successful Block consequences use current effective capacities;
base maxima and unrelated wound counts are never restored from a saved Actor.

NPC Pool attacks now apply their damage inside the shared defense pipeline,
before chat publication. The same record therefore includes both lost Pool
points and an overflow wound. A successful reroll restores only those damage
points, preserving unrelated later spending and never crediting the original
Effort cost as damage.

## Ambiguous or interrupted history

`preUpdateActor` delegates to `defense-history.mjs`. Healing/removing wounds
advances the affected severity's revision; Pool recovery advances the relevant
Pool revision. These counters are attribution metadata, not a second wound or
resource store. The revision and the corresponding edit are saved in the same
Actor update. Both dotted service patches and expanded hook deltas are supported.
An attributed correction does not invalidate another defense's contribution.

Later wounds and spending alone do not destroy attribution. Healing an affected
tier, editing away a recorded wound, or recovering the affected Pool can make
subtraction unsafe, even if later damage restores the same numerical total.
Old chat cards also lack the evidence needed to identify their original damage.
In these cases the paid reroll still retains the better die, but the card and a
localized notification explicitly ask the GM to reconcile damage. It never
silently removes a newer wound or restores an old Actor snapshot.

Before changing consequences, the original card stores a `pending` checkpoint.
If a later Actor/Item write fails, already committed costs or consequences may
remain. Another reroll sees that checkpoint and requests reconciliation instead
of subtracting damage again. An uncertain partial correction also prevents
repeating a potentially committed point-cost refund. Final metadata marks a
successful replacement `corrected`; the original remains authoritative even
after reload or when a prior reroll card is clicked.

No existing Actors or messages are migrated or guessed at startup. Missing
revision flags default to zero; new healing edits write revisions as needed.
The free-form Foundry flags add no persisted DataModel fields.

## Permissions and scope

The payer, actual defender, original message and any affected Item retain their
normal permission checks. UUID resolution preserves synthetic token Actors.
The client-local action guard reserves the payer and defender, and nested shield
writes carry the parent's accepted context. This is not a cross-client lock or
an atomic transaction spanning Actor, Item and ChatMessage documents.

This contract covers defense wound damage and supported NPC Pool damage.
Attack damage/effects against NPCs, arbitrary descriptive effects, and special
shield Abilities retain their individual execution boundaries. Changing a die
does not automatically repair a shield already destroyed by a successful Block.

## Validation scope

Focused rule/application tests cover incremental correction, overflow, later
wounds, separate pending defenses, ordinary/shield Blocks, cost retention,
Pool damage, permissions, token statuses and interrupted writes. Real Foundry
scenarios exercise the PC sheet and chat button, authoritative origins after
reload, NPC Pool damage, and one synthetic defender independently of its base
Actor and sibling token.

Observed on 2026-10-19:

- `npm test`: 787 passed, no failures or skips, in an isolated normalized checkout.
- `npm run test:runtime`: 533 passed, no failures or skips.
- Lint, typecheck pilot, architecture audit, locale bundle check, and E2E syntax
  check passed.
- Isolated compilation/readability checks passed for all 14 compendium packs
  (15 build assertions); package verification and system syntax passed.
- Foundry V14.369, system `0.2.0-alpha.1`, French system locale, Chromium
  153.0.8010.12: all five new live scenarios passed in a disposable world.
  This includes real sheet/chat clicks, reloads, synthetic defender isolation,
  healing attribution and the once-only natural-20 refund. The UI setup awaits
  V14 transient chat-card animations before clicking the persistent card.
- V13 and the complete existing E2E suite were not rerun for this change.
