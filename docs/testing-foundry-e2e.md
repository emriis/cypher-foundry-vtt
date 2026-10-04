# Live Foundry E2E tests

The live E2E suite validates the Cypher system inside a real Foundry VTT
runtime. It is separate from `npm test`: Foundry itself is licensed and
must be installed locally.

## Requirements

- Node.js 22 or newer.
- A local Foundry VTT installation that has already completed license/EULA
  setup.
- Playwright Chromium (`npx playwright install chromium`).
- The Foundry executable must be discoverable automatically, or
  `FOUNDRY_APP_PATH` must point to it.
- The Foundry user-data directory must be the default location, or
  `FOUNDRY_DATA_PATH` must point to it.

Foundry's command-line `--world` option supports launching a specific world
directly, which is what the E2E runner uses. The runner also installs the
current checkout of the Cypher system into the test data directory so the
browser tests execute the code from the branch being tested.

## Run

First install the browser once:

```powershell
npx playwright install chromium
```

Then:

```powershell
npm run test:e2e
```

You do **not** need to open Foundry manually.

The command performs this lifecycle:

1. Finds the local Foundry executable.
2. Creates an isolated temporary Foundry data directory and copies the
   activated `Config/license.json` from the normal Foundry data directory.
3. Creates a unique disposable Cypher world using the current `system.json`
   version and installs the current checkout as `Data/systems/cypher` in that
   isolated directory.
4. Starts Foundry with that world using `--world`.
5. Waits for the local server to become reachable.
6. Playwright joins the fresh Gamemaster session.
7. Runs the smoke and gameplay E2E suites.
8. Stops Foundry.
9. Deletes the entire temporary Foundry data directory, including the
   disposable world. Your normal Foundry worlds and installed system are not
   modified.

Foundry documents that newly created worlds start with a Gamemaster account
without a password, so the runner can join the fresh world without storing
test credentials.

### Custom data paths

If Foundry is installed somewhere non-standard:

```powershell
$env:FOUNDRY_APP_PATH = "D:\\Foundry Virtual Tabletop\\Foundry Virtual Tabletop.exe"
$env:FOUNDRY_DATA_PATH = "D:\\FoundryVTT"
npm run test:e2e
```

`FOUNDRY_DATA_PATH` identifies the real user-data directory from which the
activated license is copied. It is never used as the E2E data directory.

You can optionally choose a persistent disposable directory with
`FOUNDRY_E2E_DATA_PATH`:

```powershell
$env:FOUNDRY_E2E_DATA_PATH = "D:\\FoundryVTT-E2E"
npm run test:e2e
```

That directory is deleted and recreated for every run. If it is not set, the
runner uses an automatically created system temporary directory.

If your installation uses the default paths, these variables are not needed.

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
Foundry installation or license. Live E2E tests are intended for a local
Foundry environment or a dedicated self-hosted runner.


## World and session lifetime

The E2E runner creates **one** disposable world per complete
`npm run test:e2e` execution. Foundry remains open and that same world stays
active for the complete Playwright suite.

Playwright is configured with a single worker and uses one worker-scoped
browser page. The Gamemaster joins the world once at the beginning of the
worker; individual tests do not return to the Foundry join screen.

Actors created by the E2E tests are cleaned up after the worker finishes.
Only after Playwright has completely finished does the runner stop the
Foundry process. The temporary Foundry data directory, including the world,
is then removed.

This ordering is intentional:

```text
start Foundry
    |
    v
create + open ONE world
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
delete temporary Data/world
```
