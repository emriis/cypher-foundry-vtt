# PR10 — Final 176 Abilities

Source: Cypher Reference Document (29 July 2026). Branch from main after PR9 merged.

The immutable manifest contains the last 176 Ability IDs from `ability.resuscitate` to `ability.wraith-cloak`. Same-name distinct rule variants remain separate. Prior 525 Abilities and 111 Skills/Descriptors stay reviewed. The fourth batch completes the 701 canonical Ability IDs.

Run `npm run audit:abilities-pr10` to create `reports/ability-review-batch-4.json`, plus `npm run test:content`, `npm run audit:i18n`, `npm run build:packs`.

The audit checks English/French field pairs, hashes, costs, mechanics and potentially missing clauses. Passing automated tests does not prove semantic fidelity. The 176 entries have been marked `reviewed` in their proposal records. This is a recorded editorial status, not evidence by itself of a full semantic comparison. The complete bilingual worksheet is retained to allow a separate clause-by-clause check of restrictions, targets, conditions, alternatives, durations, effects, examples and variants. Total: 812 of 1,373 records marked `reviewed`; 561 in the remaining families stay `proposed`.

## Source-backed edge cases

- Distinct `Spray`, `Sneak Attack`, `Telekinesis`, `Safe Fall`, `Tough`, `Tribulation`, `When the Deal Bombs`, `Wilderness Encouragement` and `Wounded Fury` identities must not collapse because of shared names.
- `Resuscitate`: a healing task at level 6 within a minute of death, different PC and NPC results, increasing Intellect cost that resets on recovery.
- `Severe Machine Disruption`: simultaneously hinder all tasks, halve speed, deny one round of action, reduce wounds by one step and require contact unless altered by Effort.
- `Shot Collision`: projectile defense replacement, area damage with a separate attack roll per target, reduced bonus damage per Effort and 1 on a failed attack.
- `Superheroics`: Rank-based Effort limit bonus, optional moderate wound for two free Effort levels, recovery restricted to one chosen Pool.
- `Unyielding Shield`: major-wound transfer, lost next turn or GM intrusion, shield recovery, throw and return roll, crafting delay.
- `Winter Gauntlets`: consistent `Frost Bolt` cross-reference in French.

## Quality gates

The source hashes, field coverage, identity matching, compendium materialization, structured mechanic parity, representative high-risk clauses and generation are checked by automated tests. The retained bilingual report allows a separate semantic audit. A green CI alone does not establish complete equivalence of narrative wording or executable Foundry effects.
