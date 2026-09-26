---
name: cypher-rule-tdd
description: Use when changing Cypher mechanics or Foundry system behavior; guide test-first implementation, compatibility, localization, and license-aware validation.
---

# Cypher rule change with TDD

Use this workflow for game-rule changes and behavior changes in the Foundry
system. Read `docs/development.md`, the owning module, and the related tests
before editing. Check `docs/local/` for a relevant local reference document
when the rule or terminology depends on one.

## Workflow

1. Identify the intended rule and the authoritative source available in the
   repository. Preserve the system's wound-based model and existing terminology.
   If the rule is ambiguous, ask before choosing between materially different
   mechanics.
2. Identify the owning layer: schemas in `module/data-models/`, persisted rules
   in `module/documents/`, sheet actions in `module/sheets/`, markup in
   `templates/`, and UI translations in `lang/`.
3. Add or update a deterministic test in `tests/` that captures observable
   expected behavior, including relevant boundaries or regressions.
4. Run that test first and verify it fails for the intended reason (RED), not
   from a broken fixture or unrelated setup.
5. Make the smallest complete implementation that passes the test (GREEN).
   Keep game rules out of `cypher.mjs`, which is for startup registrations and
   global hooks.
6. Refactor only while the focused test remains green. Run the focused test and
   then `npm test`.
7. If changing persisted schema, inspect defaults, existing world data, and
   migration needs. Update both locales for any player-facing strings.
8. Report automated results separately from manual verification still needed
   in a live Foundry VTT V13/V14 world.

## License and content

Preserve Cypher Open License attribution and notices. Implement mechanics and
write original summaries; do not copy substantial CRD prose into code, tests,
translations, or compendium content. If a material license interpretation is
unclear, state the uncertainty instead of presenting legal advice.
