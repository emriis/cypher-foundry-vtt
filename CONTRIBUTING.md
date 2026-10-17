# Contributing to Cypher for Foundry VTT

Thanks for contributing. This project is an unofficial Foundry VTT system, and
the repository uses explicit source, architecture, testing, and provenance
contracts to keep the codebase maintainable.

## Contents

- Getting set up
- Coding conventions
- Rebuilding compendium packs
- Testing
- Commit messages
- Pull requests
- Local path and privacy rules
- Reporting bugs

## Getting set up

1. Clone the repository.
2. Install dependencies with npm install.
3. Run npm test.
4. If the change depends on Foundry runtime behavior and a locally activated
   Foundry installation is available, run npm run test:e2e.

The system is loaded from the repository during development. Generated release
artifacts are not the editing surface.

Shared agent instructions are in `AGENTS.md`. `npm test` normalizes and tests a
temporary copy; `npm run test:e2e` also builds and launches Foundry in temporary
storage. Explicit source migrations, builds, and packaging still modify this
checkout and should be used here only for intended content/artifact changes.

## Coding conventions

### JavaScript

- Use modern JavaScript modules already supported by the repository.
- Follow the existing module and directory boundaries.
- Keep deterministic rules free of Foundry globals.
- Keep application services responsible for Foundry-aware orchestration.
- Preserve public compatibility facades unless a deliberate breaking change is
  documented.
- Prefer small, focused functions and explicit data transformations.

### JSDoc and comments

Repository documentation, JSDoc, and implementation comments are written in
English.

Follow [the comment standard](docs/code-comments.md). Explain module purpose,
public contracts, important phases, and non-obvious decisions so a developer
new to JavaScript/Foundry can follow an action through the layers. Document
units, rejection outcomes, side effects, and async ordering where relevant.

Update comments alongside behavior changes; remove stale or duplicate claims.
Review accuracy and usefulness rather than counting comment lines. The guide
includes a reading path, glossary, examples, and a review checklist.

### Localization

Author UI text in matching domain files under `lang/src/en/` and `lang/src/fr/`.
Run `npm run build:lang` to assemble the native Foundry bundles `lang/en.json`
and `lang/fr.json`, then `npm run check:lang`. Do not edit the bundles directly.

Do not add new hardcoded UI text when a localized string is appropriate.

Follow [the localization guide](docs/localization.md) for the glossary,
interpolation contracts, complete French compendium proposals, and source
freshness checks. Translation text never determines a document identity or a rule.

## Rebuilding compendium packs

Editable records derived from the CRD are stored under paired:

    packs/<family>-en/_source/
    packs/<family>-fr/_source/

Do not edit generated LevelDB files manually.

For CRD-derived content:

The supplied CRD is the sole authority for rules and compendium content;
editable sources and tests must follow it. Other references may help render
its wording, but must not introduce or override content or mechanics.

1. preserve the source-backed mechanics;
2. preserve stable logical IDs;
3. preserve CRD provenance;
4. keep English/French mechanical data aligned;
5. write complete French proposals against the canonical English field under
   `translations/fr/`, preserving every condition, number, unit and exception;
6. use an existing translation only after checking it against the supplied CRD,
   and keep unresolved wording explicitly proposed rather than guessing rules.

Run:

    npm run migrate:packs
    npm run test:content
    npm run build:packs

## Testing

Use `npm run test:runtime` for fast rules, services, documents, DataModels and
behavior regressions. Whole-catalogue normalization contracts have their own
`npm run test:sources` lane. `npm test` includes both in a normalized temporary
checkout. Build validation (`npm run test:build`) requires compiled packs and
extracts them rather than just checking for LevelDB filenames.

Use the lowest test layer that expresses the behavior:

- tests/rules/ for deterministic rules, including Given/When/Then examples in scenarios/
- tests/applications/ for application services
- tests/documents/ for Foundry document boundaries
- tests/data-models/ for schemas and derived preparation without persistence
- tests/content/ for source and compendium contracts
- tests/integration/ for cross-module behavior
- tests/behaviors/ for vertical contracts spanning application services and state changes
- tests/e2e/ for real Foundry/browser behavior

Start rule changes with a failing deterministic test whenever possible.

Do not weaken tests to accommodate an incorrect implementation. Prefer business
invariants and stable contracts over generated IDs, ordering, or incidental
source layout.

Run the complete suite with:

    npm test

Run the real Foundry E2E suite with:

    npm run test:e2e

Also run `npm run lint` and `npm run typecheck` for JavaScript changes. The
JSDoc checker covers the explicit pure-rule pilot in `jsconfig.rules.json`.

The E2E runner creates a marked temporary checkout and Foundry user-data
directory, copies activation metadata without printing it, and builds/tests
there. It removes only its owned workspace after stopping Foundry. The user's
normal Data directory is not an installation or cleanup target.

## Commit messages

Use concise imperative commit messages. Preferred prefixes include:

- feat:
- fix:
- refactor:
- test:
- docs:
- ci:
- chore:

Keep unrelated changes in separate commits when practical.

## Pull requests

A pull request should:

- explain the user-visible or architectural purpose;
- identify relevant tests;
- update source/content contracts when applicable;
- update documentation when the current-state behavior changes;
- avoid unrelated generated-file churn;
- preserve the project's license and provenance requirements.

Do not merge a change merely because a single focused test passes. Run the
appropriate complete contract suite for the affected boundary.

## Local path and privacy rules

docs/local/ is a private local-reference directory.

It may be a junction or symlink to storage outside the repository. Preserve the
path and target. Never add, stage, force-add, or publish its contents.

The E2E runner is subject to the same principle: it may create and remove only
its own disposable cypher-e2e-* worlds. It must not perform destructive cleanup
of the user's general Foundry data.

## Reporting bugs

Include:

- Foundry version;
- system version or commit;
- reproduction steps;
- expected behavior;
- actual behavior;
- relevant console errors;
- whether deterministic tests and/or E2E reproduce the problem.

For CRD/content issues, include the source section or provenance information
when available.
