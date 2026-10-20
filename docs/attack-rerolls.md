# Attack rerolls

## Source and accepted result

Authority: supplied CRD `Cypher-Reference-Document-2026-07-29.docx`, Rules of
the Game / Rolling the Die / Special Rolls, paragraphs 7572–7578; Experience
Points / Rerolling, paragraphs 8079–8081. The private reference stays in
`docs/local/`.

Each paid reroll spends 1 XP and retains the best die across the entire chain.
It replaces the roll's consequences without repeating the attack, Effort,
activation, ammunition expenditure or other initial costs. A retained natural
20 refunds the original recorded Pool cost once; reroll XP remains spent.

An improved successful damaging 19/20 offers the same damage/effect chooser as
the original attack. Closing that post-roll dialog accepts extra damage. A
lower or equal reroll retains the existing choice without prompting again.
Because the best die can replace extra damage with an effect, target damage
can decrease as well as increase. Narrative minor/major effects remain GM
adjudication; a localized message identifies new or replaced narrative effects.

## Target contribution and persistence

New targeted attacks, including misses, store a versioned
`flags.cypher.attackConsequences` record on their chat card. It contains the
actual target UUID, original Armor and bypass, post-Armor potential damage,
bands of damage that actually reduced Health, the target's healing revision,
and the original structured-effect interval. No weapon or selected target is
looked up again to reconstruct those original choices.

An improved result changes current Health only by the difference attributable
to that attack. Damage bands distinguish capped Health loss from overkill. For
example, a six-point hit against five remaining Health records five applied
points. If a major effect replaces its two-point bonus, the new four-point hit
restores only one Health. Unapplied overkill is never refunded as base damage.
Later unrelated damage is preserved rather than restoring an old Actor snapshot.

The original chat card is authoritative for every subsequent card, including
older reroll cards and cards loaded after a restart. UUID resolution preserves
unlinked token Actors; neither the world Actor nor another token can substitute
for the original target. Missing or unowned recorded targets reject before XP.

## Structured effects retain their original interval

An originally failed attack that becomes successful can apply its recorded
structured target effects once. An already successful attack never refreshes
them merely because its die improves. Round effects retain the original combat
and application round; the existing round-duration policy is unchanged.

Completed NPC actions, including a skipped action caused by `loseNextAction`,
advance `flags.cypher.weaponActionRevision` in the same update as effect
consumption. A missed attack rerolled after that boundary cannot revive a
next-action effect or an expired narrative-round effect. Rejected defenses do
not consume that NPC action interval. These free-form flags are attribution
metadata, not a new resource store or DataModel schema.

## Ambiguity and partial writes

`preUpdateActor` records a healing revision with NPC Health increases, modifying
the same update delta as supported by the official
[V13 hook contract](https://foundryvtt.com/api/v13/functions/hookEvents.preUpdateDocument.html)
and [V14 hook contract](https://foundryvtt.com/api/v14/functions/hookEvents.preUpdateDocument.html). Known
attack corrections preserve other attacks' attribution. If intervening healing
or a manual Health restoration makes a damage change uncertain, the better die
is retained and a localized warning asks the GM to reconcile consequences.
Legacy cards without attribution follow the same policy; target Actor IDs alone
are insufficient to reconstruct synthetic target ownership.

The original card persists a `pending` checkpoint before any target correction
or natural-20 refund. If a later write fails, a future reroll does not repeat an
uncertain correction or refund. Already committed XP and document writes remain;
the GM reconciles that partial action. No stale snapshot rollback is attempted.
Targetless attacks use an `attackRefundPending` checkpoint for their refund,
without creating a target damage ledger.

The client-local guard reserves the payer, source and original target. This is
not a distributed lock across clients or a database transaction. Arbitrary
manually applied effects and other Ability-specific consequences remain under
their own adjudication contracts.

## Validation

Pure and application regressions cover damage bands, overkill, frozen Armor,
special choices, later damage, healing, target permissions, serialized origins,
expired effects and partial writes. Dedicated live scenarios cover chat buttons,
the real special-effect chooser, synthetic targets, reload persistence,
one-time refunds and NPC action/healing boundaries. Report observed Foundry
results separately from deterministic tests.
