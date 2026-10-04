# Live Foundry E2E tests

The live E2E suite validates the Cypher system inside a real Foundry VTT
runtime. It is separate from `npm test`: Foundry itself is licensed and
must be installed locally.

## Requirements

- Node.js 22
- A Foundry VTT installation compatible with the system
- A disposable test world using the Cypher system
- Playwright Chromium (`npx playwright install chromium`)

## Run

Start Foundry, open the disposable test world, then run:

```powershell
$env:FOUNDRY_URL = "http://127.0.0.1:30000"
npm run test:e2e
```

The tests create temporary Actors and remove them after each scenario.
They do not depend on specific editorial names or descriptions from the
compendiums.

## Current coverage

The first live suite checks:

1. The Cypher system is actually loaded by Foundry.
2. PC Actor DataModels instantiate with valid defaults.
3. Embedded Skill, Armor, and Attack Items can be created on a real Actor.
4. All six FR/EN Item compendium collections are loadable and non-empty.
5. A real PC ApplicationV2 sheet renders and exposes stat-roll controls.

## Why this is separate from CI

The normal GitHub Actions suite remains deterministic and does not require
a Foundry installation or license. Live E2E tests are intended for a local
Foundry environment or a dedicated self-hosted runner.

Future live scenarios should cover defense, wounds, recovery, advancement,
armor, shields, depletion, compendium drag/drop, and chat results.