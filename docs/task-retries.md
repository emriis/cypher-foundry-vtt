# Retrying an ordinary task after failure

## Authority and accepted interpretation

Source: supplied CRD, 2026-07-29, **Retrying a Task After Failure**, paragraphs
7610–7613 in `docs/Cypher-Reference-Document-2026-07-29.docx`. A retry is a new
action, takes the same time as the initial task and requires at least one level
of Effort. The GM may rule further attempts impossible. Combat attacks are not
repeated through this rule; an attack on a later turn is a new attack.

**Accepted user interpretation:** at least one ordinary paid Effort level is
required. Free Effort, Power Shifts and the Superheroics wound-funded grant do
not replace it. Edge still reduces its Pool-point cost, potentially to zero.
The check uses the actual prepared/clamped paid allocation, not just a positive
request in the dialog.

## Player workflow

A newly recorded failed ordinary stat/skill task offers **Retry this task — new
action** in chat, separately from the **Reroll** XP button. The player identifies
the same task, declares the original duration when it was not recorded, and
confirms that the same task/time remain applicable in the fiction. Subsequent
attempts retain that duration as a readonly declaration. Names and prose do not
establish task identity: the explicit predecessor card does.

The regular task dialog collects fresh difficulty, skill, assets, conditional
modifiers and applicable help. It defaults to one paid Effort level. The acting
Pool remains the recorded Pool; a different task or a specialized source action
uses its own workflow. Current resources, modifiers, conditions and ownership
are checked again after the dialog, before action usage, costs or dice.

Cancellation and ordinary validation rejection spend no resources and roll no
dice. A managed combat consumes a fresh ordinary action slot; it cannot reuse
the failed action's slot, a minor activity or an undeclared extra action. Outside
managed combat, the existing ordinary-task boundary applies. Duration is an
explicit fictional declaration, not a new timer: no world-time advance, guessed
installation duration or wall-clock delay is imposed.

Every accepted retry gets a new card and result. Its cost uses current Edge and
Effort and spends no reroll XP. Original outcomes, Pool expenses, wounds and
other effects are not undone. A natural twenty refunds only the new action's
point cost; an automatic routine success still pays its accepted cost and has
no natural-result refund. Failed subsequent attempts can themselves be retried.
The predecessor cannot start a second branch.

## GM decisions and retained results

The GM can explicitly forbid further attempts and record a reason on the
original card. Authorizing attempts again does not spend resources or roll.
A veto on an ancestor also applies to later linked attempts. Possibility and
whether a circumstance constitutes the same task remain explicit adjudication.

Paid reroll cards resolve to their authoritative original action. Retry
eligibility uses its current retained die. A retained success makes another
attempt unavailable, including when an ancestor is successfully rerolled after
a later attempt. Existing later actions are not rolled back; each remains an
independent action with its own expenses. Missing ancestors, deleted sources,
cycles and stale predecessor buttons cannot silently restart a task chain.

## Persisted identity and failure boundaries

New ordinary task cards store versioned `flags.cypher.taskAttempt`: acting stat,
base difficulty, selected Skill, descriptive label, declared duration and optional
`parentMessageId`. The actual `actorUuid` is required; a world Actor with the
same ID cannot substitute for a synthetic token Actor.

`flags.cypher.taskRetryPolicy` stores the GM declaration. `flags.cypher.taskRetry`
stores a pre-mutation `pending` checkpoint and then `done` with the new card ID.
The checkpoint precedes action usage, Pool spending and dice. Ordinary rejection
before writes leaves no checkpoint; a known round-reservation rejection can
release the just-created checkpoint without restoring Actor state.

Errors after acceptance may leave action usage, costs or a published child
already committed. The predecessor remains pending after reload and blocks
replay and further descendant retries. The GM reconciles actual action usage,
expenses and chat, then explicitly closes the interrupted predecessor. Closure
never repeats a roll, refunds points or rolls back a snapshot. An already
published child can continue after reconciliation. Chat failure and a failed
final predecessor link are both covered by application regressions.

Client-local reservations cover the actual Actor and predecessor. They compose
with the task/reroll action guard; they are not a distributed lock across clients
or an atomic Actor/ChatMessage database transaction. Raw manual flag changes are
outside this execution contract.

## Scope and compatibility

This workflow covers ordinary nonattack stat/skill tasks, including explicitly
selected current help. Defenses, initiative, recovery/treatment, Ability actions,
shield-return continuations, cooperative actions producing their own effects,
and other targeted/specialized tasks retain their dedicated source contracts.
They do not acquire a generic retry button that could bypass their prerequisites.

Old cards lacking `taskAttempt` are not reconstructed from an effective
difficulty or display name. They retain their existing XP-reroll support. There
is no Actor/Item schema change, world migration, inferred historical duration
or automatic source refresh.

Macros may call `actor.retryTask(message, {label, duration, sameTaskConfirmed,
effortLevels, ...freshTaskChoices})`. The public `game.cypher.taskRetries` facade
also exposes GM permission and interrupted-attempt closure operations. Sheets
collect intent; `task-retry-service.mjs` composes the common task engine,
`task-retry-history.mjs` owns card checkpoints and lineage, and
`rules/task-retries.mjs` owns deterministic eligibility predicates.

## Validation scope

Application tests exercise original costs, new Effort, free-level rejection,
Edge, insufficient resources, current retained results, GM veto, action usage,
repeated activation, serialized history, synthetic identity, missing documents,
publication/link failures and manual closure. Scoped Foundry tests exercise
EN/FR in both themes, keyboard controls, chat-button distinction, cancellation,
GM veto after reload, successive attempts, immutable duration, synthetic combat
action slots and interrupted publication. Record observed runs separately from
these scenario definitions; they do not establish blanket Ability automation
or full Foundry-version coverage.

## Observed validation — 2026-10-25

- Isolated normalized `npm test`: **1,054 passed**, no failures or skips.
- **23 focused application regressions** pass, including free-Effort rejection,
  retained paid rerolls, new action usage, actual synthetic ownership, publication
  failure and a failed final predecessor link.
- **5 scoped Foundry scenarios passed** on Foundry **14.369.0**, Chromium
  **153.0.8010.12**. Three exercise this workflow: EN/FR in light/dark themes,
  640×700 PC sheets, keyboard controls, veto/cancellation/reload, successive
  attempts, synthetic managed-combat actions and explicit interrupted-attempt
  closure. The existing player vertical slice and First/waiting/Last round-flow
  scenario also pass.
- Temporary compilation passes all **15** pack-readability contracts, archive
  verification and runtime/E2E syntax preflight. Lint, the typecheck pilot,
  architecture dependencies and locale source/bundle consistency checks pass.

The full E2E suite and Foundry V13 were not rerun. No compatibility declaration,
authored compendium, generated pack, release archive or user world was changed.
