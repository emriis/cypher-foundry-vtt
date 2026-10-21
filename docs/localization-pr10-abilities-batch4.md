# PR10 — Final 176 Abilities

Source: Cypher Reference Document (29 July 2026). Branch from main after PR9 merged.

The immutable manifest contains the last 176 Ability IDs from `ability.resuscitate` to `ability.wraith-cloak`. Same-name distinct rule variants remain separate. Prior 525 Abilities and 111 Skills/Descriptors stay reviewed.

Run `npm run audit:abilities-pr10` to create `reports/ability-review-batch-4.json`, plus `npm run test:content`, `npm run audit:i18n`, `npm run build:packs`.

The audit checks English/French field pairs, hashes, costs, mechanics and potentially missing clauses. Passing automated tests does not prove semantic fidelity. The 176 entries remain `proposed` until full clause-by-clause manual checks cover restrictions, targets, conditions, alternatives, duration, effects, examples and variants.
