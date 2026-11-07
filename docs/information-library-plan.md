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
| 2 | Complete; merged | All fourteen source chapters, attribution, complete paragraph/table reconciliation |
| 3 | Complete; awaiting merge | Twelve player procedures and eight linked quick-reference cards |
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
| 2A | Creation, core character, Skills, Descriptors; initial contents/index | Merged in PR #177 |
| 2B | Real World, cross-genre selection, Fantasy, Science Fiction, Superheroes | Merged in PR #178 |
| 2C | Foci and Equipment | Merged, confirmed before tranche 2D |
| 2D | Cyphers and reference tables | Merged in PR #180 |
| 2E | Rules of the Game, Advancement, credits and final coverage reconciliation | Merged in PR #181 |

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

The inventory after 2A was **1,378** canonical EN documents and their FR
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
were edited, and no commit/push was performed. This records the 2A validation
scope; the subsequent 2B delivery follows below.

### Tranche 2B content and identity contract

Baseline: `75455bc`, after PR #177, with a clean working tree. Five additive
Journals provide **28 pages** and **61 French display fields** for the Real
World, cross-genre Ability instructions, Fantasy, Science Fiction and
Superheroes. The existing contents and thematic index now link all nine source
chapters, for **50 reference/index pages** in total. Existing document/page
identities, the seven quick references and all fourteen pack IDs are preserved.

`data/crd-reference-genres.json` partitions every one of the **2,947 nonblank
paragraphs at 457–3437** under the supplied CRD hash. Each contiguous interval
identifies a Journal page or an exact canonical Item field, with its source
hash. A paragraph is replaced by an Item link only when its whole text is
present in that field; explicit Ability costs and owning Type references bound
the match. Same-name Types are scoped by their CRD subgenre. Explicit
cross-subgenre Type references point to their original definition. Ambiguous
historical Type lists and same-name Ability occurrences remain readable in
full and are listed in `unresolved`; names alone never select a variant.

Source spelling is preserved, including the shortened Skill labels at 539 and
2562, whose native links resolve to their explicitly identified complete
definitions. The custom Word H2 style does not advance parser section paths;
page anchors therefore include their locked source paragraph to distinguish
sibling headings. Regression coverage checks uniqueness and visibility of every
source paragraph, not just link counts.

The superhero comparison at **3065–3088** is preserved as a native HTML
consultation table, in source cell order, with paired French headings and
labels. It is not a random RollTable. The genre partition closes **47 more
baseline visual groups**, leaving **48** of the original 100, plus **59** of
the 61 Word tables for subsequent chapter-level reconciliation. The generic
callout audit remains a conservative paragraph-matching diagnostic and can
report short linked labels as unproven; its count is not the bounded chapter
partition. See the [destination checklist](crd-reference-destinations.md).

Complete French prose was compared against the source paragraphs, including
optional Real World action rules, wound-treatment times, genre choices, power
shifts, really impossible tasks and examples. Existing whole translated
passages were reused only after exact English correspondence. Named abilities,
Types and Foci follow their canonical French proposals. Editorial status is
`reviewed`; authoring/check/build commands never promote it automatically.

The inventory after 2B was **1,383** canonical EN documents with paired FR
documents, including **17 Rules Journals**. Source completeness does not add
gameplay automation: optional rules, genre exceptions, origin powers and
power-shift advice become consultable without changing the accepted runtime
rulings or enabling optional rules. Both formerly deferred superhero creation
examples at 3035–3036 now have complete Journal destinations. The Equipment
callout at 5594 and Doing Something Else at 7953 remain deferred to 2C and 2E.

### Tranche 2B validation — 2026-11-06

- Isolated `npm test`: **1,298 tests**, 32 suites, zero failures/skips. The
  genre contracts cover all 2,947 paragraphs, unique page identities, exact
  canonical field evidence, ambiguous variants, every native destination and
  all 24 superhero table cells, including seven native Type links.
- Both read-only authoring checks reproduced their source JSON and partitions.
  The Rules Journal audit validated **17 reviewed** proposals and **135 paired
  display fields** without typed mechanic differences. A final isolated
  Journal-localization test passed after aligning the last advanced-power
  cypher wording; direct execution against legacy unnormalized sources is not
  the catalogue test contract.
- Terminology audit: zero blocking errors. Remaining Effort wording flags were
  checked against their actual source conditions and costs. Generic callout
  audit passed with the two remaining explicit deferrals. Its paragraph-only
  review count remains separate from the source-bounded chapter dispositions.
- Lint, pilot type checking, architecture, locale, system and E2E syntax checks
  passed. The disposable E2E runner built **all 14 packs**, passed **15 compiled
  pack checks**, and verified the archive.
- **Four live scenarios passed** on **Foundry 14.370**, system
  **0.2.0-alpha.1**, Chromium **153.0.8010.12**. They cover the preserved pilot,
  ephemeral cypher preview and repeatable shortcut, ordinary-player EN/FR
  Descriptor and Ability links, cancellation without spending, a paid task,
  script permission restrictions and reload.
- The exhaustive chapter scenario waits for each selected chapter render,
  checks its expected page count and visits **all 50 pages** in EN/FR and both
  themes: **200 distinct page renders**. It checks native links, keyboard page
  selection, one source page at a time, selected-button contrast of at least
  4.5:1 and absence of library-level horizontal overflow at 480px. Native
  contents/page links and reload passed. This is not a complete accessibility
  audit. Test synchronization now waits for outgoing task dialogs and chapter
  renders rather than racing their DOM replacement.

V13 remains untested live; manifest verification is unchanged. No commit,
push, generated LevelDB replacement or user-world mutation is part of this lot.
The next authorized sequence remains **2C Foci and Equipment**, **2D Cyphers**,
then **2E Rules, Advancement, credits and coverage reconciliation**.

### Tranche 2C content and identity contract

Baseline: `a3a6fcd`, after PR #178, with a clean working tree. Two additive
Journals provide **46 Foci pages** and **13 Equipment pages**, with **120 new
French display fields**. The contents and thematic index now reach eleven
source chapters, for **109 reference/index pages** in total. All existing
document/page identities and fourteen pack IDs are preserved.

`data/crd-reference-details.json` partitions the **2,368 nonblank paragraphs
at 3438–5952** under the supplied CRD hash. A source paragraph is omitted from
Journal prose only when its whole text is proven in a specific field of its
owning Focus or an Ability actually referenced by that Focus. Unmatched wording
remains complete in the Journal, rather than being reconstructed from another
variant. The chapter links all **42 native Focus sheets**, including their
existing tier/prerequisite views derived from authored flowchart edges. This
lot does not change Focus graphs, acquisition eligibility or runtime powers.

The ordinary-player live check exposed an existing Focus-sheet rendering error:
its activation-label callback lost the Foundry localization context. The same
inspection showed Focus and Type views reading flattened legacy Ability fields
instead of actual `Ability.system` data. Both views now project document names,
system costs/descriptions and flags explicitly; Focus prerequisites still come
from the existing graph, and Type labels honor the owning Type's tier mapping.
Focused regression tests reproduce the rendering error and unnamed/free
Ability rows with Document-shaped inputs. This is a presentation correction,
without changing costs, prerequisites, advancement or saved content.
The Type and Focus cards also render the passive activation label once,
instead of repeating it beside the same activation classification.

All **26 Word tables (indices 2–27)** retain their **674 cells**, including
**31 blank cells**, in source order. These are consultation tables: animal-form
examples, item/weapon comparisons and currency equivalents. They do not become
random RollTables. All **259 equipment rows** link to distinct existing Items
selected by the full canonical English genre/price/name tuple. Same-name
equipment from different genres or price categories is never merged. Notes,
levels, damage, range and other columns remain readable in the reference.

The English source preserves examples, optional ammunition handling, equipment
intrusions, armor/weapon rules, artifact depletion and currency-context advice.
French proposals were compared with those clauses and their numeric limits;
reuse was restricted to complete matching English text. Native cost labels
translate Pool names and their conjunctions. Three cost-choice labels in the
existing Fantasy/Science Fiction French references were also corrected from
English “or” to French “ou”; their UUIDs, costs and English source stay intact.
Authoring/check/build commands never promote editorial review status.

This closes **17 more baseline visual groups**, leaving **31** of the original
100, plus **33** of the original 61 Word tables for 2D–2E. The Equipment
intrusion at **5594** is now complete and removed from the deferral register;
only **7953**, Doing Something Else, remains explicitly deferred. Source-bound
dispositions and the generic paragraph-matching callout diagnostic remain
separate. The [destination checklist](crd-reference-destinations.md) retains
the original indices for traceability.

At 2C delivery, the inventory was **1,385 canonical EN documents** with paired FR
documents, including **19 Rules Journals** and **255 paired Journal display
fields**. The source authoring and validation commands normalize legacy
catalogue inputs in disposable workspaces. Existing Focus, Ability and equipment
definitions, generated LevelDB packs and user worlds are not edited.

### Tranche 2C validation — 2026-11-06–07

The isolated complete Node suite passes **1,306 tests**, with no failures or
skips. Focused content contracts check complete paragraph coverage, all table
cells including blanks, native Item identities and read-only authoring
reproducibility. Document-shaped regression tests cover the Focus/Type
presentation fixes. Lint, pilot type checking, architecture, locale and syntax
checks pass. Journal, translation, terminology and callout audits pass, with
**19 reviewed Rules Journals** and **255 paired display fields**; the sole
explicit callout deferral remains paragraph 7953.

The isolated Foundry build compiles **14 packs**, passes **15 compiled-pack
checks** and verifies the package archive. All **four library E2E scenarios**
pass on **Foundry V14.370 / Chromium 153.0.8010.12**. The exhaustive scenario
visits all **109 pages** in EN/FR and light/dark themes, for **436 page renders**,
checking native links, keyboard navigation and the 480px library layout. The
ordinary-player scenario opens native Focus and equipment sheets, with visible
Focus prerequisites. A final ordinary-player rerun also passes after removing
the duplicated passive activation label, with an explicit tag-count assertion
in both languages. French Focus and narrow equipment-table screenshots were
also inspected. These observations do not constitute a complete accessibility
audit. V13 remains untested live; manifest verification is unchanged.

No commit or push is part of this lot. Next: **2D Cyphers**, then **2E Rules,
Advancement, credits and final coverage reconciliation**.

### Tranche 2D content and identity contract

Baseline: `b4166f7`, with a clean working tree and the user-confirmed 2C merge.
One additive `journal.crd-cyphers` provides **22 EN/FR pages** and **45 new
French display fields**. The contents/index now reaches twelve source chapters,
for **131 reference/index pages** overall. Existing Journal/page/Item and pack
identities are preserved. The inventory becomes **1,386 canonical EN documents**
with paired FR documents, including **20 Rules Journals** and **300 paired
Journal display fields**.

The [Cypher paragraph register](../data/crd-reference-cyphers.json) partitions
all **1,202 nonblank paragraphs at 5955–7380** under the pinned source hash.
All **198 definitions** link to their native Items: **86 nonphysical**, **103
manifest** and **9 power-boost** cyphers. Definition prose is replaced by a link
only when the complete source paragraph is proven in a specific field of that
same Item; unmatched wording stays verbatim in the Journal. This does not
expand effect automation, change generation probabilities or modify owned Items.

All **11 Word tables (28–38)** remain readable, retaining **691 cells**,
including **208 blank cells**, in source order. These include general and
superhero generation, manifest power selection, the five manifest power
categories, Energy Blast, Image Projector and Teleporter results. Power-table
labels navigate to the relevant Journal pages; the superhero fallback reaches
the general Cypher table. Named Teleporter variants link to the common Item
while retaining their variant label, without selecting a variant or rolling it.
Tables are references in this tranche; native executable RollTables remain
**lot 5**, which will reuse the existing generation/award services.

The supplied DOCX has empty icon cells and mentions a nonstandard-cypher symbol
without supplying a symbol, drawing or image in these paragraphs. Empty cells
and source wording are preserved; no symbol or power icon is invented. Tables
in this chapter have no merged cells. They are not flattened into prose or
discarded because a native Item also contains structured table data.

This closes **seven more baseline visual groups** (B157–B160, B167–B169), for
**76 covered and 24 remaining**, and brings source-table coverage to **39/61**,
with **22** remaining for 2E. The sole explicit deferred callout remains Doing
Something Else at paragraph 7953. Source and native links keep the distinction
between effect level and power category, nonphysical instant activation and
manifest action activation, recovery-based expiration and exceptional fixed
durations. French content is reviewed against these clauses and complete
matching source text; authoring and audits never promote review status.

### Tranche 2D validation — 2026-11-07

The isolated complete Node suite passes **1,311 tests**, with no failures or
skips. The source contracts verify each complete paragraph and its source hash,
all eleven table structures including empty cells, all 198 native definitions,
variant labels and internal page links. Missing definitions and changed source
boundaries fail closed. Authoring checks reproduce the stored chapter/index.
The service regression covers lazy bilingual discovery and observer permission.
Lint, pilot type checking, architecture, locale and E2E syntax checks pass.
Journal, translation, terminology and normalized callout audits pass, including
**20 reviewed Rules Journals**, **300 paired display fields** and no mechanical
differences. Paragraph 7953 remains the sole explicit deferred callout.

The isolated build compiles all **14 packs**, passes **15 compiled-pack checks**
and verifies the packaged archive. All **four library E2E scenarios** pass on
**Foundry V14.370 / Chromium 153.0.8010.12**, system `0.2.0-alpha.1`. An ordinary
player opens native definitions in all three Cypher families in EN/FR without
creating owned Items or ChatMessages. The exhaustive scenario renders all
**131 pages** in both languages and themes (**524 page renders**), checking
native links, keyboard selection, selected-button contrast and 480px library
layout. The French medium-power table was also visually inspected at 480px,
including its roll ranges and native Item labels. This is focused observation,
not a complete accessibility audit. V13 remains untested live; manifest
verification is unchanged.
The exhaustive page scenario also passes again after adjusting its screenshot
step to bring the Cypher table into view.

Changes are limited to the additive EN/FR chapter and paragraph register,
contents/index, library discovery, Node authoring/inventory tooling, regression
tests and documentation. Existing Cypher definitions, generated LevelDB packs,
release artifacts and user worlds are not modified. No commit or push is part
of this tranche. Next: **2E Rules of the Game, Advancement, credits and final
coverage reconciliation**.

### Tranche 2E content and identity contract

Baseline: `221b1e7`, after PR #180, with a clean working tree. Three additive
Journals provide **27 Rules of the Game pages**, **18 advancement pages** and
**three attribution pages**, with **99 new French display fields**. The
library now exposes all **fourteen substantive source chapters**, their
contents/index and separate credits, for **179 reference/index/attribution
pages**. The inventory becomes **1,389 canonical EN documents** with paired
FR documents, **23 Rules Journals** and **399 paired Journal display fields**.
Existing source document/page/Item and pack identities are preserved.

The [final paragraph partition](../data/crd-reference-final.json) covers all
**784 nonblank paragraphs at 7381–8201 plus the front-matter title at 0**.
Rules retain their examples, glossary, action timing, wounds and Pool damage,
object destruction, treatment/rest tables, conditions, circumstances, defenses,
cooperation, guarding, interactions and followers. Advancement includes all
character-arc examples, optional XP policies, spending and advancement choices,
resource-point projects and advancement beyond tier 6. Source text is kept
verbatim in EN and translated completely in FR; it does not amend the accepted
runtime adjudications or claim new effect automation.

All **22 final Word tables (39–60)** preserve **190 cells**. Table 55 has two
source paragraphs in its final cell; their boundary remains a line break,
rather than becoming a new row or losing one statement. Table 46 contains
eight genre statements with no header row. These difficulty, action, damage,
healing, circumstance, crafting and research tables are consultation data,
not random procedures. Twelve native page links connect related general rules
and advancement procedures, including intrusions, defenses, cooperation,
followers and projects. The ordinary library permission checks still apply.

Credits preserve the source's contributors, copyright and publisher statement.
An explicit editorial note attributes that statement to the source publisher;
it is not a production claim about this unofficial Foundry adaptation. The
source ends its values statement without supplying a URL, so none is invented.
The separate license page carries the independent-production/trademark notices
and license URL already supplied in `LICENSE.txt`, rather than fabricating a
license section in the CRD. The title at paragraph 0 has its own source page.

The [complete reconciliation](../data/crd-reference-completeness.json) now maps
all **7,747 nonblank paragraphs** of the **8,202-paragraph source**, including
front matter and credits, to exactly one source destination across 2A–2E.
Every partition hash is checked before reconciliation. All **61 tables** have
source-bound destinations, retaining **1,589 cells** including **239 blanks**.
All **100 historical open visual groups** have complete paragraph destinations;
this is not a new visual-layout certification or proof of effect automation.
The last explicit deferral, Doing Something Else at 7953, is removed. Historical
substring audit scores remain separate from this complete source partition.

### Tranche 2E validation — 2026-11-07

The final isolated complete suite passes **1,316 Node tests**, with no failures
or skips. Focused regressions verify all final paragraphs, table-cell boundaries,
related native page links, attribution and read-only authoring reproducibility.
Cross-tranche tests reject missing/duplicate source ownership and stale source
hashes. Lint, pilot type checking, architecture, locale and syntax checks pass.
Journal, i18n, terminology and normalized callout audits pass: **23 reviewed
Rules Journals**, **399 paired display fields**, no mechanical differences and
no explicit callout deferrals.

The isolated build compiles **14 packs**, passes **15 compiled-pack checks**
and verifies the packaged archive. All **four library E2E scenarios** pass on
**Foundry V14.370 / Chromium 153.0.8010.12**, system `0.2.0-alpha.1`. The
exhaustive scenario visits all **179 pages** in both languages and themes,
for **716 page renders**, checking native links, keyboard selection, selected
contrast and 480px library layout. An ordinary player opens related rules,
advancement and credits in EN/FR without creating Items or ChatMessages. The
French difficulty table was also visually inspected in the narrow layout.
This is focused observation, not a complete accessibility certification. V13
remains untested live; manifest verification is unchanged.

Live validation exposed Foundry enriching a visible URL inside its existing
license anchor, producing an extra empty link. The license now uses a descriptive
label with the same destination; the final player scenario verifies exactly
one usable link in each language. The source and complete suites were rerun
after that correction. The exhaustive scenario has a bounded four-minute
timeout for its 716 renders rather than the preceding 524-render workload.

Changed families are the three EN/FR Journals and contents/index, the final and
complete coverage registers and cleared deferral, Node authoring/inventory/audit
tools, library discovery and its EN/FR introductory text/bundles, regression
tests and planning/audit documentation. Existing canonical Item definitions,
generated LevelDB packs, release artifacts and user worlds are not edited.
No commit or push is part of this tranche. Lot 2 is complete as a source-reference
delivery. Next: **3: player guide and quick references**; executable random
tables remain lot 5 and the separate runtime automation register remains open.

## Lot 3 delivery register

Baseline: `7506711`, after PR #181, with a clean working tree. Two additive
editorial resources in the existing `rules-en/fr` packs provide a **twelve-page
player guide** and **eight quick-reference cards**, with **42 new paired French
display fields**. Canonical IDs are `journal.player-guide` and
`journal.player-quick-reference`; neither belongs to the fourteen-chapter source
partition. The catalogue becomes **1,391 EN documents** with paired FR documents,
including **25 Rules Journals** and **441 paired Journal display fields**.

The player procedures cover starting/access/language, creation choices, the
sheet/equipment readiness, task rolls, attacks, defenses/shields, recovery and
wound healing, abilities/cyphers, cooperation/guarding/conditions, rerolls/retries/
intrusions, advancement/projects and followers/companions. They identify actual
sheet controls and link complete CRD context. Permissions, fictional applicability,
declared range/position and unsupported effects remain explicit. The guide does
not claim that reading content grants it, that a generic activation executes
every power, or that source text closes the separate automation backlog.

Quick cards cover difficulty, Effort/Edge, special rolls, action timing,
conditions/special damage, wounds/Pool damage, ranges/movement and rest/healing.
They retain selected **complete CRD paragraphs and table cells**, rather than
inventing replacement rule summaries; every card links to the full procedure,
examples and exceptions. They do not become RollTables. Existing seven quick
selections, all source chapter/page/Item identities and all fourteen pack IDs
are preserved. The full CRD partition remains **7,747 paragraphs / 61 tables /
100 historical visual groups**, without assigning overlapping guide excerpts
as additional canonical source destinations.

The [player resource contract](../data/library-player-resources.json) records
pinned source ranges/hashes and actual sheet action/template references for
regression checks. English prose is authored in the two `_source` records;
French remains separately reviewed source-hashed proposals. This contract
does not store a second copy of the prose or assert executable power coverage.

Library discovery gives these resources distinct allowlisted roles. The guide
has its own navigation section; cards remain beside quick references. A shared
reader presents a single selected page, explicitly labelled as practical help
or selected excerpts rather than the complete source. Role and pagination come
from the destination allowlist, not arbitrary Journal flags. Existing ordinary
task dialogs/services remain the launch path; reading never imports documents,
spends resources or requires script macros.

### Lot 3 validation — 2026-11-07

The isolated complete suite passes **1,321 Node tests**, with no failures or
skips. Focused content and permission tests check stable identity, complete
EN/FR fields, guarded translations, native page links, whole source excerpts,
table order and the continued existence of documented sheet controls. Journal
localization contracts now include both editorial resources alongside the
source Journals. Lint, pilot type checking, architecture, locale and E2E syntax
checks pass. The Journal audit reports **25 reviewed Journals / 441 paired
display fields**; i18n and terminology audits report no mechanical differences
or blocking terminology errors. Complete source coverage remains unchanged.

The isolated build compiles **14 packs**, passes **15 compiled-pack checks**
and verifies the packaged archive. All **five library E2E scenarios** pass on
**Foundry V14.370 / Chromium 153.0.8010.12**, system `0.2.0-alpha.1`. The new
scenario visits the twenty player pages in both languages and themes at 480px
width (**80 renders**), checking keyboard selection, native full-rule links,
pagination, reload and absence of world-document creation. The existing
exhaustive source scenario still passes its **716 renders**. An ordinary player
opens the guide, follows its full-rule link, cancels a task safely and then
performs a paid task through the existing aid with script macros disabled.

The French task-guide page was visually inspected in the narrow layout. These
are focused observations, not a complete accessibility certification. V13
remains untested live; manifest verification is unchanged.

Changed families are two EN Journals and their reviewed French proposals,
the evidence contract and inventory/audit tooling, library discovery/reader
and template, EN/FR locale fragments and generated bundles, content/service/live
tests, and planning/source/development documentation. Existing canonical Item
definitions, generated LevelDB packs, release artifacts and user worlds are
not edited. No commit or push is part of this lot. Next: **lot 4, GM guide and
linked GM screen**.
