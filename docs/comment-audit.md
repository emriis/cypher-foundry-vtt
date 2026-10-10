# Comment audit — 2026-10-10

## Scope and method

The inventory covered 77 production/tooling ESM files (`cypher.mjs`, `module/`,
and `scripts/`), including 131 exported function declarations. Configurations,
test setup, packaging shells, Handlebars bindings, and CSS comments were also
examined. Generated packs and private `docs/local/` references were excluded.

The inventory located missing JSDoc; focused reading checked public contracts
and the important beginner entry points: task rolls, weapon abilities, active
effects, PC preparation, sheet dispatch, import, and validation/packaging.
Comment presence is a navigation aid, not a measurement of explanation quality.

## Findings and changes

| Finding | Correction |
| --- | --- |
| 18 exported functions had no adjacent JSDoc. | Added contracts for active effects, recovery conditions, Item actions, import mapping, shared fields, and tooling APIs. |
| Cypher table documentation appeared above the variant function. | Moved/revised it beside the table function, including the no-matching-range outcome. |
| Rally promised a result object; recovery's returned value was imprecise. | Documented Rally's void completion and recovery's evaluated Roll. |
| Foundry concepts and action order were implicit in central flows. | Explained saved/derived data, references, synthetic targets, sheet context/actions, shared Edge, and write ordering. |
| A local activation guard could be mistaken for a document transaction. | Documented its client scope and the absence of rollback after partial writes. |
| Script effects and cleanup ownership were difficult to discover. | Explained read-only checks, source/artifact writes, temporary staging, dependency links, and cleanup phases. |
| Item-sheet and stylesheet comments were duplicated or stale. | Removed duplicates, corrected the font fallback description, and removed unsupported contrast verification wording. |
| Existing contribution guidance was too brief to maintain this quality. | Added `code-comments.md` and linked it from contributing/development and shared agent instructions. |

Existing useful comments were retained. Straightforward helpers and declarative
fields were not annotated line by line. JSON and generated databases were not
modified. Tests keep their existing behavioral explanations and fixed dice inputs.

## Validation

- All 131 inventoried exported functions now have adjacent JSDoc.
- Syntax-tree comparison of the 28 changed ESM files found no executable changes.
- Removing comments from the changed CSS/template left their content unchanged.
- Packaging shell instructions were unchanged after removing comments; PowerShell
  syntax passed. The optional Bash syntax check was unavailable because the local
  WSL service refused access.
- ESLint, the current type-check pilot, architecture audit, and system syntax
  checks passed.
- The complete isolated Node suite passed: 490 tests, no failures.
- Live Foundry was not rerun: the change affects comments/documentation only.

Use the review checklist in [code-comments.md](code-comments.md) for subsequent
changes. This audit is a dated record, not a claim that a JSDoc count guarantees
future accuracy or beginner comprehension.
