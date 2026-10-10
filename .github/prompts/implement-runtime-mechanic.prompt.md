---
name: Implement runtime mechanic
description: Implement one source-backed Cypher mechanic through pure rules, Foundry services, UI, localization, and scoped validation.
argument-hint: Mechanic, CRD source section, expected behavior, and known limits.
agent: Cypher Foundry VTT Expert
---

Implement the requested mechanic. Read `AGENTS.md`, inspect the current branch,
and distinguish existing behavior from roadmap claims before editing.

Identify authoritative source semantics, owning layers, and acceptance criteria.
Use the ESM runtime and document transaction skills when relevant. Keep rules
pure, application services responsible for persistence, and sheets responsible
for input/presentation. Preserve supported public facades.

Cover costs, Edge/Effort, target identity, permissions, rejection/cancellation,
and persistence according to the mechanic. Add matching EN/FR labels and tests
at the lowest useful layer, plus a focused live scenario when UI is involved.

Use isolated validation for normalization/builds/E2E. Report implemented
behavior, exact checks, observed Foundry results, remaining limits, and final
changed-file scope. Do not commit, push, or release unless requested.
