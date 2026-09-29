---
name: Add Focus
description: "Add one bilingual Cypher Focus/Foyer from authoritative local references, encode its ability flowchart, validate both source records, and rebuild the affected Foundry compendium packs."
argument-hint: "English and French Focus names, plus the CRD section and flowchart image or enough information to locate them."
agent: "Cypher Foundry VTT Expert"
---

Add the single Focus/Foyer requested by the user to the English and French compendiums.

Follow [the Focus workflow](../skills/foundry-focus-workflow/SKILL.md) and [the compendium workflow](../skills/foundry-compendium-workflow/SKILL.md). Inspect current files before editing because the working tree may contain user changes.

If the Focus identity or authoritative prose/flowchart cannot be located, ask one concise blocking question. Otherwise proceed end to end:

1. Identify the authoritative prose, graph image, and French localization source. State which source owns mechanics, graph edges, and translated text.
2. Inspect the DataModel, graph contract, and one current bilingual pair. Choose unique 16-character Foundry document IDs and stable matching ability IDs.
3. Create aligned records under `packs/foci-en/_source/` and `packs/foci-fr/_source/`. Encode only explicit graph arrows; never infer prerequisites.
4. Run the focused graph and source-contract tests, then `npm test`.
5. Rebuild both Focus LevelDB packs from their `_source` directories using a temporary output location. Preserve unrelated working-tree changes and exclude transient LevelDB logs and locks.
6. Report the records added, source mapping, graph ambiguities resolved or remaining, exact test results, packaging results, and any live Foundry verification still required.

Do not copy substantial CRD prose, edit LevelDB files by hand, alter unrelated Focus records, claim a pack loaded in Foundry without observing it, commit, or release unless explicitly requested.
