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
- `recovery-service.mjs`: recoveries and Rally.
- `advancement-service.mjs`: advancement purchases and tier transitions.
- `character-service.mjs`: XP spending, rerolls, Player Intrusions, and
  character data operations.
- `damage-service.mjs`: damage, wounds, armor, shields, repair, and token
  statuses.
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

```
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

```
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

```
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

For example, weapon `system.mechanics.targetEffects` is extracted, modeled, and
validated, but is not yet fully consumed by the attack runtime. That is an
active implementation gap.

Likewise, Cypher `variants`, `randomRange`, and some structured effect data
are preserved by the content layer, while generic runtime execution is still
being completed.

## 7. ApplicationV2 sheets

The system uses ApplicationV2 for PC, NPC, Community, and Item sheets.

Each document sheet has an explicit ApplicationV2 root template. The root is a
real form part where document submission is required, while detailed sections
are rendered through Handlebars partials.

The PC sheet is a single gameplay dashboard rather than a collection of hidden
primary tabs. Biography, notes, and custom fields remain collapsible.

## 8. E2E architecture

The E2E suite uses Playwright against a real headless Foundry runtime.

The runner:

- packages the system before the live run;
- validates JavaScript syntax and the Playwright browser before startup;
- creates one disposable `cypher-e2e-<timestamp>` world;
- starts Foundry headlessly;
- uses one worker-scoped browser/context/page;
- logs into Foundry as the Game Master once for the worker;
- reuses that session for the E2E suite;
- cleans only generated `cypher-e2e-*` worlds;
- never deletes the user's general Foundry `Data` directory;
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
