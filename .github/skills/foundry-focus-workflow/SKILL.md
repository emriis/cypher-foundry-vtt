---
name: foundry-focus-workflow
description: 'Use when adding, translating, reviewing, validating, or packaging Cypher Focus/Foci/Foyer content and ability flowcharts in this repository, including graph arrows, prerequisites, tiers, costs, bilingual FR/EN records, and Focus compendium sources.'
---

# Foundry Focus workflow

Use this workflow for Focus/Foci/Foyer compendium content and its directed ability graphs. Also follow `.github/skills/foundry-compendium-workflow/SKILL.md`; use `.github/skills/cypher-rule-tdd/SKILL.md` when changing application, eligibility, tier-selection, or sheet behavior rather than content alone.

## Establish source authority

1. Read the relevant sections of `docs/development.md`, the Focus DataModel, `tests/focus-graphs.test.mjs`, and representative paired records under `packs/foci-{en,fr}/_source/`.
2. Consult only the relevant files in `docs/local/` and follow `.github/skills/local-reference-library/SKILL.md`. If a required source is unavailable, stop instead of reconstructing mechanics from memory.
3. Map each field to its authority before authoring:
   - Use CRD prose for ability names, tiers, costs, and mechanical facts.
   - Use the authoritative flowchart image only for directed prerequisite edges.
   - Use French reference material for localization unless the task establishes that it owns a mechanic.
   - Use existing records for schema and style, not as authority over conflicting source material.
4. When source ownership does not resolve a material conflict, ask the user. Do not silently merge contradictory evidence.

## Encode the graph

- Preserve only arrows explicitly visible in the flowchart. Do not infer links from prose, visual proximity, tier progression, or theme.
- Store an incoming arrow as the target ability's prerequisite ID. Multiple prerequisite IDs are OR alternatives unless the source explicitly defines another relation.
- Allow prerequisites from the same tier or an earlier tier. Reject edges from a future tier.
- Keep ability IDs stable and unique within the Focus. Ensure every prerequisite resolves to an ability in the same record.
- Use the prose tier when a diagram's placement or labeling appears inconsistent with the text.

## Author bilingual records

1. Keep the English and French records structurally aligned: Foundry document type, ability count and order, stable ability IDs, tiers, costs, and prerequisite arrays.
2. Localize names and write concise original summaries. Do not copy substantial CRD prose.
3. Preserve valid 16-character Foundry document IDs and matching `_key` values. Check IDs programmatically rather than visually.
4. Edit `_source` JSON only. Never hand-edit LevelDB files.

## Validate and package

1. Run the graph contract first:

   ```powershell
   node --test tests/focus-graphs.test.mjs
   ```

2. Run the broader source contracts when Focus records change, then `npm test`.
3. Compile each affected language pack by following the packaging procedure in `.github/skills/foundry-compendium-workflow/SKILL.md`.
4. When distribution or runtime confidence is required, follow `.github/skills/foundry-live-validation/SKILL.md` and inspect representative records in a disposable world. Packaging success alone does not prove that Foundry loaded the packs.

## Report

Name the local references used without exposing private contents. Report source validation, automated tests, EN/FR pack compilation, and live Foundry verification as separate results. State missing sources, unresolved graph arrows, and unavailable runtime checks explicitly.
