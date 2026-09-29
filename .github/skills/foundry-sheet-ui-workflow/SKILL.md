---
name: foundry-sheet-ui-workflow
description: 'Use when adding, changing, reviewing, or debugging Foundry VTT ApplicationV2 sheets, Handlebars templates, dialogs, CSS, responsive layout, accessibility, themes, form submission, tabs, drag and drop, or player-facing controls in this Cypher system.'
---

# Foundry sheet and UI workflow

Use this workflow for changes under `module/sheets/`, `templates/`, or `css/`, and for document behavior exposed through a sheet or dialog. Also follow `cypher-rule-tdd` when the interaction changes game behavior, and `foundry-live-validation` for rendered or interactive checks.

## Trace the interaction

1. Read `DESIGN-SYSTEM.md`, the owning ApplicationV2 sheet, its template parts, nearby CSS, both locale files, and the closest document method or test.
2. Trace the complete path before editing: prepared context, rendered field or `data-action`, action handler, document update, and rerendered state.
3. For forms using `submitOnChange`, preserve every persisted `ArrayField` subfield in submitted markup. Foundry replaces arrays as a whole; omitted hidden values can silently erase data.
4. Verify version-sensitive ApplicationV2 APIs against current official Foundry documentation rather than copying an AppV1 pattern.

## Implement

- Keep rule calculations and persisted mutations in documents or data models. Sheets collect input, invoke the owning behavior, and present results.
- Register actions in `DEFAULT_OPTIONS.actions`; keep template `data-action` names aligned with those registrations.
- Prepare display data in `_prepareContext` or `_preparePartContext` rather than embedding business logic in Handlebars.
- Use `game.i18n` and matching keys in `lang/en.json` and `lang/fr.json` for every player-facing string.
- Reuse the tokens and component patterns in `DESIGN-SYSTEM.md`. Do not hardcode colors, font sizes, or spacing when a project token exists.
- Preserve keyboard access, visible focus, minimum target sizes, reduced motion, light/dark themes, and non-color status cues.

## Validate

1. Add or update the narrowest deterministic behavior test when the interaction delegates to testable document logic. Run it before and after the implementation.
2. Run `npm test` for behavior or data-flow changes.
3. Follow `foundry-live-validation` in a disposable world. Exercise the changed control with mouse and keyboard, then verify persistence after rerender and reload.
4. Check both locales and light/dark themes when labels, layout, or styles changed. Inspect the client console for errors.
5. Test the narrowest relevant viewport or sheet size and confirm dynamic text does not overlap or resize fixed controls.

## Report

Separate automated behavior checks from rendered Foundry verification. State the interaction, document type, locale, theme, Foundry version, persistence result, and any unavailable keyboard or viewport coverage.
