---
name: Add Type
description: "Add one bilingual Cypher Type directly to the English and French source compendiums, validate its mechanics and folder placement, and rebuild the affected Foundry packs."
argument-hint: "Type name, genre/subgenre, CRD section, and French localization reference or enough information to locate them."
agent: "Cypher Foundry VTT Expert"
---

Add the single Type requested by the user directly to the English and French `_source` compendiums.

Follow [the compendium workflow](../skills/foundry-compendium-workflow/SKILL.md). Inspect current files before editing because the working tree may contain user changes.

If the Type identity, authoritative CRD section, or French localization cannot be located, ask one concise blocking question. Otherwise proceed end to end:

1. Use CRD prose for mechanics and the French Character Book for localization. Do not derive mechanics from translated prose.
2. Inspect `module/data-models/item-type.mjs`, the focused compendium tests, the target genre/subgenre folders, and the closest existing bilingual Type pair.
3. Create matching filenames under `packs/types-en/_source/` and `packs/types-fr/_source/`. Use unique 16-character document IDs, matching `_key` values, original summaries, and the correct language-specific folder IDs.
4. Keep document-level mechanics and ability counts aligned. Preserve localized ability names and descriptions without copying substantial source text.
5. Run `node --test tests/compendium-sources.test.mjs`, then `npm test`.
6. Rebuild both Type LevelDB packs from their `_source` directories using a temporary output location, excluding transient logs and locks.
7. Report the records and folders added, source mapping, test results, packaging results, and any live Foundry verification still required.

Do not invoke or recreate a content generator, edit LevelDB files by hand, alter unrelated Type records, claim live success without observing Foundry, commit, or release unless explicitly requested.
