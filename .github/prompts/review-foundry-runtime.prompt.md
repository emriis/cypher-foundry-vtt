---
name: Review Foundry runtime
description: Review a Foundry runtime change for source fidelity, ESM boundaries, costs, permissions, token identity, and persisted state.
argument-hint: Branch, diff, or runtime files to review.
agent: Cypher Foundry VTT Expert
---

Review the requested change without editing files. Read `AGENTS.md` and inspect
the diff plus the actual callers and tests. Use the ESM runtime and document
transaction skills for affected boundaries.

Check source-backed mechanics, Node/browser separation, application ownership,
cost/Edge handling, permissions, synthetic target Actors, cancellation,
repeated activation, partial failures, and persistence. Verify changed Foundry
APIs against official documentation for the declared supported versions.

Lead with actionable findings ordered by severity, each with a file/line,
concrete trigger, consequence, and correction. Separate observed failures from
unverified risks and distinguish automated tests from live Foundry evidence.
