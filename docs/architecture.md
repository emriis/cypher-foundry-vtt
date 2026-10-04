# Architecture Audit

This document describes the current architecture of the Cypher Foundry VTT
system and the refactoring direction for the next development phases.

The goal is incremental refactoring, not a rewrite. Existing gameplay behavior
and persisted data must remain stable unless a change is explicitly identified
as a rules or schema change.

## 1. Current architecture

The system currently has these main layers:

| Area | Current responsibility |
| --- | --- |
| `module/data-models/` | Foundry DataModel schemas and derived actor data |
| `module/documents/` | Foundry Actor/Item document behavior and gameplay operations |
| `module/sheets/` | Actor/Item presentation, dialogs, and UI event handling |
| `module/abilities.mjs` | Ability UUID resolution and ability presentation helpers |
| `module/config.mjs` | Cypher constants and rule configuration |
| `module/import.mjs` | Character Builder import mapping and import UI |
| `module/migration.mjs` | World schema migration and legacy data conversion |
| `scripts/` | Pack compilation, source migration, packaging, and E2E orchestration |
| `cypher.mjs` | Foundry registration and global document/UI hooks |
| `tests/` | Rule, integration, content-contract, migration, and E2E tests |

This separation is useful, but several modules currently contain multiple
architectural responsibilities.

## 2. Main findings

### 2.1 Actor document is the primary refactoring target

`module/documents/actor.mjs` is currently about 51 KB and contains task and
defense resolution, Effort and XP transactions, rerolls and Player Intrusions,
advancement, recovery and rally, wounds and damage, armor and shield behavior,
Type/Focus/Descriptor application, custom stats and fields, ability behavior,
depletion-related behavior, and chat output.

This makes the Actor document both a Foundry persistence boundary and a
substantial gameplay rules/service layer.

The intended direction is to keep the Actor document as an orchestration
boundary while moving pure rules and reusable application logic into focused
modules.

### 2.2 PC sheet is also carrying too much application logic

`module/sheets/actor-pc-sheet.mjs` is about 39 KB.

It currently handles sheet context preparation, many UI dialogs,
Type/Focus/Descriptor selection, roll option collection, ability effect
selection, ability roll tables, advancement interaction, inventory actions,
armor/shield actions, and recovery/rally interaction.

UI event handling belongs here, but rule decisions and data transformations
should not increasingly accumulate in the sheet.

### 2.3 Migration is a mixed responsibility

`module/migration.mjs` is about 14 KB and currently combines migration version
orchestration, actor schema migration, legacy Type/Focus ability conversion,
and legacy content-specific compatibility mappings.

Migration orchestration and individual schema transformations should eventually
be separated so each migration can be tested independently.

### 2.4 Entry-point hooks contain gameplay-adjacent behavior

`cypher.mjs` is correctly acting as the Foundry registration/wiring layer,
but it also contains document-level behavior such as armor exclusivity and
chat-message reroll UI.

The long-term boundary should be registration in `cypher.mjs`, reusable
behavior in modules, and thin hook adapters.

### 2.5 Data models contain some derived application policy

`module/data-models/actor-pc.mjs` contains a substantial
`prepareDerivedData` implementation.

Some derived values are correctly model-level concerns, but policy-heavy
calculations should be moved to pure functions when they become reusable or
complex enough to deserve independent tests.

### 2.6 The standalone ability refactor exposed a runtime boundary

The standalone ability architecture stores Type/Focus abilities as references.
Runtime code must consistently resolve those references before treating them as
ability Documents.

This is an important architectural boundary: data normalization alone is not
enough. Custom Types and Foci must use the same resolution path as built-in
content.

## 3. Target architecture

The target is a layered architecture with explicit dependency direction:

```
Foundry bootstrap
      |
      v
Documents / Sheets / Hooks
      |
      v
Application services
      |
      v
Cypher rules and domain helpers
      |
      v
Configuration / pure data
```

### 3.1 Data models

Data models own persisted schema, validation, Foundry-specific field
definitions, and derived values that are genuinely document-data concerns.

They should not perform chat output, UI operations, or unrelated document
orchestration.

### 3.2 Documents

Documents own Foundry document lifecycle, persistence through
`update`/embedded-document APIs, document-specific orchestration, and
integration with Foundry APIs.

Documents should delegate pure calculations and reusable business operations
instead of becoming the home for every rule.

### 3.3 Rules

A future `module/rules/` layer should contain pure Cypher mechanics such as
task-step calculation, Effort cost, wound severity/cascading, defense
resolution, recovery calculations, advancement calculations, Focus graph
eligibility, and other deterministic rule calculations.

Rules should not depend on Foundry globals such as `game`, `ui`,
`ChatMessage`, `Actor`, or `Item`.

### 3.4 Application services

A future `module/applications/` or `module/services/` layer should contain
operations that combine domain rules with Foundry documents.

Examples include applying a Type, applying a Focus, selecting a Focus ability,
applying a Descriptor, creating an embedded ability from a referenced ability,
resolving a compendium reference, and executing an advancement.

These operations may use Foundry APIs, but they should not contain the
low-level mathematical rule calculations themselves.

### 3.5 Sheets

Sheets should primarily prepare presentation context, collect user input, call
an Actor/Item/application operation, and render the result.

A sheet should not become the authoritative implementation of a game rule.

### 3.6 Hooks and bootstrap

`cypher.mjs` should remain a composition root. It should primarily register
document classes, data models, sheets, settings, helpers, and connect Foundry
hooks to dedicated handlers.

Hook handlers should stay small and delegate to reusable code.

### 3.7 Compendium and migration pipeline

Content sources should follow:

```
source JSON
    |
    | deterministic migration/normalization
    v
compiled Foundry packs
```

The source files remain authoritative for repository content. Generated pack
artifacts must not become a second source of truth.

## 4. Dependency rules

### Allowed

- Data models -> configuration and pure helpers.
- Rules -> configuration and pure data.
- Documents -> rules/services/configuration.
- Sheets -> documents/services/rules used for presentation.
- Bootstrap -> all registration modules.
- Tests -> any production layer required by the test type.

### Avoid

- Rules -> Foundry globals.
- Data models -> UI or ChatMessage.
- Sheets -> duplicated game mechanics.
- Bootstrap -> large gameplay implementations.
- Compendium source data -> UI-specific implementation details.
- One domain module importing another domain module only to access an unrelated helper.

## 5. Refactoring sequence

The refactoring should be incremental.

### Phase 1 — Architecture audit

This document records the current boundaries, major hotspots, and target
dependency rules.

### Phase 2 — Extract pure rules

Phase 2 is complete. The deterministic rule set is now extracted into focused
modules under `module/rules/`:

1. Effort cost and task-step calculation in `rules/tasks.mjs`.
2. Wound severity, cascading, shield overflow, and Pool-damage conversion in
   `rules/wounds.mjs`.
3. Defense stat and armor modifiers in `rules/defense.mjs`.
4. Recovery roll data, wound recovery, and rally calculations in
   `rules/recovery.mjs`.
5. Advancement progression and mechanical updates in
   `rules/advancement.mjs`.
6. Focus graph eligibility in `rules/focus.mjs`.

Actor methods remain compatibility facades and orchestration boundaries. Pure
rule modules do not depend on Foundry globals. Focus and advancement operations
that require persistence or document resolution remain in the Actor layer for
the later application-service phases.

Each extraction preserves existing public behavior and is covered by focused
unit tests in addition to the existing Actor integration tests.

### Phase 3 — Refactor Actor orchestration

Move reusable operations out of `CypherActor` while keeping Actor methods as
stable facades for sheets and macros.

For example:

```js
await actor.rollTask(options);
```

may remain the public operation while deterministic calculations move to the
rules layer.

### Phase 4 — Refactor Type/Focus/Ability application

Complete the standalone ability runtime boundary:

1. Resolve UUID references.
2. Validate the resolved Item type.
3. Evaluate Focus flowchart edges separately from ability data.
4. Apply standalone ability mechanics.
5. Create actor-owned ability Items from the resolved source.
6. Keep custom Types/Foci compatible with the same mechanism.

### Phase 5 — Reduce sheet responsibilities

After application services exist, simplify sheet handlers so they collect
input and delegate.

### Phase 6 — Split migrations

Separate migration orchestration from individual schema migrations and content
compatibility transforms.

### Phase 7 — Reorganize tests

Align tests with the architecture:

```
tests/
  rules/
  documents/
  applications/
  content/
  migrations/
  integration/
  e2e/
```

The exact directory split should happen only after the production boundaries
are established, to avoid moving tests without improving their meaning.

## 6. Refactoring principles

- No broad rewrite.
- One architectural concern per pull request where practical.
- Preserve behavior unless the PR explicitly changes it.
- Prefer pure functions over static methods when no document state is needed.
- Keep Foundry-specific code at the boundaries.
- Keep CRD-derived rules separate from editorial content.
- Use synthetic fixtures for rule tests.
- Use real compendium data for content-contract tests.
- Keep live Foundry E2E tests separate from normal Node tests.
- Do not introduce abstractions merely because they look architecturally
  elegant; introduce them when they remove a real dependency or responsibility.

## 7. Immediate next step

The next implementation PR should refactor Actor orchestration around the pure
rules established in Phase 2. Before moving a responsibility, identify its
current callers and tests. Actor methods should remain stable compatibility
facades until callers have been migrated to the new application boundaries.
