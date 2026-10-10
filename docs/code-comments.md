# Code comments and reader guidance

Comments should let a developer new to JavaScript or Foundry understand what a
module owns, how an action progresses, and why an unexpected branch exists.
Repository comments, JSDoc, and documentation are written in English. Keep
player-facing explanations localized in `lang/en.json` and `lang/fr.json`.

## Reading the project for the first time

Use [architecture.md](architecture.md) for the layer map, then follow one action:

1. `cypher.mjs` registers document classes, schemas, sheets, and hooks.
2. `templates/actor/parts/main.hbs` declares controls and `data-action` names.
3. `module/sheets/actor-pc-sheet.mjs` collects input and handles cancellation.
4. `module/documents/actor.mjs` keeps public Actor methods used by sheets/macros.
5. `module/applications/task-service.mjs` coordinates costs, dice, chat, and writes.
6. `module/rules/tasks.mjs` calculates cost and difficulty without Foundry.
7. `tests/applications/task-service.test.mjs` shows fixed inputs and outcomes;
   `tests/e2e/foundry-gameplay.spec.mjs` exercises the real Foundry interaction.

For saved data, start with `module/data-models/actor-pc.mjs`. For tooling, start
with `scripts/run-isolated-validation.mjs` and `scripts/validation-workspace.mjs`.
These run in Node, whereas system modules run in Foundry's browser.

| Term | Meaning in this repository |
| --- | --- |
| Actor / Item | Foundry documents: a character and a piece of content or inventory. |
| Embedded Item | An Item owned by an Actor, distinct from its compendium source. |
| UUID | Reference identifying a document, including its world/pack/token context. |
| Synthetic Actor | Actor attached to an unlinked token, with token-specific state. |
| Schema / field factory | Saved-data definition / function creating fresh field definitions. |
| Derived data | In-memory values recalculated from saved fields and inventory. |
| Application service | Code coordinating Foundry reads, dice, chat, and document updates. |
| Facade | Small public method delegating work to its owning service. |
| Pool / Edge / steps | Spendable points / cost reduction / difficulty adjustments. |
| CRD | Cypher Reference Document, the source authority for supported mechanics. |

## What to explain in code

- Give nontrivial modules or classes a short purpose statement identifying the
  environment, responsibility, and important caller or lower-layer dependency.
  An existing class/function description can serve this purpose in a small file.
- Give exported functions and nontrivial public methods an adjacent JSDoc contract:
  meaningful inputs, optional/default values, units, result shape, and rejection
  outcomes. Describe persistence/filesystem effects and important thrown errors.
- In long flows, explain meaningful phases: validate, resolve references, calculate,
  persist, publish, clean up. Explain ordering when changing it would alter behavior.
- Explain surprising choices: synthetic targets, inclusive table ranges, shared
  Edge, duplicate-effect guards, conservative fallbacks, and source-backed limits.
- Explain Foundry concepts at the first relevant boundary: template context is
  presentation data, and preparation must not call document updates.
- Explain test doubles and fixed dice values when they would otherwise conceal
  the behavior being tested. Keep expectations in executable assertions.
- In CSS, explain theme, focus, contrast, and layout constraints. In Handlebars,
  use `{{!-- ... --}}` for context/action bindings, not rendered HTML comments.

Use a short example when signs, units, or a formula are easy to misunderstand.
For example, two Effort levels with Edge 1 cost `3 + 2 - 1 = 4` Pool points.
Keep examples consistent with configuration and tests.

## Accuracy and restraint

Comments describe current behavior, including limits. A local double-click guard
is not a cross-client lock. Sequential document writes are not an atomic
transaction. State what happens on cancellation and on failure after an earlier
write. Do not promise refunds, rollback, permissions, accessibility certification,
or compatibility checks that the implementation/evidence does not establish.

Use `//` for a local reason or a phase and `/** ... */` for a function/class
contract. Keep the explanation beside its code. Prefer short paragraphs and
precise verbs. Avoid repeating function names, narrating every assignment,
duplicating obvious type information, or adding decorative separators.

Do not impose a comment quota or JSDoc on every trivial private helper. A short
delegate needs its owner/caller relationship explained, not a copy of the
service documentation. Use accurate types; broad `any` declarations or invented
Foundry types do not improve a contract.

When behavior changes, update comments and examples in the same change. Delete
duplicates and stale claims. Keep future plans in roadmap documentation. Cite
a concrete source or test when a rule explanation needs evidence. Do not insert
comments into generated packs or JSON source data.

## Examples

An unhelpful comment repeats the assignment:

```js
// Set the target.
const selectedTarget = target;
```

A useful comment explains the identity constraint:

```js
// Keep the actual target Actor: resolving by world ID would lose
// the token-specific state of an unlinked token.
const selectedTarget = target;
```

For async APIs, distinguish an ordinary rejection from an exception:

```js
/**
 * Add one actor-owned Ability effect reference, refusing duplicates.
 * @param {Actor} actor PC that will own the active reference.
 * @param {Item} abilityItem Ability embedded in that same Actor.
 * @param {string} effectId Identifier within that Ability.
 * @returns {Promise<boolean>} True after persistence; false for invalid/duplicate input.
 */
```

## Review and validation

Before approving a code change, check:

- Can a new reader identify the owner, inputs, outcome, and next layer to read?
- Are optional values, units, null/false/void outcomes, and side effects accurate?
- Are unusual branches and important async ordering explained?
- Do examples agree with configuration, source contracts, and tests?
- Were stale, displaced, duplicate, and unsupported claims removed?
- Do comments add information without obscuring the executable flow?

Lint, type checking, syntax checks, and tests catch some contract mistakes;
they cannot judge explanation quality. Code review must assess meaning.
For comment-only changes, confirm executable code is unchanged and run relevant
static checks. Do not rebuild versioned packs just to validate prose.
