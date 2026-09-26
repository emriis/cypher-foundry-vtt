---
name: foundry-live-validation
description: 'Use when live-testing this Cypher system in local Foundry VTT, linking a checkout into the loaded installation, checking compendium packs in game, preparing a runtime commit, or verifying V13/V14 compatibility before a requested release.'
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
   rather than a stale packaged copy. Do not change the configured data path or
   world data. When the user explicitly requests a live test of a checkout, use
   the reversible linking procedure below; preserve any existing system copy.
5. Record the exact Foundry version/build shown in the running UI, system
   version, client, and locale. If a second supported Foundry version is
   unavailable, mark it untested.

## Locate and launch the checkout

On Windows desktop installations, read only the `dataPath` property from
Foundry's `Config/options.json`. The default location is
`%LOCALAPPDATA%/FoundryVTT/Config/options.json`; portable installs keep `Config`
beside the application. Do not print the whole settings file. The `fvtt` CLI
has a separate configuration (`%APPDATA%/.fvttrc.yml`), so do not use `fvtt
launch` unless its configured `dataPath` is confirmed to match the desktop
installation.

Resolve the actual systems directory from the configured data path. Check both
`<dataPath>/Data/systems` and `<dataPath>/systems`; require exactly one
unambiguous location, then append the package `id` from this checkout's
`system.json`.

```powershell
$optionsPath = Join-Path $env:LOCALAPPDATA 'FoundryVTT\Config\options.json'
$options = Get-Content -LiteralPath $optionsPath -Raw | ConvertFrom-Json
$dataPath = [string]$options.dataPath
if ([string]::IsNullOrWhiteSpace($dataPath)) {
  throw 'Foundry dataPath is not configured; resolve it in Foundry Setup first.'
}
$systemCandidates = @(
  (Join-Path $dataPath 'Data\systems'),
  (Join-Path $dataPath 'systems')
)
$systemRoots = @($systemCandidates | Where-Object { Test-Path -LiteralPath $_ })
if ($systemRoots.Count -ne 1) {
  throw 'Could not resolve one unambiguous Foundry systems directory.'
}
$systemsRoot = $systemRoots[0]
$systemId = (Get-Content -LiteralPath 'system.json' -Raw | ConvertFrom-Json).id
$systemPath = Join-Path $systemsRoot $systemId
$checkout = (git rev-parse --show-toplevel).Trim()
```

Before changing the package path, close Foundry cleanly from Setup; never stop
it while a world is open. If `$systemPath` is already a junction to `$checkout`,
verify the target and continue. If it links elsewhere, stop and ask before
retargeting it. If it is an ordinary directory, preserve it intact in a unique
backup under `$dataPath/Backups` (outside `systems`) before creating a junction.
Do not overwrite or delete the backup. Create the junction only after confirming
the target and preserving any existing copy:

```powershell
$backupRoot = Join-Path $dataPath 'Backups'
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$backupPath = Join-Path $backupRoot "$systemId-before-worktree-$([guid]::NewGuid())"
# Run this move only when systemPath is an ordinary existing directory.
Move-Item -LiteralPath $systemPath -Destination $backupPath
New-Item -ItemType Junction -Path $systemPath -Target $checkout | Out-Null
Get-Item -LiteralPath $systemPath -Force | Format-List FullName,LinkType,Target
```

If the package path is absent, omit the backup move and create the junction.
Verify `LinkType` is `Junction`, `Target` is exactly `$checkout`, and the
manifest read through `$systemPath` has the expected `id` and version.

Launch the desktop executable belonging to the installation whose
`options.json` was checked. A common Windows location is
`%ProgramFiles%/FoundryVTT/Foundry Virtual Tabletop/Foundry Virtual Tabletop.exe`;
use the actual path for custom installs. Restart Foundry after linking so the
running process loads the checkout from startup.

Skills describe workflows but do not grant desktop/browser-control tools. Use
available UI-control tools when the current agent exposes them. If none are
available, do not claim the live test passed; give the user the focused steps
and wait for their observed version and result.

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
- **Compendiums:** rebuild affected packs first, then confirm they load in the
  disposable world, inspect representative records, and test drag/drop when
  relevant. For current Type packs, verify both language trees:
  - FR: `Fantasy` > `Fantasy de donjon`, `Épées & Sorcellerie`, `Fantasy épique`;
    `Science-fiction` > `Science-fiction dure`, `Space Opera`, `Postapocalyptique`;
    `Super-héros` contains its Types directly.
  - EN: `Fantasy` > `Dungeon Fantasy`, `Swords & Sorcery`, `Epic Fantasy`;
    `Science Fiction` > `Hard Science Fiction`, `Space Opera`, `Postapocalypse`;
    `Superheroes` contains its Types directly.
  The current 56 records are 27 Fantasy, 22 Science Fiction, and 7 Superheroes;
  the Real World chapter defines no separate Type family, so do not create an
  empty Real World folder.
  For Descriptor changes, drag `Attrayant·e` or `Appealing` onto a disposable PC
  and verify the dialog and resulting +2 Intellect/Persuasion grant.
- **Localization:** repeat the affected interaction in French and English when
  player-facing text or formatting changed.

Do not expand into a full-system regression pass unless the change has a broad
impact or a focused check exposes a related issue.

## Commit gate and verified version

Use this gate before committing a runtime-affecting change, including changes
to system behavior, sheets/templates, data models, migrations, or compendium
packs.

1. Run the focused automated test and `npm test`.
2. In the local Foundry UI, read the exact version/build and open a disposable
  test world that loads the checkout being changed. A version shown only on
  the setup screen, or a different packaged copy of the system, is not a live
  compatibility check.
3. Run the relevant focused smoke test above. If Foundry warns that loading the
  world will perform an unreviewed or non-reversible migration, cancel and use
  a disposable world copy instead.
4. Only after the smoke test succeeds, compare the tested Foundry version with
  `system.json`'s `compatibility.verified`. If the tested version is newer,
  update that field to the exact tested version, using the manifest's existing
  format (for example, `14.360`). Do not raise it merely because that version
  is installed, and do not lower it after testing an older version.
5. If live testing is unavailable or fails, leave `compatibility.verified`
  unchanged and report that the commit is not verified on the local runtime.
  Documentation-only and test-only changes do not require a compatibility
  version update.

## Evidence and reporting

- Check the client console and relevant Foundry logs for errors caused by the
  tested action. Redact credentials, tokens, and private world data from any
  shared output or screenshots.
- Report the exact scenario and outcome, Foundry/system versions, locale, and
  automated commands already run. Separate passed, failed, and unavailable
  checks.
- If UI automation is unavailable, provide the user with the precise steps and
  wait for their observed result. Never claim live validation passed without
  seeing the interaction and its outcome.
- State remaining version or workflow coverage explicitly; a successful check
  on one Foundry version does not certify another.

## Requested Releases

If the user requests a tag/release conditional on live success, do not bump
versions, commit, tag, or push before the disposable-world smoke test passes.
Then follow `.github/skills/github-actions-release/SKILL.md`: align `system.json`
`version` and its pinned `download` URL, update the changelog, run `npm test`,
build and inspect the package, and create only the matching `v<version>` tag.
The default `scripts/package.ps1` output removes existing `dist/system.zip` and
`dist/system.json`; check `dist/` first or use a unique output directory. Verify
the GitHub release and its assets before reporting publication success.