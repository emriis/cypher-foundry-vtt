# PR12 — 457 Equipment and Cypher documents

The PR is based on main after merging PR11. Its manifest locks the complete 457 source-derived French Equipment family, including 259 ordinary Equipment/Weapon/Armor/Shield entries and 198 Cyphers. Identities, source hashes, costs, numeric values and structured rule fields must remain unchanged.

The source-bound EN/FR audit `npm run audit:equipment-pr12` creates `reports/equipment-review-pr12.json`; CI archives it. Automated tests check all 457 entries, mechanical parity, previously reviewed content and release statuses. The final manual cross-language text and visual review will occur inside FoundryVTT after the remaining translation PRs, as requested. Marking an entry `reviewed` at this stage records its inclusion in this source-traceable translation tranche, not a completed independent semantic certification.

At PR12 completion, expected status totals are 1,366 / 1,373 reviewed; only seven Rules Journal entries remain proposed. Final release requires PR13 and the later end-to-end audit.
