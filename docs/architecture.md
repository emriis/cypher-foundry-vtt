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

`module/documents/actor.mjs` remains the primary refactoring target. It still owns
Foundry document lifecycle, stat resolution, defense mapping, Type/Focus/Descriptor
application, ability behavior, and some document-specific character behavior.
Task rolls, recovery, advancement, XP transactions, rerolls, Player Intrusions,
wounds, damage, shields, armor damage, and custom character fields have been
moved behind application-service boundaries.

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

The `module/rules/` layer contains pure Cypher mechanics such as task-step
calculation, Effort cost, wound severity/cascading, defense resolution,
recovery calculations, advancement calculations, Focus graph eligibility, and
other deterministic rule calculations.

Rules must not depend on Foundry globals such as `game`, `ui`,
`ChatMessage`, `Actor`, or `Item`.

### 3.4 Application services

The `module/applications/` layer contains Foundry-aware use cases that combine
documents with pure rules. It is the boundary between Foundry orchestration and
the Cypher rule core.

The extracted application services are:

1. `applications/task-service.mjs` for task-roll orchestration.
2. `applications/recovery-service.mjs` for recovery and Rally orchestration.
3. `applications/advancement-service.mjs` for advancement purchases and tier
   transitions.
4. `applications/character-service.mjs` for XP spending, rerolls, Player
   Intrusions, and custom character fields.
5. `applications/damage-service.mjs` for wounds, damage, shields, armor damage,
   and wound-related token statuses.
6. `applications/reference-resolver.mjs` for centralized document-reference
   resolution and expected-type validation.

These services own Foundry-specific orchestration such as dice evaluation,
document updates, Pool/XP transactions, and chat output while delegating
deterministic calculations to `module/rules/`.

Actor methods remain stable compatibility facades for sheets, macros, and other
callers while application services are introduced. For example:

```js
await actor.rollTask(options);
```

remains a public operation while its application use case is implemented by
`applications/task-service.mjs`.

Actor methods remain compatibility facades after extraction. This is deliberate:
sheets, macros, and other callers can keep using the existing API while the
implementation moves behind a clearer boundary. A responsibility should be
extracted when doing so removes a meaningful application concern from the
document; behavior that is genuinely document-owned may remain there.

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

Phase 3 is complete. The main Foundry-aware application boundaries have been
extracted and the verification pass has removed the remaining shared stat
lookup dependency from the Actor document. Actor methods remain stable compatibility facades while
implementation moves into focused services.

The current Phase 3 services are:

1. `applications/task-service.mjs` — task rolls, Effort/Pool transactions,
   special results, defense outcomes, and chat output.
2. `applications/recovery-service.mjs` — recovery and Rally orchestration.
3. `applications/advancement-service.mjs` — advancement purchases and tier
   transitions.
4. `applications/character-service.mjs` — XP spending, rerolls, Player
   Intrusions, and custom stats/fields.
5. `applications/damage-service.mjs` — wounds, damage, shield absorption,
   armor damage/repair, and wound-related token status synchronization.

These services own Foundry-specific orchestration such as dice evaluation,
document updates, resource transactions, chat output, and token/item updates.
Deterministic calculations remain delegated to `module/rules/`.

The remaining substantial Actor responsibilities have been assessed. Type,
Focus, Descriptor, and standalone ability application are intentionally deferred
to Phase 4 because they require the reference-resolution boundary established
by `applications/reference-resolver.mjs`.

### Phase 4 — Refactor Type/Focus/Ability application

The runtime reference boundary is established by
`applications/reference-resolver.mjs`:

1. Resolve a UUID or accept an already-resolved document.
2. Validate the expected document type.
3. Return only valid documents to the caller.
4. Keep direct `fromUuid()` calls out of application/content consumers.

The remaining Type/Focus/Descriptor work should then use that boundary:

1. Resolve Type/Focus UUID references through the centralized resolver.
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

The target test taxonomy is:

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

This is a target organization, not a claim that all tests have already been
moved. The directory split should happen only after the production boundaries
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

Complete the Phase 3 verification pass: keep the Actor facades covered by tests,
check for accidental direct application logic left in the document, verify that
application services no longer depend on private Actor helpers, and verify
that the extracted services are documented and independently testable.

Then Phase 4 can continue the Type/Focus/Descriptor application refactor using
the centralized reference resolver. Do not move Type/Focus/Descriptor logic into
the new character or damage services merely to make the Actor smaller; those
operations have a separate content/reference boundary.

## 8. Domain organization

Production code should be organized by architectural responsibility and domain,
not by the historical order in which features were added.

The intended rule domains are:

```
module/
  rules/
    combat/
    tasks/
    recovery/
    advancement/
    characters/
    content/
  applications/
  documents/
  data-models/
  sheets/
```

This is a target structure, not a requirement to move every existing file
immediately. A rule belongs in a domain module when its behavior is deterministic
and does not require Foundry state. Application modules may cross domains when
implementing a complete use case, but individual rule modules should remain
focused.

New domains such as equipment, cyphers, creatures/NPC abilities, powers,
custom Descriptors, custom Types, and custom Foci should follow the same
boundary instead of adding another collection of feature-specific helpers.

## 9. Content source and pack compilation contract

Repository content follows one direction:

```
editable source data
      |
      | deterministic migration / normalization
      v
compiled Foundry packs
```

The `packs/*/_source/` files are authoritative. LevelDB and other generated
pack artifacts are build outputs and must never be edited as source data.

Pack tooling should keep this distinction explicit. Source migrations transform
authoring data before compilation; the compiler writes generated artifacts into
the pack directory. A generated artifact must be reproducible from source.

## 10. Reference-resolution contract

All persisted document references use the following convention:

```
reference
    |
    v
resolveDocumentReference(reference, expectedType)
    |
    v
validate expected document type
    |
    v
use resolved document
```

Content/application code must not duplicate `fromUuid()` calls. The resolver
also accepts an already-resolved Document, which makes custom content and tests
easier to support without weakening type validation.
