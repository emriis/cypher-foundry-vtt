---
name: foundry-live-validation
description: 'Use when manually smoke-testing this Cypher system in a local Foundry VTT installation, validating UI or lifecycle behavior, checking compendium packs in game, or verifying compatibility with Foundry V13/V14.'
---

# Foundry live validation

Use this workflow after automated checks for a change whose behavior depends on
the real Foundry runtime, rendered sheets, client interactions, compendium
loading, or world data. Read `docs/development.md` and follow the relevant
mechanics or compendium skill first; live checks supplement rather than replace
automated tests.

## Safety and setup

1. Identify the changed behavior and choose the smallest in-game path that
   exercises it. Read `system.json` for the supported and verified Foundry
   versions; do not infer compatibility from a successful test on one version.
2. Run the relevant automated test, then `npm test`. Record failures rather
   than treating a manual success as a substitute for them.
3. Use a disposable test world and test actors/items. Never migrate, edit, or
   delete a user's real world data for validation. Back up and use a copy if a
   migration scenario is required.
4. Confirm the local Foundry installation loads the checkout being tested,
   rather than a stale packaged copy. Do not change installation paths, world
   settings, or user data without explicit approval.
5. Record the Foundry version, system version, browser/client, and locale. If a
   second supported Foundry version is unavailable, mark it untested.

## Focused smoke tests

Select only the cases affected by the change:

- **Actor or Item schema/document behavior:** create or edit a disposable
  document; verify defaults, submitted values, persistence after reload, and
  preservation of unrelated fields.
- **Sheet or template behavior:** open the affected sheet; exercise the changed
  control by mouse and keyboard where relevant; check layout, validation,
  localized labels, and browser-console errors.
- **Task rolls or rules:** perform one representative success and any changed
  boundary case; verify displayed result, Pool/Effort changes, chat output, and
  token status effects when affected.
- **Migrations:** run only against a disposable world copy with representative
  old data; verify migrated values and unrelated data before and after reload.
- **Compendiums:** confirm each affected pack loads in Foundry, inspect a
  representative record, and test import or drag/drop behavior if the change
  affects it. Rebuild packs using the compendium workflow before this check.
- **Localization:** repeat the affected interaction in French and English when
  player-facing text or formatting changed.

Do not expand into a full-system regression pass unless the change has a broad
impact or a focused check exposes a related issue.

## Evidence and reporting

- Check the client console and relevant Foundry logs for errors caused by the
  tested action. Redact credentials, tokens, and private world data from any
  shared output or screenshots.
- Report the exact scenario and outcome, Foundry/system versions, locale, and
  automated commands already run. Separate passed, failed, and unavailable
  checks.
- If the agent cannot operate the local Foundry UI, provide the user with the
  precise test steps and wait for their result. Never claim live validation
  passed without observing it.
- State remaining version or workflow coverage explicitly; a successful check
  on one Foundry version does not certify another.