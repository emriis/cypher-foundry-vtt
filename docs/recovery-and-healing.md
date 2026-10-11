# Recoveries and wound healing

The supplied **2026-07-29 CRD** is the sole rule authority. Source sections:
**Rules of the Game > Recoveries**, **Healing Wounds > Rallying / Treatment /
Rest**, **Superheroes > Wound Rallying / Healing power shifts**, **Machine Not
Flesh**, **Untamed Recovery**, **Mind Surge**, and **Healing Hand** in Cleric and
Tends to the Wounded. The private reference stays in `docs/local/`; it is not a
runtime or CI dependency.

## Completed recoveries

The four ordinary recoveries can be taken in **any order**. Their booleans retain
the existing world-data contract: `true` means that allowance has been used.
Completed ten-hour rest begins a new day and makes all four available again.
Sheet checkboxes remain editable for explicit table corrections; checking a box
alone grants no Pool points, wound removal, effect expiration, or counter reset.

The sheet asks the player to confirm the entire rest finished. It does not infer
elapsed time or interrupted-rest completion from the combat/world clock. The API
`actor.rollRecovery(interval, options)` likewise denotes a completed rest.

1. Validate ownership, interval, selected source and its current availability.
2. Roll `1d6 + tier + recoveryBonus`, adding two for an explicitly selected
   one-action **Last action** recovery.
3. Let the player divide points among Might, Speed and Intellect, up to effective
   Pool maxima. Validate integer amounts, total points and source restrictions
   again after the dialog. Cancellation or invalid allocation changes no state.
4. Commit Pool points, selected wound benefits and allowance/counter updates
   together; then expire declared effects and synchronize token wound statuses.
5. If chosen at ten hours, execute the difficulty-six Might task to remove one
   major wound. Recovered Might can fund this task's Effort. Failure retains the
   ordinary rest benefits and consumption.

Existing macros without an allocation callback use the same default proposed by
the editable dialog: fill Might, then Speed, then Intellect. They can instead
supply an `allocation` object or an async `allocate` callback. Unassigned points
are unused. Custom stat
Pools are not inferred as CRD recovery recipients.

Ten minutes removes all minor wounds. One hour lets the player choose one
moderate wound or all minor wounds. Ten hours removes all moderate wounds; the
player can instead retain one moderate wound to remove all minor wounds.
**Accepted user adjudication:** this minor-wound option also works with zero
moderate wounds. The optional major-wound task is independent of that choice.

## Extra allowances and saved data

The service explicitly supports these source contracts through stable mechanical
keys, never localized names or description parsing:

| Source | Extra allowance | Restriction |
| --- | --- | --- |
| Healing power shifts | One one-action recovery per shift | Superhero/custom power-shift state |
| Untamed Recovery | One one-action recovery each day | One allowance shared by duplicate copies of this rule |
| Mind Surge | One one-action recovery each day | Intellect Pool only |
| Machine Not Flesh | One one-action recovery each day | Explicit suitable-power confirmation |

Machine Not Flesh also loses its ordinary one-action allowance after an unpowered
ten-hour rest until a suitable supply is confirmed. Each extra source uses an
optional `flags.cypher.additionalRecoveriesUsed` counter. Ten-hour completion
resets existing counters explicitly to zero: Foundry recursively merges nested
objects, so writing `{}` would retain spent allowances.

Old Actor/Item schemas and recovery booleans are unchanged. Missing flags mean no
extra uses have been consumed and no Healing Hand escalation has been recorded.
No world migration, manifest compatibility expansion, or compendium-source
rewrite is required. Unrelated flags outside the owned recovery/healing maps
remain untouched.

## Rally, treatment and Healing Hand

Rally removes one existing minor/moderate wound for two/five Might, without Edge.
Superhero PCs can also rally one major wound for ten Might. Ownership, an existing
wound and sufficient Might are validated before the combined Actor update.

Treatment uses an Intellect task and removes one wound on success. Base
difficulties are 0/3/6 for minor/moderate/major wounds. The player/MJ selects the
CRD treatment-time profile and confirms both participants completed that time.
Healing training, Effort and assets use the common task engine; treatment itself
does not spend Might. Machine Not Flesh instead uses Engineering difficulties
1/3/5. Suggested times are presented rather than inferred from a translated Type
or subgenre name. NPC numeric Health treatment is not invented from the PC table.

The **Healing Hand** card reduces one PC wound by one severity step; a minor
wound disappears. A full lower-severity track rejects the action without cost.
The Cleric NPC callout restores five Health, capped at its maximum. Contact and
target eligibility require explicit confirmation. The base Intellect cost starts
at one, increases by one after each use, and resets after any actual recovery.
Effective Intellect Edge reduces the paid cost once. The card shows the next paid
cost. Healing Hand does not charge a separate generic Ability activation cost.

Actual target Actors are retained, including unlinked tokens. Local guards cover
the healer and target. Self-healing combines cost, counter and wounds in one
Actor update. Different Actor writes are sequential: if a later write fails,
earlier writes remain committed and the error propagates without a stale refund.
Chat is published after consequence persistence.

## Paid rerolls

A recovery reroll grants only the positive increase over the previously retained
result. It does not replay wound healing, recovery consumption or day reset. The
new points retain the original source's Pool restrictions. Dismissing a post-roll
allocation retains the old result; the already accepted reroll still costs XP,
matching the existing post-roll-choice contract. Legacy chat cards without
`recoveryApplied` retain their former informational behavior.

Treatment and long-rest major-wound tasks store their actual target UUID,
severity and applied outcome. A failed task turned into a success by a paid reroll
removes one wound; another reroll cannot remove another. Token UUID resolution
preserves the synthetic Actor for both healing and recovered Pool points.

New reroll cards retain `rerollOriginId` and read the current result from that
original ChatMessage. Clicking an older failed/low-result card therefore cannot
replay healing, Pool points or cost refunds already applied by a newer card.
Deleting the original disables further rerolls in that chain without spending XP.

## Maintenance and boundaries

Pure rules live in `recovery.mjs`, `recovery-points.mjs`, `recovery-sources.mjs`
and `healing.mjs`. Application services own validation, flags, costs and
persistence; `wound-removal.mjs` shares the task/reroll consequence boundary.
`healing-dialogs.mjs` collects read-only choices through official
[V13 DialogV2](https://foundryvtt.com/api/v13/classes/foundry.applications.api.DialogV2.html)
and [V14 DialogV2](https://foundryvtt.com/api/classes/foundry.applications.api.DialogV2.html)
APIs. `cypher.mjs` only wires chat interactions to those entrypoints.

Regression tests must assert rejected actions, independent allowance consumption,
allocation limits, real Foundry flag merging, day reset, synthetic targets,
escalation/Edge, task failure, successful paid rerolls and prevention of duplicate
consequences. Live tests exercise actual sheet dialogs, keyboard submission,
persisted fields and the compiled CRD Ability cards. Passing current tests alone
does not certify unimplemented source clauses.

Other powers, including Greater Healing Hand, Prepared Medic, Wilderness
Encouragement, source-specific fixed Pool bonuses and other exceptional healing
effects, require separate source contracts. This work does not claim the entire
compendium healing catalogue executes automatically. No turn/action economy or
automatic treatment timer is introduced. Local guards are not cross-client locks.

## Validation observed on 2026-10-11

- **Unit/content/integration/BDD:** isolated `npm test` passed **575/575** tests.
  Focused RED cases reproduced used-recovery healing, missing Pool allocation,
  day reset, loose confirmation, flag merging and old-chat-card replay before
  the corresponding corrections. The final focused application/BDD set passed
  53 tests.
- **Static checks:** lint, the explicit type-checking pilot, architecture
  dependencies, system syntax (79 `.mjs` files) and E2E syntax passed.
- **Build/package:** all 14 EN/FR packs and the system archive built in disposable
  checkouts. Authoring sources and generated outputs in this checkout were not
  rewritten.
- **Live Foundry:** the complete **36/36** E2E suite passed on **V14.368**, system
  **0.2.0-alpha.1**, Chromium **153.0.8010.12**. It exercises persisted recovery
  choices, extra-allowance reset, treatment, Healing Hand, superhero major Rally,
  and recovery/treatment rerolls from older cards. The recovery scenario was then
  rerun successfully after adding chat-button allocation assertions.
- **Rendered UI:** recovery/healing dialogs were exercised in English and French
  with light/dark application preferences and a 640-pixel sheet in a 1024 × 768
  viewport. Keyboard submission, dismissal without cost, translated labels and
  dialog overflow checks passed. Recovery allocation screenshots were reviewed.
  French verification covers system translations; core has its English fallback.
  This does not certify every viewport, screen-reader use or live V13 behavior.

The checkout was clean at the start. The 32 changed files comprise runtime (15),
tests (8), locales/template (3), documentation (5) and the read-only automation
inventory (1). No incompatible persisted schema or world migration was added.

Ignored local evidence: `reports/recovery-delivery-node.log`,
`reports/recovery-delivery-live.log`, `reports/recovery-chat-live.log`,
`reports/recovery-reroll-origin-red.log`, `reports/recovery-flag-merge-red.log`
and optional screenshots under `reports/recovery-ui/`. Set
`CYPHER_E2E_UI_CAPTURE_DIR` to an ignored local directory to retain the UI matrix
screenshots on successful runs; ordinary CI does not require that variable.
