# PR4 — CRD callout and English-fidelity inventory

> Scope: the **English Cypher Reference Document dated 2026-07-29**
> checked into `docs/Cypher-Reference-Document-2026-07-29.docx`. This
> reference is not interchangeable with the separate Character Rulebook, GM
> Guide or Bestiary. The seven existing Rules Journals are **selected sections**
> and do **not** represent the entire CRD.

## Reproduction

```bash
npm run audit:callouts -- --normalized
python3 -m unittest discover -s tests/python -p 'test_*.py'
```

The audit writes `reports/crd-callout-coverage.json` (not committed) and
prints a digest with representative unresolved references. GitHub Actions
publishes the full report as the `crd-callout-coverage` artifact. Both reads
are source-only: no pack, translation, LevelDB or Foundry world is rewritten.

The Python standard-library parser inspects Word paragraph and inherited style
formatting, paragraph borders/shading, textbox ancestry, bold leading labels,
table membership, and labelled passages (GM intrusions, Genre themes,
examples and clarifications). The Node comparison maps these candidates to
the **normalized English** document text and the previous source-evidence
catalogue. Tables are catalogued separately from callout paragraphs.
Consecutive visually marked paragraphs within the same source style/section
are grouped into probable boxes. The report is exhaustive for these detected
OOXML signals, not a claim to infer every human-perceived shaded/sidebar region
or all implied cross-page relationships. A visual inspection is still needed
for ambiguous layout and image-backed callouts.

## Observed CRD inventory (2026-10-21)

| Measure | Observed |
| --- | ---: |
| CRD paragraphs | 8,202 |
| Word tables | 61 |
| Callout candidate paragraphs | 890 |
| Multi-paragraph visual groups | 226 |
| Visual groups needing destination/completeness review | 100 |
| Named GM intrusion candidates | 43 |
| Named Genre themes candidates | 42 |
| Labelled examples | 2 |
| Labelled clarification | 1 |
| Direct verbatim matches in an EN compendium field | 255 |
| Locator-only, requiring review | 11 |
| No **proven** complete paragraph coverage in existing packs | 624 |
| Revalidated historical passage-window contracts | 1,193 |
| Current normalized English documents | 1,373 |

These counts are **not a count of missing Item definitions**. A paragraph may
be a genre-wide rule, a game-master tip, a table or a general CRD reference
that should live in a future Journal instead of an Ability/Focus/Equipment
Item. One text match also does not prove the *whole* visual box is preserved:
the audit publishes candidate/box locations so its boundaries can be reviewed.

### English source-backed findings

- The **42 Focus `Genre themes:` paragraphs** and **42 associated Focus
  `GM intrusions:` paragraphs** are all found in normalized English fields.
  CI asserts this against the live source and fails if either becomes
  unmapped. Their full Focus record descriptions remain authoritative.
- The **43rd GM intrusion**, at source paragraph **5594** in
  `Equipment / Fantasy Equipment / Expensive Items`, concerns depletion of
  limited-use equipment. It is general advice, not an ability granted by one
  ordinary equipment Item. No one of the seven current Rules Journals is
  an equipment-reference Journal. Its destination is explicitly **deferred**,
  not silently described as implemented.
- Two worked superhero-creation examples at source paragraphs **3035 and
  3036**, and one general `Doing Something Else` reminder at paragraph
  **7953**, are also outside the existing seven selected Journal sections.
  Their deferrals, exact CRD version/paragraphs and intended destinations
  are recorded in `data/crd-callout-adjudications.json` and validated by CI.

These four explicit deferrals do **not** constitute permission to omit any
associated rule from the eventual full CRD Journals. The 100 other visually
marked groups needing review remain individually visible in the JSON report.
No English text was fabricated or altered to make the audit green.

## Two different CRD file hashes — audit boundary

The committed DOCX SHA-256 is:

`cbf439c9d6fc2c55860a8d0fa52a70be838522e66482d2706bd6ea3f6142c729`

The historic source-contract baseline in `data/crd-text-fidelity.json` records:

`cbc222b131436fef77b75af80c362a6cf67f0baa70c9380ccac3a3a31964d626`

The audit **never applies all old paragraph locators solely because a text
baseline file exists**. If the source hashes differ, it revalidates individual
historical field ranges by requiring the full stored English text in the same
paragraph window of the *current* CRD. On the first PR4 run, 1,193 contracts
passed this stricter revalidation; contracts that do not pass remain outside
the trusted locator set. This may reflect archive formatting differences or
wording changes; the hash difference alone does **not** prove which. Do not
regenerate hashes from compendium JSON or pretend the remaining contracts
have been reviewed.

## Interpretation and future work

| Report status | Meaning | Next action |
| --- | --- | --- |
| `verbatim-in-english-pack` | Full candidate *paragraph* appears in an indexed English source field | Review complete boxed boundaries and destination |
| `locator-only-review-required` | Revalidated source interval references this paragraph, but full paragraph is not demonstrably in a field | Compare CRD paragraph and mapped Item/Journal manually |
| `editorial-exclusion-needs-destination` | Historical source explicitly excludes editorial passage from Ability normalization | Find proper Focus, Type or Journal destination |
| `no-proven-pack-coverage` | Existing Item/Journal text provides no complete paragraph evidence | Determine whether the passage belongs to an existing Item or a future rule/genre Journal |
| `deferred-full-crd-journal` | Explicit source-locked review decision, not implemented | Carry into the **planned complete CRD Journal** workstream |

If a *specific named Item* is demonstrated to omit an attached exception,
Effort paragraph, example or callout, correct the **canonical EN source first**,
record the exact source boundaries, then let FR structural data inherit the
fix and mark the corresponding editorial translation stale. General CRD rule
material not represented by the seven selected Journals belongs to the
separate full-Journal project rather than being duplicated into unrelated
Items to satisfy a coverage counter. Missing proof is not proof of absence.

Do not close the 100 unresolved visual groups by auto-creating summaries,
by accepting a mere substring of a box, or by treating a successful build as
semantic fidelity. Their individual locators and excerpts are the review
backlog for the next source-content and complete-Journal phases.
