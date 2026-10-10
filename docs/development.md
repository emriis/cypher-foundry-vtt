# Development Guide

This guide describes the current development and validation workflow for the
repository. It is intentionally separate from the historical architecture
roadmap.

## Copilot support

Repository-wide Copilot guidance lives in `.github/copilot-instructions.md`.
The project-specific expert agent is defined in `.github/agents/`, and
reusable procedures live in `.github/skills/`.

Codex loads `AGENTS.md` and discovers skills under `.agents/skills/`. Existing
entrypoints link to maintained `.github/skills/` procedures. New ESM runtime,
document-transaction, and isolated-validation skills live in `.agents/skills/`.
Task prompts also cover runtime implementation, review, roadmap audit, and
scoped-branch preparation.

Optional user-provided reference documents may be placed in `docs/local/`.
That directory is ignored by Git and is private to the local checkout.

## 1. System implementation

For a beginner's reading path and the required comment quality, follow
[Code comments and reader guidance](code-comments.md). Use its review checklist
for new modules and changes to existing behavior, including tooling and tests.

Use Node 22 for tooling, matching CI (`.nvmrc`). ESLint requires at least
22.13 in that release line; Node 24+ is also accepted by the package's engine
contract. These tooling versions do not describe Foundry's browser runtime.

Read `docs/architecture.md` before a change crosses document, rule,
application, sheet, migration, or compendium boundaries.

| Concern | Location |
| --- | --- |
| System manifest and startup | `system.json`, `cypher.mjs` |
| Foundry document APIs | `module/documents/` |
| Gameplay application services | `module/applications/` |
| Pure Cypher rules | `module/rules/` |
| Actor and Item schemas | `module/data-models/` |
| Foundry applications and UI | `module/sheets/`, `templates/`, `css/` |
| Localization | `lang/` |
| Compendium source | `packs/*/_source/` |
| Pack/build tooling | `scripts/` |
| Automated tests | `tests/` |

### TDD and BDD boundary

The CRD is the sole authority for game rules and compendium content. Define
observable Given/When/Then scenarios from that source before changing behavior.
For a defect, demonstrate RED, implement GREEN, then refactor while green. For
a behavior-preserving extraction, establish passing characterization tests
before moving code. See [the runtime refactor contracts](runtime-refactor.md).

Rule changes should begin with a deterministic test whenever the behavior can be
expressed without Foundry.

Use the test layers according to the behavior:

- `tests/rules/`: pure rule contracts;
- `tests/applications/`: application-service behavior;
- `tests/documents/`: document compatibility and persistence boundaries;
- `tests/content/`: source, schema, identity, provenance, bilingual pairing,
  and mechanical fidelity contracts;
- `tests/integration/`: cross-module behavior;
- `tests/behaviors/`: business/BDD-style vertical behavior contracts;
- `tests/e2e/`: real Foundry and browser behavior.

Do not weaken a contract test merely to make extraction or packaging pass.
Prefer assertions on stable business invariants over incidental compendium order
or generated UUIDs.

### Recommended feature workflow

1. Identify the supplied CRD version and rule section.
2. Add the smallest failing deterministic test.
3. Implement the rule or application behavior.
4. Add content contracts if source data is involved.
5. Add a behavior test for the user-visible business rule.
6. Add E2E coverage when the real Foundry runtime or UI is part of the contract.
7. Run the architecture audit when boundaries changed.
8. Update documentation only after the implementation state is established.

## 2. Compendium content

Editable records live in paired `_source/` directories. The CRD remains the
sole authority for their content; JSON records are the authoring surface.

Do not edit generated LevelDB files manually.

For CRD-derived records:

- preserve the CRD source text and mechanics;
- assign a stable language-neutral logical ID;
- preserve structured mechanics in the Item schema whenever the model supports
  them;
- record CRD provenance;
- keep English and French records mechanically equivalent;
- use the Character Book translation only when it faithfully corresponds to the
  CRD content;
- otherwise retain the English source text for later translation rather than
  inventing a translation.

Run:

```powershell
npm run migrate:packs
npm run test:content
npm run build:packs
```

`npm test` copies the checkout (including uncommitted edits), normalizes sources
and runs the complete suite there, then removes its owned temporary directory.
It does not rewrite the working checkout. `test:all` and focused suites test
current sources without normalization. Explicit `migrate:packs`, `build:packs`,
and `package` still change this checkout's sources or generated artifacts.

## 3. Validation and CI

Useful local commands are:

```powershell
npm test
npm run lint
npm run typecheck
npm run test:unit
npm run test:content
npm run test:integration
npm run test:behavior
npm run audit:architecture
npm run audit:public-data
npm run check:system-syntax
npm run check:e2e-syntax
npm run check:e2e-browser
npm run test:e2e
npm run package
```

`npm run test:e2e` is a real Foundry/Playwright run. It is not a substitute for
deterministic tests and is kept separate because it requires a locally activated
Foundry installation.

The E2E runner owns a temporary checkout and Foundry user-data directory.
Builds and installation happen there. It reads activation metadata from the
configured installation but never writes its settings, worlds, or systems.
Cleanup checks the temporary workspace's ownership marker before removal.
Failure diagnostics are retained under ignored `reports/` paths.

### ESM and static checks

`eslint.config.mjs` separates Node tooling/tests, Foundry browser modules, and
pure rules/source helpers. It checks undefined globals, duplicate keys,
unreachable code, explicit relative `.mjs` imports, and Node imports in browser
modules. Test doubles are declared in test configuration; pure rules do not
inherit browser or Foundry globals.

`npm run typecheck` uses TypeScript's `allowJs`/`checkJs` and `noEmit` on the
explicit scope in `jsconfig.rules.json` (weapon Ability resolution, task costs,
task outcomes, and reroll selection). It checks
existing `.mjs` and JSDoc without introducing a TypeScript runtime or claiming
full-system typing. Expand this pilot with accurate contracts, not broad `any`
declarations for Foundry. CI runs both checks on Node 22.

## 4. Release checklist

Before a release:

1. run the complete automated test suite;
2. run content and architecture audits;
3. compile packs;
4. build the distributable package;
5. verify generated artifacts;
6. run live E2E validation when a local activated Foundry installation is
   available;
7. verify license/attribution and public-data constraints;
8. update `CHANGELOG.md`.

Generated LevelDB packs and release artifacts are build outputs. Source records
remain the editable authoring surface; the CRD is their content authority.

## 5. Architecture maintenance

The broad architecture refactor is complete. Do not reopen the completed
Phase 1-8 work as a standing task.

When a feature introduces a new boundary:

- keep deterministic logic below Foundry-aware orchestration;
- keep compatibility facades thin;
- keep DataModels declarative;
- keep source content deterministic and provenance-backed;
- avoid making Journals a second source of truth;
- resolve stable source references before runtime UUID references;
- add tests at the lowest useful layer before adding E2E coverage.

Current architectural work is driven by real feature gaps, especially runtime
consumption of structured CRD mechanics.
