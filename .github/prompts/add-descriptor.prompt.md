---
name: Add Descriptor
description: "Add one bilingual Cypher Descriptor directly to the English and French source compendiums, validate its Pool and skill choices, and rebuild the affected Foundry packs."
argument-hint: "English and French Descriptor names, CRD mechanic, and localization reference or enough information to locate them."
agent: "Cypher Foundry VTT Expert"
---

Add the single Descriptor requested by the user directly to the English and French `_source` compendiums.

Follow [the compendium workflow](../skills/foundry-compendium-workflow/SKILL.md). Inspect current files before editing because the working tree may contain user changes.

If the Descriptor identity, authoritative mechanic, or French localization cannot be located, ask one concise blocking question. Otherwise proceed end to end:

1. Use the CRD for Pool and skill mechanics and the French Character Book for localized terminology. Write concise original summaries rather than copying source prose.
2. Inspect `module/data-models/item-descriptor.mjs`, the focused compendium tests, and the closest existing bilingual Descriptor pair.
3. Create matching filenames under `packs/descriptors-en/_source/` and `packs/descriptors-fr/_source/`. Use unique 16-character document IDs with matching `_key` values.
4. Align `statOptions`, `statAmount`, structure, and supported fields across languages. Localize skill names and descriptions while preserving their intended choices.
5. Run `node --test tests/compendium-sources.test.mjs`, then `npm test`.
6. Rebuild both Descriptor LevelDB packs from their `_source` directories using a temporary output location, excluding transient logs and locks.
7. Report the records added, source mapping, test results, packaging results, and any live Foundry verification still required.

Do not invoke or recreate a content generator, edit LevelDB files by hand, alter unrelated Descriptor records, claim live success without observing Foundry, commit, or release unless explicitly requested.
