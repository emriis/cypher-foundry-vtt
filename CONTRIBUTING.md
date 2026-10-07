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

Comments should explain non-obvious decisions, source constraints, or runtime
boundaries rather than restating the code.

### Localization

User-facing strings belong in the localization files.

Do not add new hardcoded UI text when a localized string is appropriate.

## Rebuilding compendium packs

The authoritative content is stored under paired:

    packs/<family>-en/_source/
    packs/<family>-fr/_source/

Do not edit generated LevelDB files manually.

For CRD-derived content:

1. preserve the source-backed mechanics;
2. preserve stable logical IDs;
3. preserve CRD provenance;
4. keep English/French mechanical data aligned;
5. use the Character Book localization only when it faithfully matches the CRD;
6. otherwise retain the English source text rather than inventing a translation.

Run:

    npm run migrate:packs
    npm run test:content
    npm run build:packs

## Testing

Use the lowest test layer that expresses the behavior:

- tests/rules/ for deterministic rules
- tests/applications/ for application services
- tests/documents/ for Foundry document boundaries
- tests/content/ for source and compendium contracts
- tests/integration/ for cross-module behavior
- tests/behaviors/ for business/BDD-style contracts
- tests/e2e/ for real Foundry/browser behavior

Start rule changes with a failing deterministic test whenever possible.

Do not weaken tests to accommodate an incorrect implementation. Prefer business
invariants and stable contracts over generated IDs, ordering, or incidental
source layout.

Run the complete suite with:

    npm test

Run the real Foundry E2E suite with:

    npm run test:e2e

The E2E runner creates only disposable cypher-e2e-* worlds and removes only
those worlds after the run. It does not delete the Foundry Data directory.

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
