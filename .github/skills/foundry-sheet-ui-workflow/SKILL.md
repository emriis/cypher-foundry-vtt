---
name: foundry-sheet-ui-workflow
description: 'Use when adding, changing, reviewing, or debugging Foundry VTT ApplicationV2 sheets, Handlebars templates, dialogs, CSS, responsive layout, accessibility, themes, form submission, tabs, drag and drop, or player-facing controls in this Cypher system.'
---

# Foundry sheet and UI workflow

Use this workflow for changes under `module/sheets/`, `templates/`, or `css/`, and for document behavior exposed through a sheet or dialog. Also follow `cypher-rule-tdd` when the interaction changes game behavior, and `foundry-live-validation` for rendered or interactive checks.

## Trace the interaction

1. Read `DESIGN-SYSTEM.md`, the owning ApplicationV2 sheet, its template parts, nearby CSS, the matching EN/FR domain files under `lang/src/`, and the closest document method or test. Follow `docs/localization.md` for domain ownership and the shared glossary.
2. Trace the complete path before editing: prepared context, rendered field or `data-action`, action handler, document update, and rerendered state.
3. For forms using `submitOnChange`, preserve every persisted `ArrayField` subfield in submitted markup. Foundry replaces arrays as a whole; omitted hidden values can silently erase data.
4. Verify version-sensitive ApplicationV2 APIs against current official Foundry documentation rather than copying an AppV1 pattern.

## Implement

- Keep deterministic calculations in `module/rules/` and Foundry orchestration
  and persisted mutations in `module/applications/`. Documents are thin
  compatibility facades; DataModels define schemas and derived values. Sheets
  collect input, invoke services/facades, and present results. Never call
  `update` or `setFlag` during data preparation.
- Register actions in `DEFAULT_OPTIONS.actions`; keep template `data-action` names aligned with those registrations.
- Prepare display data in `_prepareContext` or `_preparePartContext` rather than embedding business logic in Handlebars.
- Use `game.i18n` and matching keys in the paired `lang/src/en/` and
  `lang/src/fr/` domains for every player-facing string. Run `build:lang` and
  `check:lang`; `lang/en.json` and `lang/fr.json` are compiled native Foundry
  bundles, not the authoring surface. Preserve interpolation variables.
- Use the confirmed French activation labels `Action réflexe`, `Action` and
  `Action lente`; distinguish these classes from ordinary chronological wording.
  Present enum values through localized labels without changing stored values.
- Foundry's client Language Preference selects interface text. Existing imported
  world documents keep their language; choose the EN/FR compendium family for
  content and do not imply that changing the UI rewrites those documents.
- Reuse the tokens and component patterns in `DESIGN-SYSTEM.md`. Do not hardcode colors, font sizes, or spacing when a project token exists.
- Preserve keyboard access, visible focus, minimum target sizes, reduced motion, light/dark themes, and non-color status cues.

## Validate

1. Add or update the narrowest deterministic behavior test when the interaction delegates to testable document logic. Run it before and after the implementation.
2. Run lint, architecture checks, and isolated `npm test` for behavior or data-flow changes.
3. Follow `foundry-live-validation` in a disposable world. Exercise the changed control with mouse and keyboard, then verify persistence after rerender and reload.
4. Check both locales and light/dark themes when labels, layout, or styles changed. Inspect the client console for errors.
5. Test the narrowest relevant viewport or sheet size and confirm dynamic text does not overlap or resize fixed controls.

## Report

Separate automated behavior checks from rendered Foundry verification. State the interaction, document type, locale, theme, Foundry version, persistence result, and any unavailable keyboard or viewport coverage.
