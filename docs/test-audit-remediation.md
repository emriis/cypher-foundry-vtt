# Test audit remediation

This change follows the local audit of main at `8a2818c` (merged PR #132).
The original reports remain historical observations, rather than current test results.

## Contract changes

| Audit | Implemented protection |
| --- | --- |
| A01–A02 | Recursive, shared suite inventory includes DataModels and rejects unclassified tests. CI summaries quote commands literally. |
| A03–A04 | Guarded gameplay actions reserve their actual document identities across categories. Explicit parent contexts permit legitimate nested task/healing/weapon operations. Advancement rejects stale/invalid choices before XP writes; XP amounts must be nonnegative safe integers. |
| A05 | Unexpected page exceptions fail otherwise successful live tests. Dice overrides restore the current document's saved function; reload never restores `undefined`. |
| A06–A07 | Added live player ownership, unauthorized target, socket synchronization and unlinked-token persistence scenarios. Readiness detects early child exit; client initialization errors retain their cause. No blanket bootstrap retry was added. |
| A08–A09 | Architecture and lint adversarial fixtures cover bare/dynamic Node APIs, CRD and nested/outside-root imports. Independent schema and translation corruption cases exercise rejection guards. Equipment numeric regexes now execute; the Stunstick guard also recognizes the source's spelled-out “two steps”. |
| A10–A13 | Removed literal equalities, the duplicate Descriptor scenario and obsolete miniature content library. Unique character expectations now read actual sources; high-risk equipment expectations remain on real records. Fixed dormant model doubles, equipment update assertions and isolated depletion globals. Added Cypher repeated/overlapping use and write/chat failure tests. |
| A14–A15 | Every compiled pack must actually extract to nonempty documents; Journal pages and IDs are checked. Existing real builds also roundtrip reviewed embedded effects, table results and Journal pages, plus draft French Focus references. Compilation finishes before publication, with explicit late-compile and partial-publication failure contracts. Live Foundry installs the produced ZIP. Discovery and process-exit behavior replace E2E source-text assertions. |
| A16–A17 | Required roll fields cannot be silently skipped; submits use their semantic type. The generic persistence scenario reloads the client. E2E reuses its explicitly owned normalized checkout for compilation; standalone builds still normalize a separate copy. Working Chromium is checked before an installer writes its cache. |
| A18–A20 | Fast runtime coverage includes behavior tests and loaded non-rule modules. Source migrations have a separate mandatory lane. Mutation uses the same fast runtime suite. Same-name IDs require uniqueness; translation preview compares bilingual identity sets rather than a fixed total. |
| A19 | Moved 25 detailed Actor examples to their application services and two preparation examples to DataModels. Six genuine facade contracts remain; an exact duplicate rule case was removed. Added a repeated public-preparation/no-write contract. Thirteen pure Given/When/Then files now belong to the recursive rules suite; vertical service scenarios remain in behaviors. |
| A20 | The reserved world migration now has an explicit repeated-call preservation contract against populated document/settings doubles; document updates and settings writes fail the test. This does not invent a world migration or claim live migration coverage. |
| A21–A22 | PR/release use locked dependencies, the same packaging entry point and exact-archive verification. Indirect build inputs trigger pack generation; forks receive a read-only artifact check. Workspace ownership checks have negative contracts; creation failures clean the allocated directory and retain cleanup errors. |

## Deliberate limits

Action ownership is local to one browser client and rejects competing requests;
it is not a cross-client lock or a queue. Sequential document writes are not
atomic. If a later Item, target or chat write fails, previously committed costs
remain committed and the original error propagates. Tests assert these partial
outcomes rather than inventing compensating resource refunds.

Publication also has an explicit partial-failure boundary: a compile error
publishes nothing; a publication error stops at the failing pack and can leave
earlier outputs committed. Authoring source preservation has a separate real-build
regression. The callback failure tests establish ordering, not filesystem crash
recovery or a transactional filesystem guarantee.

Native Node coverage only reports modules loaded by the selected tests. It is
not a whole-system percentage, and the JSDoc type checker remains its explicit
pilot. Mutation `break: 0` is retained until a measured campaign establishes a
reviewed baseline; no mutation score or CI ratchet is invented here.

Further consolidation remains incremental work: preserving distinct regressions
takes precedence over line count reduction. The Actor and pure-scenario relocations
preserve their assertions and keep meaningful facade/pipeline contracts.
Natural-language French review, V13 compatibility, simultaneous cross-client
cost arbitration and additional keyboard/focus-return journeys require their own
validation. A player/GM synchronization scenario is not proof of a cross-client
transaction lock.

## Validation record

- Latest normalized isolated `npm test` after the Actor/scenario relocations and
  reviewed embedded translation checks: **717 passed**, no failures/skips, Node
  runner **188.82 s**. This is not a controlled timing comparison with the original
  audit or the earlier remediation run (**246.47 s**, overlapping live preparation).
  The later world-migration test refinement passed independently and in the final
  current-source runtime lane: **471 passed**, no failures/skips, **1.61 s**.
- The reviewed/draft pack-build scenario also passed independently (**167.89 s**).
  Its successful reviewed statuses exist only in its disposable fixture; no
  authoring proposal was editorially approved or modified by this work.
- Final fast runtime lane under `test:coverage`: **471 passed**, no failures/skips;
  loaded-module line/branch/function coverage **92.54% / 83.81% / 88.77%**.
  Its Node runner took **2.77 s**. These are loaded-runtime metrics, not whole-system
  coverage and not a like-for-like benchmark against the old rules-only command.
- Compiled artifacts: **15 passed** (all **14 packs**, plus inventory check),
  including extraction, record counts, complete existing identity sets and Journal
  pages. The stronger count/identity checks ran in a separate owned copy of the
  actual E2E build outputs. Exact ZIP/manifest byte verification also passed.
- Lint, the existing type-check pilot, architecture audit, production/E2E syntax,
  workflow YAML parsing and public-data audit passed. Git's safe-directory
  exception was scoped to the audit process, without changing global config.
- Final live run: **45 passed**, **0 failed**, **0 skipped**, Playwright
  **1.3 min**, on the selected installed Foundry **14.369.0**, Chromium
  **153.0.8010.12**. This includes the two proposed-translation scenarios, actual
  player permissions/socket synchronization, unlinked-token persistence, and
  cross-file scenario cleanup. The runner exited successfully and removed its
  temporary checkout/Data directory after stopping the server.
- The latest standalone build check also passed **15/15** against raw authoring
  input, using an independently normalized expectation copy. The guarded reuse
  mode passed **15/15** against an owned normalized checkout. These validate the
  final build-check refinement separately from the licensed live run.

The live run which first enabled the browser-exception gate reported **41 passed,
4 failed**. One chat click was covered by a remaining sheet; three failures were
the core chat notification continuation touching a deleted message. Cleanup now
closes owned document sheets and waits for the notification's hidden card/spacer
to finish inserting before deleting owned messages. It preserves core UI services.
No exception allowlist or blanket retry hides these errors.

An additional cross-file failure exposed suite-local hooks in the shared E2E
module: traces showed that a later spec had no scenario cleanup. The state and
error lifecycle now belongs to an automatic test fixture, so it executes for
every spec using the exported test type. New document windows are identified
through the V14 [ApplicationV2 registry](https://foundryvtt.com/api/v14/variables/foundry.applications.instances.html),
with a baseline preserving preexisting applications. A real child-process test
also validates the Windows shutdown path. Shutdown failures retain diagnostics
and owned files instead of masking them or deleting an active database.

Compiled-pack expectations must describe the normalized compiler input. Legacy
authoring records can change identity or disappear during normalization, so
the standalone build test normalizes an independent temporary expectation copy.
The live runner reuses its ownership-checked, already normalized checkout for
that expectation rather than repeating preparation. Authoring sources remain
unchanged in both modes.

The initial E2E attempt hit a Playwright cache-lock permission error despite an
already installed working Chromium. The runner now performs the browser preflight
before attempting installation. A subsequent Windows command dispatch failure on
the spaced Node executable path was corrected by spawning executables directly;
only `.cmd` launchers go through `cmd.exe`.

Generated `packs/`, `dist/`, authored content and `compatibility.verified` are not
changed by this implementation's validation runs. Neither Node 22, Foundry V13
nor remote GitHub workflow execution has been observed locally.

## Change scope

The initial working tree was clean on main at the audited revision; HEAD remains
unchanged. Runtime changes are confined to application orchestration and guards.
Tests cover their regressions, replace weak or duplicated checks, and move the two
whole-catalogue migration files to their dedicated family. Detailed Actor service
contracts and pure narrative scenarios now live in their owning layers; public
DataModel preparation and the reserved no-write migration have explicit contracts.
Node scripts own suite
discovery, coverage, archive/process/build validation and temporary workspaces;
ESLint and workflows enforce the revised boundaries and lanes. Contributor and
architecture documentation describe these contracts. Local audit logs and traces
remain ignored diagnostics. No commit, push, merge or release was performed.

The synthetic-document scenarios use the documented V14
[TokenDocument](https://foundryvtt.com/api/v14/classes/foundry.documents.TokenDocument.html)
and [Actor](https://foundryvtt.com/api/v14/classes/foundry.documents.Actor.html)
boundaries; their runtime result is established separately by the live tests.
