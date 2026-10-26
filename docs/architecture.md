# Architecture

This document describes the architecture that exists in the repository today. It
is a current-state reference, not a target architecture disguised as a status
report.

The system is a Foundry VTT implementation of Cypher. Dependencies flow from
Foundry-facing layers toward deterministic rules and source data; lower layers
must not depend on sheets, browser APIs, or Foundry globals.

## 1. Current architecture

| Area | Responsibility |
| --- | --- |
| `module/data-models/` | Foundry DataModel schemas for Actors and Items |
| `module/documents/` | Thin Foundry document APIs and compatibility facades |
| `module/applications/` | Foundry-aware gameplay use cases and document orchestration |
| `module/rules/` | Pure, deterministic Cypher rules and calculations |
| `module/sheets/` | ApplicationV2 sheets, dialogs, rendering, and UI events |
| `module/config.mjs` | Central Cypher constants and rule configuration |
| `module/import.mjs` | Character Builder import and public compatibility API |
| `module/migration.mjs` | Reserved world-data migration entry point |
| `scripts/` | Pack compilation, migration, packaging, audits, and E2E orchestration |
| `packs/*/_source/` | Authoritative editable compendium source records |
| `packs/*/` | Generated Foundry LevelDB packs |
| `tests/` | Rules, application, document, content, integration, behavior, migration, and E2E tests |
| `cypher.mjs` | Foundry registration, startup, hooks, and system bootstrap |

### Application services

The main gameplay boundaries are:

- `task-service.mjs`: task rolls, Effort and Pool transactions, defense
  outcomes, and task chat output.
- `task-retry-service.mjs` and `task-retry-history.mjs`: fresh same-task
  attempts, explicit GM possibility declarations, lineage and pre-mutation
  checkpoints; see [task retries](task-retries.md).
- `task-preparation.mjs`, `task-consequences.mjs`, and `task-message.mjs`:
  read-only task planning, awaited effects, and localized presentation.
- `reroll-service.mjs`: CRD paid-reroll orchestration and retained metadata;
  `rules/task-outcome.mjs` shares outcome rules with initial task rolls.
- `defense-consequence-service.mjs`: record actual incoming damage and reconcile
  a failed defense with its retained successful reroll. `defense-history.mjs`
  stamps attribution revisions in the Actor pre-update hook; pure
  `rules/defense-correction.mjs` plans safe incremental removal.
- `action-guard.mjs`: reserves actual Actor identities across competing action
  categories on one client. Nested services carry an explicit parent context;
  multi-target actions reserve all owners before execution. This rejects overlap
  rather than queuing and does not provide a cross-client lock or rollback.
- `recovery-service.mjs`: completed recoveries, allocation, extra allowances and Rally.
- `healing-service.mjs` and `wound-removal.mjs`: treatment/Healing Hand and
  persisted task/reroll healing consequences; see [recovery-and-healing.md](recovery-and-healing.md).
- `advancement-service.mjs`: validated advancement purchases, resource rewards,
  no-banking tier transitions and legacy pending-choice settlement.
  `advancement-grants.mjs` resolves actual Focus/Genre source grants before costs;
  see [character advancement](character-advancement.md).
- `cypher-generation-service.mjs` and `cypher-inventory-service.mjs`: exact CRD
  generation, elected-GM awards, capacity, custody and one-use action timing;
  Item/Actor batch hooks delegate native inventory checks. See
  [common cypher lifecycle](cypher-lifecycle.md). Particular powers remain separate.
- `project-service.mjs`: source-backed resource-point costs, explicit downtime
  projects, elected-GM settlement, contribution receipts and concrete results;
  see [resource-point projects](resource-projects.md).
- `character-service.mjs`: XP spending and character data operations;
  its Player Intrusion facade delegates to `intrusion-service.mjs`, which owns
  GM decisions, player requests, and receipt-based XP settlement.
- `damage-service.mjs`: damage, wounds, armor, shields, repair, and token
  statuses.
- `equipment-hands-service.mjs`: explicit held/stowed declarations, finite hand
  capacity and source-required tripod/operators, with rules in
  `module/rules/equipment-hands.mjs`. See [equipment constraints](equipment-constraints.md).
- `general-action-service.mjs`, `cooperative-service.mjs` and
  `general-effect-service.mjs`: explicit cooperation, guard and condition
  declarations, source-turn intervals and declared special-damage profiles;
  `rule-effect-consequence.mjs` handles their attributed successful task effects.
  `special-damage-healing.mjs` protects declared specialist-only damage.
  See [general actions](general-actions.md) for source contracts and limits.
- `environment-service.mjs`: GM-declared PC hazards, explicit protection and
  checkpointed repeated exposures. It composes shared defenses and consequence
  attribution; pure validation lives in `module/rules/environment.mjs`.
  See [environmental hazards](environmental-hazards.md).
- `shield-lifecycle-service.mjs` and `shield-attack-service.mjs`: explicitly
  designated physical shield Abilities, lost turns, timed work and source-backed
  attacks through the shared task engine; see [shield Abilities](shield-abilities.md).
- `reference-resolver.mjs`: document/reference resolution at the Foundry
  boundary.

Actor methods remain available where compatibility requires them, but gameplay
orchestration belongs in application services.

## 2. Rules boundary

Code under `module/rules/` is deterministic and must not depend on Foundry
globals.

It contains calculations and decisions such as:

- task difficulty and step outcomes;
- Effort and Edge costs;
- wound and damage transitions;
- recovery eligibility and effects;
- advancement costs and effects;
- active Ability modifier aggregation;
- other reusable Cypher rule operations.

Application services adapt Foundry documents to these pure functions and persist
the resulting state.

DataModel derived preparation may also consume pure rules, without importing
application services or persisting changes. Effective wound capacities combine
saved maxima with declared Ability modifiers; saved maxima and wound counts
remain unchanged during preparation.

## 3. Structured Ability architecture

Abilities are standalone Items. Types and Foci reference reusable Ability
documents rather than duplicating their definitions.

An Ability can contain structured:

- tier and identity;
- action requirement;
- enabler/repeatable state;
- cost and cost options;
- effects;
- modifiers such as Pool maximum, Edge, and wound capacity;
- recovery-based end conditions;
- free weapon/armor/skill categories;
- weapon attack-category choices;
- structured roll tables.

Runtime activation is deliberately separate from the CRD source definition:

```text
Ability Item
  static CRD-derived definition
       |
       v
Actor.system.activeAbilityEffects[]
  runtime activation state
       |
       v
application/rules services
```

Runtime operations include activation, deactivation, recovery-driven expiration,
cost handling, modifier aggregation, and roll-table resolution.

The source definition never stores current activation state.

## 4. Content source and compendium architecture

CRD-derived content follows this pipeline:

```text
CRD source
   |
   v
packs/*/_source/
   |
   | deterministic migration / normalization / build
   v
Foundry LevelDB packs
```

The `_source/` records are authoritative. Generated LevelDB files are build
artifacts and must not be edited manually.

CRD provenance is stored under:

```text
flags.cypherFoundry.crd
```

with the source revision, logical ID, language, source kind, section, locator,
transformations, and source relationship needed to trace a record back to the
CRD.

English and French records share a language-neutral logical ID. References are
authored using stable logical IDs and resolved to Foundry UUIDs during build.

## 5. Current content coverage

The current CRD-derived source library contains structured bilingual content
for:

- Skills;
- Abilities;
- Types;
- Descriptors, including species-style descriptors;
- Foci and their Ability references/flowcharts;
- Equipment;
- Weapons;
- Armor;
- Shields;
- Subtle Cyphers;
- Manifest Cyphers;
- Power Boost Cyphers.

The current W4 equipment inventory is 259 English records paired with 259
French records across equipment, weapons, armor, and shields.

Cypher source data contains structured depletion data and, where supplied by the
CRD, variants and roll-table information.

The Artifact Item model exists, but the supplied 2026-07-29 CRD source contains
no Artifact inventory. Artifact extraction is therefore source-blocked rather
than incomplete through an implementation guess.

The system also contains a general NPC/creature Actor model. The CRD conversion
does not claim creature extraction because the supplied CRD does not contain a
creature inventory.

## 6. Runtime content boundary

Structured source data is intended to be automation-ready. A field is not
considered fully integrated merely because extraction preserves it.

For mechanically meaningful data, the project distinguishes:

1. extracted from the source;
2. represented by a DataModel;
3. validated by content tests;
4. consumed by runtime behavior;
5. covered by a gameplay/E2E contract where appropriate.

This distinction is currently important for equipment and Cyphers.

Weapon `system.mechanics.targetEffects` are resolved against the selected
NPC's level. On a successful PC attack, matching effects are persisted under
`flags.cypher.activeWeaponEffects`. The NPC attack service consumes the
supported `hindered` and `loseNextAction` effects and expires them according
to their declared `one round` or `next action` duration. Remaining weapon
mechanics still require source-backed runtime contracts.

Cypher `variants` and structured `rollTables` now have runtime resolution.
Cypher `randomRange` and other structured effect data remain open until their
source semantics and runtime contracts are verified.

## 7. ApplicationV2 sheets

Shared PC roll, weapon-category, and weapon-Ability dialogs are implemented in
`module/sheets/dialogs.mjs`. They collect intent and preserve synthetic target
identities; accepted application services own writes. The PC sheet's action
handlers delegate only after all required dialogs have completed.

The system uses ApplicationV2 for PC, NPC, Community, and Item sheets.

Each document sheet has an explicit ApplicationV2 root template. The root is a
real form part where document submission is required, while detailed sections
are rendered through Handlebars partials.

The PC sheet is a single gameplay dashboard rather than a collection of hidden
primary tabs. Biography, notes, and custom fields remain collapsible.

## 8. E2E architecture

The E2E suite uses Playwright against a real headless Foundry runtime.

The runner:

- copies the checkout into a marked temporary workspace;
- normalizes sources and builds packs before packaging the isolated system;
- validates JavaScript syntax and the Playwright browser before startup;
- creates one disposable `cypher-e2e-<timestamp>` world in temporary user data;
- starts Foundry headlessly;
- uses one worker-scoped browser/context/page;
- logs into Foundry as the Game Master once for the worker;
- reuses that session for the E2E suite;
- removes only its marked workspace after stopping Foundry;
- never installs into or deletes the user's general Foundry `Data` directory;
- shuts down the runner-owned Foundry process.

The E2E command is:

```powershell
npm run test:e2e
```

The runner is intentionally local because a licensed Foundry installation is
required for live runtime validation.

## 9. Historical architecture refactoring

The repository previously tracked a multi-phase architecture refactor. Phases
1 through 8 were completed and merged. Their completed work remains part of the
project history and should not be treated as pending work.

The resulting architecture is the current baseline:

- pure rules are separated from Foundry orchestration;
- application services own gameplay use cases;
- Actor compatibility facades preserve the public API;
- Type/Focus/Ability application uses reusable Ability documents;
- ApplicationV2 sheets have explicit roots and partials;
- migration boundaries are explicit;
- dependency boundaries are audited;
- test organization follows the architectural layers.

The historical phase sequence is retained in project history rather than used
as the current implementation queue.

## 10. Current architectural priorities

The CRD-backed cost/reroll and refactoring contracts are documented in
[runtime-refactor.md](runtime-refactor.md), including partial-write limits.
Round scheduling and Actor-owned action usage are documented in
[round-flow.md](round-flow.md); the Combat adapter delegates to application
services, while pure phase calculations remain in `module/rules/round-flow.mjs`.

Intrusion decisions use persisted ChatMessage requests and an elected GM
settlement authority. Per-Actor XP receipts support partial-write recovery;
see [intrusions.md](intrusions.md) for ownership and transaction limits.
=======

Source migration is now coordinated by `scripts/migrate-ability-sources.mjs`
with identity, source lookup, normalization, cleanup, and registry helpers under
`scripts/source-migration/`. The authoring surface and source bytes are preserved.

The architecture is no longer undergoing the broad Phase 1-8 refactor. New work
should follow the feature workflow:

1. establish the source/rule contract;
2. write or update the deterministic rule tests;
3. implement the owning rule or application service;
4. validate the Foundry behavior;
5. audit the dependency boundary;
6. add or update content contracts and E2E coverage where applicable;
7. document the resulting current state.

The immediate technical priority is closing the runtime boundary for already
structured CRD mechanics, not another broad architectural rewrite.
