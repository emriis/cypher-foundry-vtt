# French Rules Journals localization

The seven source-backed Journals contain the selected CRD rules on task resolution, task difficulty, Effort and Edge, distance and movement, combat, recoveries and healing, and XP advancement.

Their editorial proposals retain the original English CRD source field hashes and canonical identities. The source-derived French text is available for all rule pages, including nested recovery sections. The typed metadata, journal page identities, and sources remain unchanged. The compilation selects their reviewed proposals through the normal bilingual compendium workflow.

The `npm run audit:rules-journals` command performs a source-hash, mechanical-parity, name and page text comparison, and writes `reports/rules-journals-review.json`. The CI workflow archives it as `rules-journals-bilingual-review`. Unit, content, architecture and generated artifact workflows cover this alongside the other 1,366 localized records.

All **1,373** current translated documents are recorded as `reviewed` after this change. This status means the existing source-bound translations are integrated and auditable; it is **not evidence of full semantic identity**. Final phrasing, cross-references, page navigation and visual inspection in FoundryVTT are deferred to the dedicated final in-application validation chosen by the maintainer. Source omissions beyond the seven selected Journals remain separately tracked in the CRD Journal roadmap; approving these seven entries does not imply the entire reference manual has been represented.

Do not introduce extra CRD sections or new rules as part of this localization step.
