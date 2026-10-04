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
| Automated rules checks | `tests/` |

For a rule change, update the owning document or data model, add or update its
test, then run:

```powershell
npm test
```

Keep `cypher.mjs` limited to Foundry registrations and thin global hooks.
It is not the place for game-rule calculations or sheet actions.

When adding a new gameplay use case, first decide whether the deterministic part
belongs in `module/rules/` and whether Foundry orchestration belongs in
`module/applications/`. Keep the Actor method as a small compatibility facade when
existing callers already use it. Application services should have English JSDoc
and short inline comments for non-obvious Foundry or rules interactions so a new
contributor can follow the control flow without relying on tribal knowledge.
If a helper only maps data and does not need Foundry state, keep it in
`module/rules/` instead of adding another Actor compatibility method; for example,
stat lookup belongs to `rules/stats.mjs`.

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
node --test tests/compendium-sources.test.mjs
```

Then rebuild each affected LevelDB pack with `npm run build:packs`. The build
script compiles all eight packs from their `_source/` directories and replaces
only their generated database files. The `_source/` JSON is the reviewable
source of truth; the adjacent LevelDB files are what Foundry loads because
`system.json` declares them directly.

## 3. Development and CI

Development tooling belongs in `scripts/`; GitHub automation belongs in
`.github/workflows/`.

| Automation | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/test.yml` | Push and pull request | Checks E2E JavaScript syntax and runs `npm test` |
| `.github/workflows/build-packs.yml` | Pack source/build changes | Rebuilds and commits LevelDB compendium packs |
| `.github/workflows/release.yml` | Tag matching `v*` | Tests, checks version/tag parity, packages, publishes GitHub release |
| `scripts/build-packs.mjs` | `npm run build:packs` | Compiles all eight LevelDB packs from `_source/` |
| `scripts/package.ps1` | `npm run package` | Creates local release artifacts in `dist/` |

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
