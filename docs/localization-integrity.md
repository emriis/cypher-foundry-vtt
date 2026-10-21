# Transversal bilingual localization integrity

The source of record is the English Cypher Reference Document 2026-07-29. This audit covers all 1,373 source-backed pairs across Abilities, Skills, Descriptors, Types, Foci, Equipment (including Cyphers), and Rules Journals.

Run `npm run audit:localization-integrity`. The command normalizes a disposable checkout, validates every authored French field against its source hash, confirms canonical EN/FR document identity and typed mechanical parity, enforces all normative UI glossary bindings, verifies all reviewed statuses, and constructs a strict reviewed-only translation compilation plan. It writes a JSON report under `reports/localization-integrity.json` and exits nonzero if a hard structural contract is broken. CI archives this report as `localization-integrity-review`.

Potentially untranslated English passages and inclusive-language/style warnings are **advisory**, never silently replaced or treated as conclusive translation errors. Hard numeric/source/markup checks are separate from editorial judgement. A passing audit cannot certify semantic equivalence, all indirect referents in narrative prose, actual Foundry interface legibility, user-visible cross-links, or executable automation for every Ability/Cypher. Those require final bilingual review and gameplay testing in FoundryVTT, as planned by the maintainer.

No new CRD mechanics are introduced and no translation is automatically rewritten by this audit.
