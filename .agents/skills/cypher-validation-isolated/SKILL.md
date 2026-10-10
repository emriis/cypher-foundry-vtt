---
name: cypher-validation-isolated
description: Validate tests, compendium builds, packaging, Foundry E2E, or branch scope in this repository without adding unrelated generated changes to the working checkout.
---

# Isolated validation

Record Git status before validation and identify each command's outputs.

| Command | Effect |
| --- | --- |
| Focused `node --test`, `test:unit`, `test:behavior`, `test:content`, `test:all` | Test the current checkout without normalization |
| `lint`, `typecheck`, architecture/syntax audits | Read-only source checks |
| `npm test` | Copy checkout, normalize sources, run full suite, remove owned temporary copy |
| `test:e2e` | Copy checkout, normalize/build/package, run temporary Foundry Data, clean owned workspace |
| `migrate:packs` | Rewrite editable catalogue/source data in current checkout |
| `build:packs` | Replace generated databases in current checkout |
| `package` | Replace versioned `dist/` artifacts in current checkout |

Use focused checks while iterating and `npm test` for final automated coverage.
Source migration failures in the temporary copy are still failures; do not
weaken content tests or silently apply unrelated normalization to the checkout.

Use `npm run test:e2e -- --grep <scenario>` for focused live verification.
The configured Foundry Data path supplies activation metadata only; user worlds,
settings, and installed systems must not be modified. Do not run `npm ci` or
install dependencies into the temporary workspace's dependency junction.

For an explicitly requested content or release build, generated artifacts may
belong in the change. Compare their scope with the task and preserve pre-existing
edits. Never use broad Git restore/clean to hide validation side effects.

Report checks and live results separately, then compare final Git status with
the initial state. Identify authoring changes, generated outputs, and ignored
diagnostic reports. Never imply that a written E2E test has passed live.
