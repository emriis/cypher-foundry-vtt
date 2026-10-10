# Cypher Foundry VTT working agreements

Read `CONTRIBUTING.md`, `docs/development.md`, and `docs/architecture.md` before
substantial work. Documentation, identifiers, and JSDoc are English; answer
the user in their language. Follow the user's authorized scope and preserve
their existing edits.

## Architecture and ESM

- Follow `docs/code-comments.md`: explain purpose, public contracts, important
  phases, units, side effects, and surprising Foundry behavior for a new reader.
  Update comments with code changes, remove stale/duplicate claims, and avoid
  narrating obvious statements. Review meaning rather than comment counts.

- Browser/Foundry runtime: `cypher.mjs` and `module/`. Node tooling: `scripts/`
  and `tests/`. Use explicit `.mjs` extensions in relative imports and `node:`
  prefixes for Node built-ins. Do not import Node APIs into browser modules.
- `module/rules/`: pure deterministic calculations, no Foundry/browser globals.
- `module/applications/`: Foundry orchestration, validation, and persistence.
- `module/documents/`: thin compatibility facades; `module/data-models/`:
  schemas and derived preparation. Never update documents during preparation.
- `module/sheets/`: input and presentation; use ApplicationV2 actions and keep
  Handlebars free of business rules. Registrations/hooks belong in the bootstrap.
- Await state mutations. Parallelize independent reads, not writes to the same
  Pool/document. Verify version-sensitive APIs against official V13/V14 docs.

## Content and state

- Use `docs/crd-source-schema.md` and the compendium skill for source authority,
  full source-faithful descriptions, provenance, stable IDs, and EN/FR pairing.
  Do not infer mechanics from localized names or descriptive prose.
- Player-facing text must have matching EN/FR locale keys.
- Preserve synthetic Actors when resolving token targets. Validate permissions,
  costs, and prerequisites before mutation; cancelled/rejected actions spend
  nothing. Do not invent resource stores or adjacency measurements.
- `docs/local/` is private and may be a junction. Do not copy, publish, replace,
  or delete it. Never hand-edit generated LevelDB packs.

## Validation and change scope

- Record initial Git status. Test behavior at the lowest useful layer; use
  regression tests for changed rules and persisted-state boundaries.
- `npm test` normalizes sources and runs the complete suite in a temporary
  checkout. `npm run test:all` and focused suites run against current sources.
- `npm run lint`, `npm run typecheck`, `npm run audit:architecture`, and syntax
  checks do not rewrite source files. Type checking is an explicit pilot scope.
- `npm run test:e2e` builds and runs Foundry in a temporary checkout and Data
  directory. `FOUNDRY_DATA_PATH` is a read-only license-source hint.
- `migrate:packs`, `build:packs`, and `package` explicitly mutate checkout
  sources or generated artifacts. Use them here only for intended authoring or
  artifact changes; otherwise validate in isolation. Never clean unrelated edits.
- Report unit/content tests, builds, and observed live Foundry results separately.
  Update `compatibility.verified` only after successful validation on that version.
- Before finishing, compare Git status with the initial state and explain every
  changed file family. Commit, push, merge, or release only when requested.

## Skills and prompts

Discoverable skills are in `.agents/skills/`. Existing Foundry/Cypher procedures
remain maintained in `.github/skills/`; their Codex entrypoints link to them.
Load only the workflows relevant to the task:

- `cypher-esm-runtime`: `.mjs` runtime/tooling implementation and review.
- `foundry-document-transactions`: multi-document actions and resource costs.
- `cypher-validation-isolated`: tests, builds, E2E, and scoped-branch validation.
- Existing skills: rules/TDD, sheets/UI, schema migrations, compendiums, Focus
  graphs, live validation, local references, and GitHub Actions/releases.

Task templates are under `.github/prompts/`. Instructions define invariants;
skills define reusable procedures; prompts describe a concrete task.
