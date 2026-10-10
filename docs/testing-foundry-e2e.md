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

## Deterministic dice

Every E2E test fixes `CONFIG.Dice.randomUniform` to `0.525`: a d20 rolls 10,
a d6 rolls 3, and a d100 rolls 48. Foundry still evaluates the original
formulas, modifiers, dice terms, serialization, and chat messages. The fixture
restores the original generator after each test, including failed tests.

Use `setDiceUniform(page, value)` from `foundry-session-fixture.mjs` when a
scenario requires a different outcome. Values must be in `[0, 1)`; for example,
`0.225` produces d6 = 5 and d20 = 16 for Spray. Foundry maps the uniform input
to a die result with `ceil((1 - value) * faces)`. Avoid replacing
`Roll.prototype.evaluate` or assigning `Roll.total`. Node tests already use
explicit deterministic Roll stubs, including natural-roll boundary outcomes.

## Run

Run:

```powershell
npm run test:e2e
```

The runner automatically installs/validates the Playwright Chromium browser before launching Foundry. To skip that bootstrap step when the browser is already managed externally, set `PLAYWRIGHT_SKIP_BROWSER_INSTALL=true`.
The Playwright context uses a fixed 1280×900 CSS viewport, device scale factor 1, and Chromium's scale factor is forced to 1. This prevents Windows display scaling from reducing Foundry's effective viewport below its 1024×768 minimum.

You do **not** need to open Foundry manually.

### Foundry logs

By default, Foundry stdout/stderr are written to a temporary log file rather
than interleaved with Playwright output. Successful runs remove this log. If
the run fails, the runner prints the last 120 lines and retains the complete
log, reporting its path. To stream Foundry logs directly to the console while debugging, use the
separate command:

```powershell
npm run test:e2e-debug
```

This debug command enables live Foundry logging. The regular `npm run
test:e2e` remains quiet by default. For advanced use, the runner also accepts
`FOUNDRY_E2E_SHOW_FOUNDRY_LOGS=true` as an environment variable. When live
streaming is enabled, logs are not captured to the temporary file.

Playwright browser messages and bootstrap diagnostics are buffered and printed
only when a test fails. Actor/sheet diagnostics are attached to the test report
as JSON rather than dumped into the terminal for every successful test.

The command performs this lifecycle:

1. Finds the local Foundry executable.
2. Reads activation metadata from the configured installation and copies it
   into a marked temporary user-data directory; does not copy user settings.
3. Copies the checkout (including edits), normalizes source records, builds
   compendium packs, and packages the system in that temporary checkout.
4. Installs the isolated build into temporary `Data/systems/cypher`.
5. Creates one uniquely named disposable Cypher world under
   `Data/worlds/`.
6. Starts Foundry with that world using `--world`.
7. Waits for the local server to become reachable.
8. Playwright joins the fresh Gamemaster session.
9. Runs the smoke and gameplay E2E suites in the same world and Gamemaster
   session.
10. Cleans up E2E-created Actors and closes the browser session.
11. Stops Foundry only after Playwright has completely finished.
12. Retains failure diagnostics under ignored `reports/` paths, then verifies
    ownership and removes only the temporary workspace.

Your other Foundry worlds, configuration, and installed systems are left in
place. The working checkout's `packs/`, `data/`, and `dist/` are also preserved.

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

`FOUNDRY_DATA_PATH` identifies a read-only source installation: the runner
reads `Config/license.json` from its parent. The live run always uses a new
temporary Data directory. No system is installed into the specified path.

If your installation uses the default path, this variable is not needed.

### Watching the browser

Foundry runs as a hidden Node server. To run Chromium headed:

```powershell
$env:PLAYWRIGHT_HEADLESS = "false"
npm run test:e2e
```

### Do not run two Foundry instances against the same data directory

The runner deliberately fails fast if its local test port is already reachable.
Close a manually running Foundry instance before starting the autonomous
suite, or choose another `FOUNDRY_PORT`. Each test run uses its own temporary
user-data directory; the port check prevents connecting to the wrong server.

## Local path and privacy rules

Paths that depend on a developer's machine must never be committed to the
repository.

In particular, do not commit:

- real Windows user-profile paths or drive-qualified local paths;
- real Unix home-directory paths or placeholders that resemble absolute user paths;
- absolute Foundry installation or Data paths when they identify a developer's
  machine;
- machine names, local network addresses, or other unnecessary environment
  identifiers.

Scripts must resolve local paths from environment variables, operating-system
directories, Foundry configuration, or repository-relative paths. For the live
E2E runner this means:

- `FOUNDRY_APP_PATH` may identify the local Foundry executable;
- `FOUNDRY_DATA_PATH` identifies the read-only license-source installation;
- on the default Windows installation, `Config/options.json` is used to
  resolve Foundry's user-data root and its `Data` subdirectory;
- the runner must remove only its marked temporary workspace after stopping
  its owned server; normal installations are never cleanup targets.

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
process. Finally, only the marked temporary workspace is removed.

This ordering is intentional:

```text
start Foundry
    |
    v
create + open ONE world in temporary Data/
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
verify ownership + delete temporary workspace only
```
