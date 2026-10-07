# Live Foundry E2E tests

The live E2E suite validates the Cypher system inside a real Foundry VTT
runtime. It is separate from `npm test`: Foundry itself is licensed and
must be installed locally.

## Requirements

- Node.js 22 or newer.
- A local Foundry VTT installation that has already completed license/EULA
  setup.
- Playwright Chromium (installed automatically by `npm run test:e2e` unless `PLAYWRIGHT_SKIP_BROWSER_INSTALL=true`).
- The Foundry executable must be discoverable automatically, or
  `FOUNDRY_APP_PATH` must point to it.
- The Foundry **Data** directory must be the default location, or
  `FOUNDRY_DATA_PATH` must point to it.

Foundry's command-line `--world` option supports launching a specific world
directly, which is what the E2E runner uses. The runner resolves the normal
Foundry **user-data root** and its **Data** directory separately. Foundry's
`--dataPath` launch option receives the user-data root; the Cypher system is
installed into `Data/systems/cypher`, and only one uniquely named E2E world is
created under `Data/worlds/`.

## Run

Run:

```powershell
npm run test:e2e
```

The runner automatically installs/validates the Playwright Chromium browser before launching Foundry. To skip that bootstrap step when the browser is already managed externally, set `PLAYWRIGHT_SKIP_BROWSER_INSTALL=true`.
The Playwright context uses a fixed 1280×900 CSS viewport, device scale factor 1, and Chromium's scale factor is forced to 1. This prevents Windows display scaling from reducing Foundry's effective viewport below its 1024×768 minimum.


You do **not** need to open Foundry manually.

The command performs this lifecycle:

1. Finds the local Foundry executable.
2. Resolves the normal Foundry **Data** directory.
3. Builds the current compendium packs.
4. Installs the current checkout of the Cypher system into
   `Data/systems/cypher`.
5. Creates one uniquely named disposable Cypher world under
   `Data/worlds/`.
6. Starts Foundry with that world using `--world`.
7. Waits for the local server to become reachable.
8. Playwright joins the fresh Gamemaster session.
9. Runs the smoke and gameplay E2E suites in the same world and Gamemaster
   session.
10. Cleans up E2E-created Actors and closes the browser session.
11. Stops Foundry only after Playwright has completely finished.
12. Deletes **only** `Data/worlds/cypher-e2e-<run-id>`.

Your other Foundry worlds, configuration, and installed systems are left in
place. The runner never recursively deletes the Foundry Data directory.

Foundry documents that newly created worlds start with a Gamemaster account
without a password, so the runner can join the fresh world without storing
test credentials.

### Custom data paths

If Foundry uses a non-standard Data directory:

```powershell
$env:FOUNDRY_APP_PATH = "D:\Foundry Virtual Tabletop\Foundry Virtual Tabletop.exe"
$env:FOUNDRY_DATA_PATH = "D:\FoundryVTT\Data"
npm run test:e2e
```

`FOUNDRY_DATA_PATH` identifies the **real Foundry Data directory** used by
the runner. It is not a disposable directory and is never deleted by the
runner.

If your installation uses the default path, this variable is not needed.

### Watching the browser

The Foundry application itself is started visibly. To also run Chromium
headed:

```powershell
$env:PLAYWRIGHT_HEADLESS = "false"
npm run test:e2e
```

### Do not run two Foundry instances against the same data directory

The runner deliberately fails fast if its local test port is already reachable.
Close a manually running Foundry instance before starting the autonomous
suite. This avoids two Foundry processes writing to the same user-data
directory.

## Local path and privacy rules

Paths that depend on a developer's machine must never be committed to the
repository.

In particular, do not commit:

- real Windows user-profile paths or drive-qualified local paths;
- real Unix home-directory paths such as `/home/<real-user>/...` or
  `/Users/<real-user>/...`;
- absolute Foundry installation or Data paths when they identify a developer's
  machine;
- machine names, local network addresses, or other unnecessary environment
  identifiers.

Scripts must resolve local paths from environment variables, operating-system
directories, Foundry configuration, or repository-relative paths. For the live
E2E runner this means:

- `FOUNDRY_APP_PATH` may identify the local Foundry executable;
- `FOUNDRY_DATA_PATH` identifies the local **Data** directory;
- on the default Windows installation, `Config/options.json` is used to
  resolve Foundry's user-data root and its `Data` subdirectory;
- the runner must delete only its generated
  `Data/worlds/cypher-e2e-<run-id>` directory.

Examples and fixtures must use abstract placeholders such as
`<foundry-user-data>/Data` or `<foundry-installation>/Data`; they must never
contain a contributor's username or a machine-specific path.

The repository contains an automated contract test for this rule. If a local
path is needed while debugging, keep it outside tracked files and outside the
committed test fixtures.

## Current coverage

The live suite currently validates:

1. Cypher system loading and real Foundry document models.
2. PC Actor DataModel defaults.
3. Embedded Skill, Armor, Attack, Shield and related Item creation.
4. All six FR/EN compendium collections.
5. PC sheet rendering and stat-roll controls.
6. A real task roll initiated from the PC sheet, including ChatMessage output.
7. A guaranteed failed Block initiated from the PC sheet and wound
   persistence.
8. Recovery initiated from the PC sheet, including recovery markers and wound
   removal.
9. Rally initiated from the PC sheet, including the correct Might cost.
10. Effort advancement on a real Actor document.
11. Player Intrusion XP expenditure and chat output.
12. Actor state persistence across sheet close/reopen.

The tests intentionally avoid depending on editorial compendium names or
localized prose. They assert Foundry/runtime contracts and stable Cypher
mechanics instead.

## Why this is separate from CI

The normal GitHub Actions suite remains deterministic and does not require a
Foundry installation or license. CI checks the E2E JavaScript syntax but does
not launch Foundry. Live E2E tests are intended for a local Foundry environment
or a dedicated self-hosted runner with an appropriately licensed installation.

## World and session lifetime

The E2E runner creates **one** disposable world per complete
`npm run test:e2e` execution. Foundry remains open and that same world stays
active for the complete Playwright suite.

Playwright is configured with a single worker and uses one worker-scoped
browser page. The Gamemaster joins the world once at the beginning of the
worker; individual tests do not return to the Foundry join screen.

Actors created by the E2E tests are cleaned up after the worker finishes.
Only after Playwright has completely finished does the runner stop the Foundry
process. Finally, only the generated world directory is removed.

This ordering is intentional:

```text
start Foundry
    |
    v
create + open ONE world in existing Data/
    |
    v
join Gamemaster ONCE
    |
    v
all E2E tests
    |
    v
cleanup test Actors
    |
    v
close browser
    |
    v
STOP Foundry
    |
    v
delete Data/worlds/cypher-e2e-<run-id> only
```
