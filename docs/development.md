# Development Guide

This repository has four separate areas of work. Use the workflow that matches
the change; do not edit generated release artifacts in `dist/`.

## 1. System implementation

Use this flow when changing a Foundry feature or a game rule.

| Concern | Location |
| --- | --- |
| System manifest and startup | `system.json`, `cypher.mjs` |
| Rules and persisted document behavior | `module/documents/` |
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

Keep `cypher.mjs` limited to Foundry registrations and global hooks. It is not
the place for game-rule calculations or sheet actions.

## 2. Compendium content

Use this flow when adding or revising game content rather than system behavior.

| Content form | Location | Ownership |
| --- | --- | --- |
| Editable descriptor sources | `packs/descriptors-{en,fr}/_source/` | Content author |
| Foundry-readable LevelDB packs | `packs/descriptors-{en,fr}/` | Generated package input |
| Source generator | `scripts/generate-descriptors.py` | Content tooling |
| Editable Type sources | `packs/types-{en,fr}/_source/` | Content author |
| Type source generator | `scripts/generate-types.py` | Content tooling |

Regenerate descriptor JSON after changing the generator:

```powershell
python scripts/generate-descriptors.py
```

For Types, regenerate both language sources with:

```powershell
npm run generate-types
```

Then rebuild each affected LevelDB pack with the Foundry CLI. The `_source/`
JSON is the reviewable source of truth; the adjacent LevelDB files are what
Foundry loads because `system.json` declares them directly.

The Type list follows the genre and subgenre headings in the local Reference
Document. French names and descriptions are working translations for review;
the descriptions are original summaries. Compile `types-en` and `types-fr`
from their respective `_source/` directories before distributing a release.

## 3. Development and CI

Development tooling belongs in `scripts/`; GitHub automation belongs in
`.github/workflows/`.

| Automation | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/test.yml` | Push and pull request | Runs `npm test` |
| `.github/workflows/release.yml` | Tag matching `v*` | Tests, checks version/tag parity, packages, publishes GitHub release |
| `scripts/package.ps1` | `npm run package` | Creates local release artifacts in `dist/` |

Do not commit `dist/`, lock files, or LevelDB logs. They are intentionally
ignored as generated or transient files.

## 4. Release checklist

The release workflow follows the Foundry history-friendly release model:

1. Update `system.json` `version` and its versioned `download` URL together.
2. Run `npm test` and `npm run package` locally.
3. Inspect `dist/system.json` and `dist/system.zip`.
4. Commit the manifest and implementation/content changes.
5. Push a matching Git tag, for example `v0.1.2` for version `0.1.2`.
6. GitHub Actions attaches that release's `system.json` and `system.zip`.
7. Register that version-specific manifest URL and release-notes URL in Foundry's Package Administration page.

The stable `manifest` URL in `system.json` must continue to use GitHub's
`releases/latest/download/system.json`, while `download` must remain pinned to
the exact release version. This lets Foundry detect updates and still lets users
install an earlier release from its history.