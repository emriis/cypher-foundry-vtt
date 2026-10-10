---
name: foundry-document-transactions
description: Implement or review Foundry actions that spend resources, target tokens, or update multiple Actor/Item documents, including validation, permissions, cancellation, repeated activation, and partial failure behavior.
---

# Foundry document transactions

Trace the action from sheet input to application service, document updates,
and chat output. Read the owning service, pure rule, and nearby tests.

- Establish source-backed costs and eligibility before mutation. Include Edge,
  Effort, wound state, active modifiers, and target-specific effects only when
  the source and current models define them. Do not infer rules from names.
- Resolve the actual target Actor. An unlinked token's synthetic Actor and
  world Actor are different state owners; preserve the token document identity.
- Check ownership/permissions at the mutation boundary, not just button visibility.
  Separate player intent from any required GM authorization or adjudication.
- Validate all known prerequisites and aggregate costs before the first write.
  Cancellation and ordinary validation rejection must leave state untouched.
- Serialize repeated activation where needed. In-process guards prevent local
  double clicks but are not cross-client locks; identify where GM authority or
  another explicit synchronization contract is necessary.
- Await updates in dependency order. Foundry document writes are not a database
  transaction: define what happens on a failure after the first write. Avoid
  rolling back with stale snapshots that overwrite another user's changes.
- Post chat results after successful orchestration. Preserve structured action,
  source, and target metadata for audit and rerolls; escape plain-text names.

Test rejected/insufficient costs, successful persistence, repeated activation,
natural-roll outcomes, and failure boundaries relevant to the action. Cover
synthetic targets and permission rejection when changed. Use live Foundry to
verify document behavior, reload persistence, and the actual sheet interaction.

Consult the official API for each supported version; do not raise verified
compatibility merely because an installation or deterministic test exists.
