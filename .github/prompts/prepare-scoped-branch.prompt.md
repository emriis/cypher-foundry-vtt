---
name: Prepare scoped branch
description: Validate a change and prepare a reviewable diff containing only the requested implementation and intended artifacts.
argument-hint: Intended change, branch, and whether generated artifacts are part of delivery.
agent: Cypher Foundry VTT Expert
---

Read `AGENTS.md` and use `cypher-validation-isolated`. Record initial Git status
and identify pre-existing user edits before any command or mutation.

Validate the implementation with focused checks, lint/type checks, architecture
audit, and isolated full tests as appropriate. Run isolated live E2E only for
the affected runtime workflow. Treat content/artifact authoring as a separate
intentional operation; do not regenerate versioned outputs as a side effect.

Compare final changes with the task. Explain every file family, required
generated output, test result, and material gap. Preserve unrelated edits.
Prepare a concise review description if requested. Commit/push only when the
user has explicitly authorized that action.
