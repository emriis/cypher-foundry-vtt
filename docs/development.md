# Development Guide

This repository has four separate areas of work. Use the workflow that matches
the change; do not edit generated release artifacts in `dist/`.

## Copilot support

Repository-wide Copilot guidance lives in `.github/copilot-instructions.md`.
The project-specific `Cypher Foundry VTT Expert` agent is defined in
`.github/agents/`; reusable procedures for rule TDD, compendium changes, and
GitHub Actions/releases live in `.github/skills/`.

Optional user-provided reference documents can be placed in `docs/local/`.
That directory is excluded from Git, so its contents are available only in the
local checkout and are not included in pull requests or CI.

## 1. System implementation

Use this flow when changing a Foundry feature or a game rule. Read
`docs/architecture.md` first when a change crosses document, rule,
application, sheet, migration, or compendium boundaries.

| Concern | Location |
| --- | --- |
| System manifest and startup | `system.json`, `cypher.mjs` |
| Foundry document behavior and compatibility facades | `module/documents/` |
| Foundry-aware application use cases | `module/applications/` |
| Pure Cypher rules and deterministic calculations | `module/rules/` |
| Actor and Item schemas | `module/data-models/` |
| Foundry applications and UI actions | `module/sheets/` |
| Handlebars markup | `templates/` |
| Styles and translations | `css/`, `lang/` |
| Automated tests | `tests/rules/`, `tests/behaviors/`, `tests/applications/`, `tests/documents/`, `tests/content/`, `tests/migrations/`, `tests/integration/`, `tests/e2e/` |

For a rule change, update the owning document or data model, add or update its
test, then run:

```powershell
npm test
```

Keep `cypher.mjs` limited to Foundry registrations and thin global hooks.
It is not the place for game-rule calculations or sheet actions.

### TDD and BDD boundary

Use **TDD** for deterministic game mechanics in `module/rules/`. A rule
change should start with the smallest failing test that describes the required
mechanic, followed by the implementation and then cleanup. Prefer boundary
cases and invariant-based assertions over large fixture snapshots.

Use **BDD-style tests** for player-facing gameplay behavior. These tests live
in `tests/behaviors/` and use nested `Given / When / Then` descriptions with
the Node test runner; no additional Gherkin framework is required. Keep these
tests independent of Foundry Documents and compendium record counts. They
should describe what a player can observe, while rule tests describe the
deterministic calculation underneath.

Run the behavior suite directly with:

```powershell
npm run test:behavior
```

During active Phase C work, prefer batching related changes and running one
consolidated local validation rather than rerunning the full suite after every
individual test file. The recommended final local check is:

```powershell
npm run test:all
```

This covers rules, applications, documents, migrations, content, integration,
and behavior tests. CI runs those categories independently so a failure in one
category does not hide failures in another. The full test suite includes
behavior tests automatically.

Run the architecture-boundary contract when changing module dependencies:

```powershell
node --test tests/integration/architecture-boundaries.test.mjs
```

For a complete static dependency audit, run:

```powershell
npm run audit:architecture
```

The audit checks static and dynamic local imports against the architectural layer contract. It also checks development scripts for accidental dependencies on Foundry Documents or Sheets. Treat a failed audit as an architectural defect: do not broaden an allow-list merely to make the check pass.

This test checks allowed layer imports, root compatibility-facade boundaries,
rule independence from Foundry globals, and development-script independence
from Documents and Sheets. Do not weaken the contract to accommodate a new
dependency; move the dependency to the layer that owns the responsibility.

When adding a new gameplay use case, first decide whether the deterministic part
belongs in `module/rules/` and whether Foundry orchestration belongs in
`module/applications/`. Keep the Actor method as a small compatibility facade when
existing callers already use it. Application services should have English JSDoc
and short inline comments for non-obvious Foundry or rules interactions so a new
contributor can follow the control flow without relying on tribal knowledge.
If a helper only maps data and does not need Foundry state, keep it in
`module/rules/` instead of adding another Actor compatibility method; for example,
stat lookup belongs to `rules/stats.mjs`.
For Type/Focus content, resolve persisted ability references through
`module/applications/reference-resolver.mjs` before copying mechanics to an actor.

## 2. Compendium content

Use this flow when adding or revising game content rather than system behavior.

| Content form | Location | Ownership |
| --- | --- | --- |
| Editable Descriptor sources | `packs/descriptors-{en,fr}/_source/` | Source of truth |
| Foundry-readable LevelDB packs | `packs/descriptors-{en,fr}/` | Generated package input |
| Editable Ability sources | `packs/abilities-{en,fr}/_source/` | Source of truth |
| Editable Type sources | `packs/types-{en,fr}/_source/` | Source of truth |
| Editable Focus sources | `packs/foci-{en,fr}/_source/` | Source of truth |

Edit matching English and French JSON records directly. Preserve paired
filenames, valid 16-character Foundry IDs and `_key` values, mechanical data,
and the structure required by the relevant Item DataModel. Consult the current
CRD for mechanics and the French Character Book for localization; if a required
local reference is unavailable, stop rather than reconstructing content from
memory.

```powershell
node --test tests/content/*.test.mjs
```

The content contract suite validates the common CRD source envelope, provenance,
logical identity, and English/French pairing across reusable content families.
Keep these contracts independent from arbitrary record counts so additions do
not require rewriting tests.

Then rebuild each affected LevelDB pack with `npm run build:packs`. The build
script discovers every authored `packs/*/_source/` directory and compiles each
one, replacing only its generated database files. The registered pack list in
`system.json` and the authored source directories must remain consistent as new
content families are introduced. See `docs/crd-content-roadmap.md` for the
planned Player Guide, GM Guide, Quick Reference, genre, and GM libraries. The
`_source/` JSON is the reviewable source of truth; the adjacent LevelDB files
are what Foundry loads because `system.json` declares them directly.

## 3. Development and CI

Development tooling belongs in `scripts/`; GitHub automation belongs in
`.github/workflows/`.

| Automation | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/test.yml` | Push to `main`, pull request, or manual dispatch | Runs independent unit, BDD behavior, content, integration, architecture, pack-build, and repository checks |
| `.github/workflows/build-packs.yml` | Push to `main` or manual dispatch | Normalizes CRD source metadata, validates content, rebuilds, and commits LevelDB compendium packs |
| `.github/workflows/release.yml` | Tag matching `v*` | Tests, checks version/tag parity, packages, publishes GitHub release |
| `scripts/build-packs.mjs` | `npm run build:packs` | Compiles all eight LevelDB packs from `_source/` |
| `scripts/package.ps1` | `npm run package` | Creates local release artifacts in `dist/` |
| `scripts/foundry-discovery.mjs` | Used by `npm run test:e2e` | Discovers and validates the local Foundry executable |
| `scripts/run-foundry-e2e.mjs` | `npm run test:e2e` | Creates a disposable Foundry environment and runs Playwright |

Do not commit `dist/`, transient LevelDB lock/LOG files, or other generated
temporary files. The tracked `package-lock.json` is part of the repository
and should be updated when npm dependencies change. The compiled LevelDB
database files in `packs/<pack-name>/` are generated but intentionally
tracked because Foundry loads those files at runtime.

## 4. Release checklist

The release workflow follows the Foundry history-friendly release model:

1. Update `system.json` `version` and its versioned `download` URL together.
2. Run `npm test` and `npm run package` locally.
3. Inspect `dist/system.json` and `dist/system.zip`.
4. Commit the manifest and implementation/content changes.
5. Push a matching Git tag.
6. GitHub Actions attaches that release's `system.json` and `system.zip`.
7. Register that version-specific manifest URL and release-notes URL in Foundry.

The stable `manifest` URL in `system.json` must continue to use GitHub's
`releases/latest/download/system.json`, while `download` must remain pinned
to the exact release version.

## 5. Architecture maintenance

Keep new code at the lowest layer that can own its responsibility. Pure deterministic mechanics belong in `module/rules/`; Foundry-aware use cases belong in `module/applications/`; persistence boundaries belong in `module/documents/`; presentation and user interaction belong in `module/sheets/`; bootstrap code belongs in `cypher.mjs` and thin adapters. Preserve compatibility facades when they protect existing sheet, macro, or API callers.

When a change crosses layers, update the corresponding architecture-boundary tests and run `npm run audit:architecture` before opening the pull request. The final architecture reference is maintained in `docs/architecture.md`.
