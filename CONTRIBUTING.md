# Contributing to Cypher for Foundry VTT

Thanks for considering a contribution. This project is a small, unofficial Foundry VTT system,
so the process is intentionally lightweight — but a few conventions keep the codebase
consistent as more people touch it.

## Contents

- [Getting set up](#getting-set-up)
- [Coding conventions](#coding-conventions)
  - [JSDoc: English only](#jsdoc-english-only)
  - [Inline implementation comments](#inline-implementation-comments)
  - [Localization](#localization)
- [Rebuilding compendium packs](#rebuilding-compendium-packs)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Reporting bugs](#reporting-bugs)

## Getting set up

1. Clone the repository into your Foundry `Data/systems/` directory (or symlink it there) so
   Foundry can load it as a system. See [`README.md`](README.md#installation) for details.
2. No build step is required to run the system — `.mjs` modules are loaded directly by Foundry.
   A build step (`@foundryvtt/foundryvtt-cli`) is only needed when regenerating compendium
   packs; see [Rebuilding compendium packs](#rebuilding-compendium-packs).
3. There is currently no automated test suite. Changes should be manually verified in a live
   Foundry world before opening a PR — see the [known limitation](CHANGELOG.md#known-limitations)
   noted in the changelog.

## Coding conventions

### JSDoc: English only

Every exported class, method, and function in a `.mjs` file should carry a JSDoc block
(`/** ... */`) written **in English only**, with `@param` and `@returns` tags where applicable.
This applies uniformly across the whole codebase — data models, documents, sheets, and the
system entry point alike.

Rationale: JSDoc is API-facing documentation, read by anyone extending or debugging the system
regardless of their spoken language, and by IDE tooling that doesn't distinguish languages.
Keeping it in a single language avoids inconsistent, half-translated blocks and matches the
convention used by the Foundry core API and by reference systems such as `dnd5e`.

```js
/**
 * Rolls an attack using this weapon and delegates task resolution to the parent actor.
 *
 * @param {object} [options={}] Attack-roll options.
 * @param {number} [options.effortLevels=0] Number of Effort levels to spend.
 * @returns {Promise<object>|undefined} The actor task-roll result.
 */
async rollAttack({ effortLevels = 0 } = {}) { /* ... */ }
```

This convention is being rolled out across the codebase; some files may still contain bilingual
JSDoc blocks predating it (see the changelog). New and edited code must follow it; existing
bilingual JSDoc should be converted to English-only opportunistically when a file is touched
for another reason, rather than left as-is.

### Inline implementation comments

The project's existing style of pairing a French and an English line for non-JSDoc,
in-body `//` comments (explaining a non-obvious rule interaction or a Foundry quirk) is
unaffected by the JSDoc convention above and may continue to be used. If you're unsure whether
a given comment counts as JSDoc (convert to English) or an inline implementation note (bilingual
is fine), JSDoc is anything inside a `/** */` block directly preceding a declaration; everything
else is an inline comment.

### Localization

- No UI string may be hardcoded. All player-facing text goes through `game.i18n`, with entries
  added to both `lang/en.json` and `lang/fr.json` in the same PR.
- Follow the existing key structure (`CYPHER.<Category>.<Key>`) rather than introducing a new
  top-level namespace.

## Rebuilding compendium packs

Compendium sources live as individual JSON files under `packs/<pack-name>/_source/`. To compile
them into the LevelDB format Foundry actually loads:

```sh
npm install --no-save @foundryvtt/foundryvtt-cli

npx fvtt package pack -n descriptors-en --in packs/descriptors-en/_source --out /tmp/out-en
cp /tmp/out-en/descriptors-en/* packs/descriptors-en/

npx fvtt package pack -n descriptors-fr --in packs/descriptors-fr/_source --out /tmp/out-fr
cp /tmp/out-fr/descriptors-fr/* packs/descriptors-fr/
```

Notes:

- The CLI nests its output under `<out>/<pack-name>/`; move its contents up to
  `packs/<pack-name>/`, which is what `system.json` points to directly.
- Every source file needs a `_key` field formatted as `!items!<_id>` (or `!actors!<_id>`, etc.)
  — the CLI silently skips files missing it.
- When a generator script exists for a pack (e.g. `scripts/generate-descriptors.py` for
  Descriptors), regenerate sources through the script rather than hand-editing the JSON, so the
  script remains the single source of truth.

## Commit messages

Keep the subject line short and imperative ("Fix armor speed hindrance", not "Fixed a bug
where..."). Reference the relevant `CHANGELOG.md` entry in the PR description rather than in
every commit.

## Pull requests

- Update `CHANGELOG.md` under `[Unreleased]` as part of the PR — new entries under the relevant
  `Added` / `Changed` / `Fixed` heading.
- If the change affects both languages (a new sheet field, a new mechanic), update `lang/en.json`
  and `lang/fr.json` together.
- Describe how the change was tested (which sheet, which action) given the lack of an automated
  test suite.

## Reporting bugs

Open an issue with the Foundry version, browser, and system version (`system.json`'s
`version` field) you're running, along with steps to reproduce. If the bug involves a specific
character sheet state, attaching an actor export is very helpful.
