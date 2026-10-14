# Compendium localization audit

This document records the localization work as of 2026-10-14. The supplied
2026-07-29 CRD is the sole authority for names, descriptions, mechanics and
entry boundaries. French wording is an editorial rendering of that content;
existing prose, matching numbers and passing schema checks do not establish
semantic approval.

The maintained commands, proposal schema, glossary and Foundry language-setting
instructions are in [Localization authoring and review](localization.md).

## Normalized inventory and editorial coverage

The manifest retains seven content families in each language. Equipment contains
ordinary Equipment, Weapons, Armor, Shields and Cyphers. Rules are JournalEntry
documents; the other families are Item documents. Folders are excluded below.

| Family | Normalized EN records | Normalized FR records | French proposals | Translated fields | Review status |
| --- | ---: | ---: | ---: | ---: | --- |
| Abilities | 701 | 701 | 701 | 1,416 | Proposed |
| Skills | 58 | 58 | 58 | 116 | Proposed |
| Descriptors | 53 | 53 | 53 | 272 | Proposed |
| Types | 55 | 55 | 55 | 110 | Proposed |
| Foci | 42 | 42 | 42 | 84 | Proposed |
| Rules | 7 | 7 | 7 | 25 | Proposed |
| Equipment | 457 | 457 | 457 | 958 | Proposed |
| Total | 1,373 | 1,373 | 1,373 | 2,981 | Editorial drafts |

The normalized preview audit completed successfully: every translatable field
has a current French proposal, with no orphaned proposals, typed mechanical
differences or numeric/markup/reference safeguard failures. These are full
French drafts, not English fallback records labeled as completed translations.
None has been silently promoted to `reviewed`.

Coverage includes nested effect text, Effort explanations, properties, Skill
labels, variants, table labels/results and Journal page content where present.
`audit:i18n` generates `reports/i18n-content-review.json` after normalizing a
disposable checkout. It distinguishes `missing`, `incomplete`, `invalid`,
`proposed` and `reviewed` entries. Exact source hashes establish freshness;
the safeguards protect mechanically significant tokens, but do not certify the
meaning of conditional prose.

Raw authoring counts and normalized counts are different inventories. Source
normalization merges the explicit Genre catalogue, removes editorial artifacts,
deduplicates definitions and creates required language counterparts. Use logical
IDs to pair languages; legacy filenames and localized names are unreliable
pairing keys.

## What the initial audit found

The 2026-10-11 baseline contained 1,372 normalized records per language,
including 700 Abilities. Hundreds of French fields still contained English
text, while the `English source retained pending French translation` marker
appeared on only twenty raw records. That marker was therefore not a coverage
metric. The new proposal inventory measures the actual translatable fields.

The baseline also exposed French descriptions that contradicted or omitted
parts of their English source. For example, the old Iron Punch text described
an unrelated unarmed bonus, Dual Wield omitted timing restrictions, and
Appealing omitted characteristics and the trained-Skill alternative. Those
findings motivated full source-bound proposals instead of preserving old text
solely because it was already French. Legacy `_source` text may still be visible
in ordinary builds until a reviewed proposal is selected; the complete proposed
versions are available through the explicit draft-build workflow.

The previous Type and Focus introduction-only descriptions omitted parent
context. All 55 Type descriptions now retain the source-backed introductory,
Background Options, initial-benefit and equipment-package context applicable to
that Type. All 42 Focus descriptions now retain the applicable Genre themes,
GM intrusions and other parent context before the Ability progression. Standalone
Ability Items remain linked definitions; they do not justify omitting narrative
sections from their parent Item. Equipment bundles are included only where the
CRD supplies them, including the distinction for superhero Types.

Other restored English boundaries include the five attack-choice parent
definitions and their options, the full Idol procedure, and the separate Wings
Ability previously swallowed by Poison Bite. The Howls at the Moon graph now
follows the actual CRD diagram, including Wings and its directed edges. These
changes explain the additional normalized Ability and are covered by focused
source and graph regressions.

## English source-fidelity evidence

The regenerated normalized CRD audit completed successfully after those boundary
restorations. Its local report is `reports/i18n-crd-final.json`, produced with:

```powershell
npm run audit:crd -- --normalized --output reports/i18n-crd-final.json
```

It covers 1,373 English entries and 1,493 textual fields: 1,293 exact-passage
matches, 169 exact-fragment matches and 31 empty equipment notes. No mismatch was
detected in the audited fields. Evidence scopes remain distinct:

| Family | Exact passages | Exact fragments | Empty notes |
| --- | ---: | ---: | ---: |
| Abilities | 703 | 8 | 0 |
| Descriptors | 55 | 37 | 0 |
| Equipment | 426 | 69 | 31 |
| Foci | 42 | 0 | 0 |
| Rules | 9 | 0 | 0 |
| Skills | 3 | 55 | 0 |
| Types | 55 | 0 | 0 |
| Total | 1,293 | 169 | 31 |

An additional independent boundary check on 2026-10-13 inspected all 169
fragment fields against their own source context, rather than accepting the
first matching words anywhere in the document:

- The eight Ability fragments contain six complete result labels from the
  Apportation and Improved Apportation callouts (paragraphs 4543–4547 and
  4557–4561), and the two complete Divine Radiance Effort clauses (845 and 849).
  Result ranges and introductory restrictions remain in the parent descriptions
  and structured tables; they are not lost when a result label is a separate field.
- All 37 nested Descriptor benefit descriptions match complete source clauses,
  separating any leading source labels where present. Each clause also remains
  in its own independently bounded parent description. Repeated wording across species
  does not establish source ownership by itself.
- All 259 ordinary Equipment descriptions match the complete note cell in the
  correct genre, price-category and named row. The 31 empty descriptions reflect
  genuinely empty source cells. Of the 69 Equipment fragment fields, fourteen
  are complete Image Projector/Energy Blast table-result cells; the other 55 are
  weapon properties retained in complete source notes, including the individual
  Monomolecular blade clauses already present in its full description.
- All 58 Skill descriptions match their complete named definition and immediately
  attached callouts or tables in paragraphs 150–245, with the leading name moved
  to the Item label. Fifty-five retain the conservative fragment classification;
  the other three already have explicit multipart evidence.

This check found no omitted wording in those fragment fields or empty note cells.
It does not change the report's evidence classifications, certify every general
rule applicable to an Item, or establish executable automation. Shared rule
sections and cross-Skill context are not automatically duplicated into every
Item that could use them.

Eleven English display names also had ASCII apostrophes where the actual CRD
headings use `’`. Their punctuation was corrected from the supplied reference;
document IDs, logical IDs, source paths and French wording remain unchanged.
Only the corresponding French proposal name hashes were refreshed. The focused
name regression first failed on the old punctuation, then passed after correction.
The final backslash in the Doesn’t Do Much GM-intrusion passage is literally
present in Word paragraph 3996; it remains in the English description rather
than being silently removed as an extraction error.

The live audit reads the supplied private reference without copying or
publishing it. Independent CI evidence in `data/crd-text-fidelity.json` protects
reviewed source selections; focused tests also preserve complete parent-package
boundaries, attack options and graph relationships. Evidence is updated only
after reading the actual CRD, never by hashing a changed pack to silence a test.

An exact fragment proves matching words, not a complete definition. Some fields
still use fragment-level evidence even where direct source review has established
their named passage boundaries, such as Skill definitions. Rules Journals contain
selected rule sections rather than the whole CRD. Matching audited fields do not
certify an unrepresented passage or complete runtime automation. See
[the CRD audit](crd-compendium-audit.md).

## Identity, mechanics and Skill referents

Translated display names never determine logical IDs, Foundry document IDs or
CRD locators. Equipment identity uses the canonical English inventory tuple of
genre, price category and source name. Existing equipment logical IDs include
legacy uppercase characters, spaces and punctuation; they are preserved rather
than renamed to satisfy a newer slug convention. Type and Focus provenance also
retains the English CRD heading.

Normalization aligns French typed rule data with the canonical English data
while preserving language-specific identities and display text. UUIDs and bare
Ability IDs in Focus graph edges resolve to the corresponding French documents.
The identity and bilingual-mechanics regression suites cover translated names,
stable source paths and IDs, canonical locators and mechanically equivalent
references. Repeated normalization has its own idempotence contract.

Optional and granted Skill fields are legacy name-based references. Translation
compilation checks them against the materialized French Skill catalogue before
accepting a plan; a generic recursive string replacement would not preserve
that relationship. Stored costs, action enums, semantic durations, ranges,
conditions and graph edges are excluded from the translation allowlist.

## Authoring, review and compilation

Maintain the fourteen existing family/language collection IDs. A single pack per
language would reduce browsing clarity and still require a separate Journal
pack, because an ordinary Foundry compendium has one document type. Small
editorial folders under `translations/fr/` and the eight paired UI domains under
`lang/src/` organize maintenance without changing public pack identities or the
native Foundry language contract.

`preview:translations` normalizes an isolated checkout, validates the full draft
plan and writes diagnostic French JSON under `reports/i18n-preview/`. Its manifest
identifies the outputs from that run. It changes neither authoring sources nor
Foundry world documents.

`build:packs` applies reviewed proposals to temporary compiler JSON by default.
`build:packs -- --include-proposed` explicitly includes the complete French
drafts. The translation compile step leaves `_source` records and review statuses
unchanged, then writes ordinary generated LevelDB packs. Normalize the authorized
build checkout first with `migrate:packs`; use an isolated checkout when only
validating. `test:e2e -- --proposed-translations` performs normalization, draft
compilation and live checks in a disposable Foundry world.

Review full passages before changing `proposed` to `reviewed`: preserve costs,
numbers written as digits or words, dice, both unit systems, conditions,
exceptions, timing, targets, frequency, consequences and table row order. Use the
confirmed action terminology and Type names from the shared glossary; other
editorial choices remain visible as proposals. Automated content safeguards,
English CRD comparison, French semantic review, generated builds and observed
live Foundry results are separate kinds of evidence.

## Observed validation on 2026-10-14

The complete isolated Node suite passed all 652 tests. ESLint, the scoped
type-check pilot, the architecture audit, native locale artifact checks and
syntax checks also passed. The final normalized CRD comparison and complete
French preview audit passed with the coverage and evidence scopes above.

All fourteen packs compiled, and the distributable archive built in temporary
checkouts. Five focused live scenarios passed on Foundry 14.369 with Chromium
153.0.8010.12:

- English/French activation labels and complete Power Shift help, in light/dark
  themes; each help string equals its native locale artifact, including short
  CRD definitions such as Accuracy.
- Recovery and healing dialogs in both languages/themes at a narrow sheet
  width, including keyboard interactions and unchanged state after cancellation.
- Loading the fourteen native EN/FR compendium indices.
- Loading all 1,373 French compiled documents with explicit proposal status.
- Applying a French Descriptor to a renamed English Skill, preserving the
  existing Item ID and advancing its training without creating a duplicate.

The final action-label scenario was rerun after fixing its required Ability key
and replacing an arbitrary minimum text length with complete dictionary equality.
These results cover the selected i18n scenarios; the entire gameplay E2E suite
was not rerun and the existing compatibility declaration remains unchanged.
Validation used an owned disposable world/Data directory. The configured real
Data directory served only as a read-only activation source.
