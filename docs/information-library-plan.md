# In-game information library plan

This plan was accepted on 2026-11-05, after the
[CRD coverage review](crd-coverage-review.md). The implementation baseline is
`1a87c24` (PR #175). It complements the
[master content roadmap](crd-content-roadmap.md); it does not replace the open
rule and Ability automation registers.

## Purpose and boundaries

Make it possible to read a rule, find its canonical compendium content and
launch an appropriate existing aid from inside Foundry. Distinguish three
things visibly: source reference text, practical player/GM instructions, and
executable tools. A guide must never imply that every described effect is
automated. The supplied CRD remains the sole mechanical/content authority.

Preserve current document and page identities, EN/FR pairing, provenance and
translation-review history. Canonical Item definitions remain in their
compendia, linked from reference chapters rather than maintained twice.
Opening the library must not import documents or change a world.

## Delivery order

### Information architecture

The home separates **CRD reference**, **player guide**, **GM guide**, **quick
references**, **random tools** and **shortcuts**. The pilot may group related
destinations while their full documents are pending. Chapter navigation follows
the source's fourteen substantive top-level chapters, not an invented rules
taxonomy:

| Future chapter Journal | Source paragraphs | Page organization |
| --- | --- | --- |
| Creating Your Character | 1–49 | Source creation steps and choices |
| The Core Character | 50–63 | Source concepts and examples |
| Skills | 64–246 | Procedures and genre lists; linked Skill Items |
| Descriptors | 247–456 | Selection guidance; linked Descriptor Items |
| The Real World Genre | 457–617 | Subgenres, creation and equipment guidance |
| Genre Character Abilities from Types and Foci | 618–641 | Selection rules and linked canonical grants |
| Fantasy Genre | 642–1857 | Source subgenres and their creation/rules sections |
| Science Fiction Genre | 1858–2906 | Source subgenres, species and technology sections |
| Superheroes Genre | 2907–3437 | Creation, rank, scale, Power Shifts and Origins |
| Foci | 3438–5229 | Selection/progression and linked Focus/Ability Items |
| Equipment | 5230–5952 | General equipment rules, categories and linked Items |
| Cyphers | 5955–7380 | Common rules, generation and linked definitions/tables |
| Rules of the Game | 7381–7985 | Native source subsections, examples and reference tables |
| Advancing Your Character | 7986–8179 | XP, progression, downtime and projects |

These locators refer to the checked-in CRD identified in the coverage review.
Page boundaries must be reviewed against its actual subsection boundaries in
lot 2, preserving continuations and examples together. Credits/license receive
their own attribution destination. No creature or Artifact catalogue is invented.

The pilot reads `rules-en/fr` and `skills-en/fr` through canonical logical IDs.
It displays only a selected Journal's readable text pages, with a native link
to the original Journal and an associated canonical Skill link. Practical help
is rendered separately and never saved into source pages. Existing Journal,
page and Item IDs remain unchanged; future chapters must link existing
destinations rather than moving or replacing those documents. New reference
documents will enter the normal source/localization pipeline in lot 2.

The existing seven selections remain reusable reference destinations:
`journal.task-difficulty`, `journal.effort-edge`,
`journal.recoveries-healing`, `journal.distance-movement`, `journal.combat`,
`journal.task-resolution` and `journal.xp-advancement`. The pilot's canonical
Item is `skill.athletics`. No source text or catalogue identity is rewritten.

### Lot 1 — Organization and a complete pilot

Create a Cypher home with destinations for the CRD, player guide, GM guide,
quick references, random tables and macros. Define a chapter/subsection
structure that follows the CRD, separate practical guidance from reference
text, and preserve existing compendium IDs.

Deliver one complete path: **home → rule → linked Skill or Ability → associated
aid**, in EN and FR, accessible to an ordinary player under normal permissions.
Validate this vertical slice before expanding the source coverage.

The pilot reuses the seven existing Rules Journals and Athletics Skill. It
provides a task aid using the existing roll dialog, an elected-GM cypher draw
preview using the existing generation service, and an opt-in personal home
shortcut. These prototypes do not complete the later native RollTable/Macro
compendia or the full guides. Missing destinations must be explained, not shown
as functioning links. Source selections must not be labelled the complete CRD.

### Lot 2 — Format the complete CRD

- Cover all fourteen substantive chapters: Journal per major chapter, pages per
  useful subsection, full general-rule passages, examples, exceptions, callouts
  and consultation tables.
- Add links to Skills, descriptors, Types, Foci, Abilities, equipment and
  cyphers, plus links between related rules.
- Provide a master contents page and thematic index. Keep complete Item
  definitions canonical in their existing compendia.
- Review the 100 unresolved visual/callout groups and 61 Word tables in the
  [destination checklist](crd-reference-destinations.md), chapter by chapter.
- Split implementation into reviewable PRs: creation/skills; genres;
  foci/equipment; cyphers; rules/progression. Check exact chapter coverage
  against the supplied source rather than treating this grouping as a new CRD
  table of contents.

### Lot 3 — Quick references and player guide

Explain character creation/options, the sheet and equipment, tasks/Skills/
assets/Effort/Edge, attacks/defense/shields, wounds/rest/healing,
Abilities/cyphers, cooperation/rerolls/intrusions, and progression/followers.
Each procedure connects the Foundry controls to its full rule and content.

Provide quick references for difficulty, Effort, special rolls, actions,
conditions, wounds, ranges and rest. State which circumstances or prerequisites
require explicit GM declarations. Practical instructions are editorial help,
not replacement CRD passages.

### Lot 4 — GM guide and GM screen

Cover setup/access, presenting pages to players, difficulty/circumstances,
NPCs/combat/conditions/environment, intrusions/cooperation, cypher draws/awards,
XP/progression and resource-point projects. Build a compact linked screen with
entry points to supported tools. Explain manual procedures and do not expose
unsupported automation as a working action.

### Lot 5 — Native random tables

Classify all 61 source tables: reference/data tables versus genuine random
procedures. Prioritize cypher generation, power selection, redirects and inline
results; preserve exact ranges, weights, variants and canonical Item links.

Use native RollTables, nesting and Journal embeds where appropriate, including
world import when required by Foundry. Keep drawing distinct from awarding;
reuse existing generation/award services rather than introducing a second
mechanical implementation.

### Lot 6 — Player and GM macro library

- Player tools: home/quick reference, task/defense, recoveries/healing,
  supported weapon actions and cooperation.
- GM tools: GM screen, present a rule, intrusion, cypher draw/award and
  damage/environment.
- Use the same dialogs and services as sheets, explicit Actor/target selection,
  actual ownership, and normal user permissions.
- Provide dedicated compendia and hotbar shortcuts. Core navigation and tools
  remain accessible when script macros are disabled.

### Lot 7 — Installation and discovery

Provide a visible Cypher Library entry, thematic indices and contextual
“Read rule” links from sheets. Prefer lazy compendium reading.

Offer an opt-in world installation selecting home/reference/tables/macros.
Make repeat installation idempotent and protect customized documents. Do not
silently import everything or overwrite a user's hotbar or world edits.

### Lot 8 — Acceptance throughout the program

Apply these checks in every lot, rather than postponing validation until the end:

- Source completeness/provenance and accurate implementation status.
- Matching EN/FR interface and content destinations; stable document/page IDs
  and no broken links.
- Table probabilities, nested outcomes and variants where applicable.
- Ordinary-player and GM permissions, cancelled actions and resource safety.
- Live navigation and persistence after reload; keyboard access, narrow
  layouts, light/dark themes and client errors.
- Lazy loading and usable response times.

Extend the source schema, identity contracts, localization and pack builder to
`RollTable` and `Macro` before authoring their native compendium families. The
current Item/Actor/Journal pipeline must not be bypassed with hand-built packs.

## Foundry platform references

Version-sensitive implementation must be checked against the supported V13/V14
APIs. The platform guides establish the intended native capabilities:

- [Journals](https://foundryvtt.com/article/journal/): pages, headings, content
  links, showing pages and document permissions.
- [Compendiums](https://foundryvtt.com/article/compendium/): lazy content access,
  pack document types and access configuration.
- [RollTables](https://foundryvtt.com/article/roll-tables/): weighted/nested
  results and embedded rollable tables.
- [Macros](https://foundryvtt.com/article/macros/): hotbar shortcuts and
  user-controlled script permissions.
- [Adventures](https://foundryvtt.com/article/adventure/): an option to evaluate
  for later selective installation, with explicit overwrite protection.

## Progress

| Lot | Status | Acceptance boundary |
| --- | --- | --- |
| 1 | Complete; merged in PR #176 | Home, existing reference selections, task pilot, cypher preview and personal shortcut |
| 2 | In progress | Tranche 2A implemented and validated; remaining chapters follow the sequence below |
| 3 | Planned | Complete player guide and quick references |
| 4 | Planned | Complete GM guide and linked screen |
| 5 | Planned | Native source-backed random table packs |
| 6 | Planned | Complete bilingual macro packs |
| 7 | Planned | Selective repeatable world installation and broad contextual discovery |
| 8 | Ongoing | Applied to each delivered lot; no blanket compatibility claim |

## Lot 1 implementation and acceptance — 2026-11-05

The Cypher Library is available from the Journals directory, the PC header and
`await game.cypher.library.open()`. Its content-language buttons select EN/FR
compendia independently of interface language. Canonical IDs are resolved from
pack metadata, with no title-based matching or English fallback. Full documents
load only when selected; hidden packs, ambiguous identities and denied reads
are rejected. Text-page permissions and secret exclusion also apply to the
embedded source view.

The first player procedure connects Task Difficulty/Effort reference selections,
the canonical Athletics Skill and an explicit actual-PC/stat choice to the
standard task dialog. Reading a Skill does not grant/select it. Controlled
synthetic PCs remain distinct from base Actors. Costs and outcomes use the
existing task service; cancellation changes no resources.

The elected-GM cypher preview delegates to existing CRD generation and creates
no inventory or chat output. Personal home macros are created only on explicit
request and require both macro creation and script permissions. Repeating the
request reuses the user's unchanged command; customized or other-author macros
are preserved. No hotbar slot is assigned. The UI remains available with script
macros disabled.

Validation evidence:

- Six application regressions passed: lazy canonical lookup, missing/hidden/
  denied/ambiguous/wrong-type references, FR identity without fallback,
  shortcut permissions/customization/concurrency and actual synthetic PCs.
- Isolated `npm test`: **1,286 tests passed**, 32 suites, zero failures/skips.
- Lint, pilot type checking, architecture audit, locale bundle checks and
  system/E2E syntax checks passed.
- Isolated normalized pack build, archive verification and all 15 compiled-pack
  checks passed as part of the Foundry runner. No generated packs were authored
  in the working checkout.
- **Three live scenarios passed** on **Foundry 14.370**, system
  **0.2.0-alpha.1**, Chromium **153.0.8010.12**: EN/FR and light/dark navigation,
  keyboard reference activation at 480px window width, readable source and
  native Skill links, directory entry after reload, ephemeral draw, repeatable
  macro creation/execution after reload, and an ordinary player using the PC
  entry, reading a rule/Skill, cancelling then paying for a task, and retaining
  access with script macros disabled. Player client errors were empty.

V13 was not exercised live; manifest compatibility verification is unchanged.
These checks establish the pilot, not full chapter fidelity, all accessibility
criteria or every future tool. Lots 2–7 retain the boundaries above.

## Lot 2 delivery register

The baseline for tranche 2A is `5a15f3b`, after the lot 1 merge. The initial
working tree was clean. The accepted multiple-PR split remains:

| Tranche | Source chapters | Status |
| --- | --- | --- |
| 2A | Creation, core character, Skills, Descriptors; initial contents/index | Implemented and validated; awaiting merge |
| 2B | Real World, cross-genre selection, Fantasy, Science Fiction, Superheroes | Planned |
| 2C | Foci and Equipment | Planned |
| 2D | Cyphers and reference tables | Planned |
| 2E | Rules of the Game, Advancement, credits and final coverage reconciliation | Planned |

### Tranche 2A content and identity contract

Five additive Journals in `rules-en/fr` provide the first four source chapters
and editorial contents/thematic-index pages. Existing Journal/page/Item IDs are
preserved. Chapter/page identities use canonical logical IDs and stable English
page anchors. Both legacy and already canonical UUID targets are accepted only
when backed by an actual catalogue destination.

`data/crd-reference-creation.json` records a complete partition of the **446
nonblank source paragraphs at 1–456**. General instructions, examples and
callouts are present verbatim in the new English Journals, with 49 paired
French display fields. Definitions and their complete callouts/benefits remain
canonical in the **58 Skill** and **33 general Descriptor** Items; chapter lists
link to them rather than copying their descriptions. The other 20 species
Descriptors belong to later genre chapters.

The 22 new pages include an actual tier-restriction consultation table,
chapter contents, native page links and a thematic index. Source Word table 0
at paragraphs 228–237 remains complete in `skill.scavenging`, reached from the
Skill list; it is a consultation table, not a random RollTable. Visual groups
B0, B1, B2, B7 and B19 have complete bounded destinations. The other 95 baseline
open groups and 60 tables still require their later chapter-level reviews.

English source typos and source-level inconsistencies are not corrected by
this formatting work. In particular, the tier-restricted-skills callout title
retains its original English spelling, and no character-creation automation
or accepted adjudication changes.

The source authoring command validates the checked-in CRD SHA-256 before
reading paragraphs and validates the entire partition and linked definitions
before writing. `npm run check:crd-chapters` is read-only;
`npm run author:crd-chapters` intentionally regenerates only these five English
sources and their coverage register. Neither command writes French proposals,
promotes editorial status, normalizes unrelated sources or touches generated
LevelDB packs. Changes to source text require deliberate French hash review.

The five new French proposals were authored and compared clause by clause,
including numeric limits, wound overflow/death, initial choices, tier gates,
examples, conditional clauses, and existing translated Item names. They are
marked `reviewed` as an editorial disposition; numeric/markup/hash checks do
not independently certify semantics or substitute for human review.

The current inventory is **1,378** canonical EN documents and their FR
counterparts, including **12** Rules Journals (seven existing selections plus
five additions). Historical translation-batch manifests remain fixed; the
explicit reference inventory adds the new Journals to whole-catalogue checks.

The library now separates chapters from quick references and renders one
readable chapter page at a time. Language switching, text-page permissions,
hidden packs and secret exclusion retain the lot 1 boundaries. The native
[Foundry Journal and dynamic-link capabilities](https://foundryvtt.com/article/journal/)
provide the standalone contents/page/Item navigation.

### Tranche 2A validation — 2026-11-05

- Isolated `npm test`: **1,293 tests**, 32 suites, zero failures/skips, including
  complete source partitioning, missing-definition rejection, canonical/page
  references, bilingual fields and migration repeatability.
- `check:crd-chapters` reproduced all five Journals and their paragraph register.
  The Rules Journal audit validated **12 reviewed** proposals. The terminology
  audit reported zero blocking errors; advisory wording/mechanic flags remain
  separate from source fidelity and semantic certification.
- Lint, pilot type checking, architecture, locale and runtime/E2E syntax checks
  passed. The isolated runner built all 14 packs, passed 15 compiled-pack
  checks and verified the archive.
- **Four live scenarios passed** on **Foundry 14.370**, system
  **0.2.0-alpha.1**, Chromium **153.0.8010.12**: preserved pilot behavior,
  ordinary-player EN/FR chapter/Descriptor access, cancelled/paid tasks,
  disabled script macros, every chapter/index page in both locales and both
  themes, keyboard page selection, native page links and reload.
- After inspecting a live capture, selected-button text was corrected to use
  the theme's text token. The chapter scenario was rerun successfully on the
  final CSS, measuring **at least 4.5:1** contrast on selected page buttons in
  both themes at 480px window width. This is not a complete accessibility audit.

V13 remains untested live and manifest verification is unchanged. The working
tree changes cover five English sources, five French proposals, the source
partition, authoring/localization tooling, library UI/locale bundles, focused
tests and documentation. No generated LevelDB packs or existing source records
were edited, and no commit/push was performed. Tranches 2B–2E remain open.
