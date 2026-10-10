---
name: cypher-esm-runtime
description: Implement or review JavaScript ESM runtime and Node tooling in this Cypher Foundry repository, respecting execution environments, layer boundaries, async state changes, and focused tests.
---

# Cypher ESM runtime

Read `AGENTS.md` and `docs/architecture.md`. Identify whether each touched module
runs in Foundry's browser, Node, or the pure rules layer before changing imports.

- Use explicit relative `.mjs` imports. Keep Node APIs (`node:*`, `process`,
  filesystem paths, `import.meta.dirname`) in scripts/tests, not Foundry code.
- Keep deterministic rules importable without stubbing Foundry. Put document
  reads, dice, chat, and mutations in application services; preserve thin facades.
- Avoid import-time side effects except deliberate startup registrations. Test
  doubles must be established before importing modules that need runtime globals.
- Await mutations and surface failures. Do not use concurrent writes to the
  same Actor/Item or assume several document updates are one atomic transaction.
- Add JSDoc for public contracts, null/optional values, and ownership boundaries.
  Do not silence type errors with broad `any` declarations or fake Foundry APIs.

Use focused rule/application tests, then `npm run lint`, `npm run typecheck`,
`npm run audit:architecture`, and `npm test`. The type checker currently covers
an explicit pure-rule pilot; expand it only with accurate contracts.

For costs, target Actors, or resource persistence, also use
`foundry-document-transactions`. For rendered UI, use the sheet and live
validation procedures linked by `AGENTS.md`.
