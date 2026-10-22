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
| UI localization sources / Foundry bundles | `lang/src/` / `lang/en.json`, `lang/fr.json` |
| French compendium proposals | `translations/fr/` |
| Compendium source | `packs/*/_source/` |
| Pack/build tooling | `scripts/` |
| Automated tests | `tests/` |

### TDD and BDD boundary

For recovery and healing work, follow the source contracts and persistence
boundaries in [recovery-and-healing.md](recovery-and-healing.md). Keep ordinary
recovery order free; test real flag-merge semantics and successful paid rerolls
alongside cancellation, resource limits and fresh target validation.

The CRD is the sole authority for game rules and compendium content. Define
observable Given/When/Then scenarios from that source before changing behavior.
For a defect, demonstrate RED, implement GREEN, then refactor while green. For
a behavior-preserving extraction, establish passing characterization tests
before moving code. See [the runtime refactor contracts](runtime-refactor.md).

Rule changes should begin with a deterministic test whenever the behavior can be
expressed without Foundry.

Use the test layers according to the behavior:

- `tests/rules/`: pure rule contracts, including Given/When/Then examples in `scenarios/`;
- `tests/applications/`: application-service behavior;
- `tests/documents/`: document compatibility and persistence boundaries;
- `tests/data-models/`: schema and derived-preparation contracts without document writes;
- `tests/content/`: source, schema, identity, provenance, bilingual pairing,
  and mechanical fidelity contracts;
- `tests/integration/`: cross-module behavior;
- `tests/behaviors/`: vertical contracts spanning application services and state changes;
- `tests/e2e/`: real Foundry and browser behavior.

Do not weaken a contract test merely to make extraction or packaging pass.
Prefer assertions on stable business invariants over incidental compendium order
or generated UUIDs.

Given/When/Then wording does not determine the layer: a scenario calling only
pure rules belongs under `tests/rules/scenarios/`. Keep detailed service examples
with their application service, leaving representative public API contracts in
the Actor compatibility suite. Exercise derived preparation through its public
entry point, including repeated calls and the prohibition on persistence.

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
- write complete French editorial proposals against the exact English fields,
  with source hashes and explicit review status;
- use another French rendering only when it faithfully corresponds to the CRD;
  leave unresolved editorial or mechanical questions visible for review.

Follow [Localization authoring and review](localization.md) for domain ownership,
the approved action vocabulary, guarded proposals and reviewable previews.
`npm run check:lang` verifies native bundles without rewriting them.
`npm run audit:i18n` normalizes a disposable copy and writes a coverage report;
`npm run preview:translations` also writes French JSON previews under `reports/`.

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

Test files are classified recursively in `scripts/test-suites.mjs`; a test in
an unknown family fails discovery. `test:unit` includes rules, applications,
documents, DataModels and fast migrations. `test:runtime` adds behavior tests;
`test:sources` owns expensive whole-catalogue normalization contracts. `npm test`
includes both lanes plus content and integration contracts. `test:build` reads
compiled outputs and remains explicit, as does the licensed `test:e2e` suite.
Build checks independently normalize expected sources in temporary storage;
the live runner reuses its already normalized, ownership-checked checkout.

`test:coverage` uses the fast runtime lane and reports loaded runtime modules,
including behavior-covered paths. Unimported modules are absent from this report.
The manual mutation command also uses this lane; its threshold remains
informational until an observed baseline is reviewed. See
[test audit remediation](test-audit-remediation.md) for the changed contracts.

The live runner packages and verifies the exact ZIP installed in its disposable
Foundry Data directory. It checks an existing Chromium before attempting an
installation. `--proposed-translations` explicitly includes the French preview
scenarios. Only an ownership-checked temporary checkout may pass the internal
`build:packs -- --normalized-workspace` flag after normalization.

### Rechecking CRD text and automation

The [compendium audit](crd-compendium-audit.md) separates text fidelity, complete
entry boundaries, structured data, and executable behavior. Check each separately;
a valid schema, a chat card, or a matching fragment does not establish completion.

With the private supplied CRD and Python 3 available locally, run:

```powershell
npm run audit:crd
npm run audit:crd -- --normalized --output reports/crd-compendium-audit-normalized.json
```

The first command reads the authored sources. The second normalizes an owned
temporary checkout and checks the distributable content there. Both leave the
authoring sources and private reference unchanged. `--crd` selects a reference
path; `CRD_AUDIT_PYTHON` selects the optional Python interpreter. Reports are
local diagnostics under ignored `reports/`. Exit status zero means that the
report was produced, not that every entry is certified or fully automated.

CI does not require Python or private documents. It checks independently
CRD-reviewed text hashes in `data/crd-text-fidelity.json` and focused source
regressions. Never refresh a hash from a changed pack to make a test pass.
Re-read the corresponding CRD passage, review its boundaries and transformations,
then update the source locator and evidence. Run the live audit again when the
reference changes; reviewed paragraph mappings require the same reference hash.

Fiction-dependent effects require explicit player/GM confirmation before
application and automatic tracking. This is the accepted automation policy,
not a claim that every descriptive Ability or Cypher already executes it. New
effect families need source-backed Given/When/Then contracts covering acceptance,
cancellation, permissions, costs, target writes, and expiration.

## 3. Validation and CI

PR workflows trigger automatically on `pull_request`. Artifact preparation
builds and validates packs and the package in the runner, then uploads
`system.json` and `system.zip` as a `generated-system-<run>-<attempt>` artifact
retained for seven days. It does not commit or push generated files to PR
branches. Release builds still rebuild and publish their own validated package.

This avoids a second **Approve and run workflows** gate after automatic artifact
synchronization: a push made with `GITHUB_TOKEN` creates approval-required PR
workflow runs, even when the original PR belongs to the repository owner. See
[GitHub's token-trigger contract](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs).
The preparation workflow uses read-only repository permissions and checks out
the triggering PR head SHA, so it validates the requested revision.

The approval gate for Copilot-created changes is controlled separately:
repository **Settings → Copilot → Cloud agent → Actions workflow approval**
contains **Require approval for workflow runs**. An administrator can disable
that setting to let these workflows start automatically. See
[GitHub's configuration guide](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/configuring-agent-settings#allowing-github-actions-workflows-to-run-automatically-when-copilot-pushes).
Fork-contributor approval is a different repository setting under **Actions →
General**. Neither setting is changed by adding `workflow_dispatch` or editing
the PR event in YAML.

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

For multi-document fixture creation, identify returned Items by type, stable
key, or explicit fixture role. Do not assign semantic roles from array positions;
the live batch can return them in a different order. The Spray/Arc Spray fixture
replays weapon-first results to cover this failure deterministically. Keep
gameplay assertions on costs, target state, and chat outcomes unchanged.
The automatic `scenarioState` fixture owns each scenario's created documents,
awaits owned sheet closure and chat rendering, and rejects unexpected page
exceptions through teardown. It runs for every spec importing the shared test
type. Avoid local cleanup that can replace the original assertion with a
closed-page error after a timeout.
The disposable browser marks the core welcome tour completed before login,
using the installed tour's step count. Exiting it after startup can race its
delayed rendering and leave an overlay that intercepts gameplay input.

The E2E runner owns a temporary checkout and Foundry user-data directory.
Builds and installation happen there. It reads activation metadata from the
configured installation but never writes its settings, worlds, or systems.
Cleanup checks the temporary workspace's ownership marker before removal.
Failure diagnostics are retained under ignored `reports/` paths.

The local E2E server uses `--noipdiscovery` as well as `--noupnp`: invitation
links do not require external address discovery in a local test run.
Foundry 14.369 can otherwise vend world data before its address lookup finishes,
leaving the first client's bootstrap incomplete. See the
[official command-line options](https://foundryvtt.com/article/configuration/).
Login waits for `game.ready`; a client initialization exception is reported
immediately with its original cause and page state. Bootstrap failures emit
browser diagnostics even when the worker fixture never reaches `afterEach`.
Client-setting init scripts must check the Foundry origin before accessing
localStorage, since Playwright also executes them in opaque documents.

`FOUNDRY_SERVER_PATH` can explicitly select a standalone Foundry `main.js` or
`main.mjs` instead of the desktop installation. The runner reads the version
from that server's own `package.json`; it never automatically selects a pending
update. This supports testing another complete core installation in the same
disposable Data boundary without modifying the active installation.
Windows discovery also checks the current per-user installation under
`%LOCALAPPDATA%/Programs/Foundry Virtual Tabletop/` before legacy installation
locations. Explicit `FOUNDRY_APP_PATH` and read-only `FOUNDRY_DATA_PATH` hints
remain available for other locations.

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

Task modifier, Effort, Edge and per-action cost contracts are maintained in
[task-rolls.md](task-rolls.md). Consult its CRD locators and test the actual
weapon-to-task pipeline before extending task automation.
The standard combat tracker's Speed rolls, NPC target-number initiatives,
PC ties and paid rerolls are documented in [initiative.md](initiative.md).
First/Last phases, waiting and source-turn intervals are documented in
[round-flow.md](round-flow.md).
GM declarations, player requests, mandatory XP sharing, and their resumable
settlement are documented in [intrusions.md](intrusions.md).

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
