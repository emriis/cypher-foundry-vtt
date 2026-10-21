# Localization authoring and review

The supplied CRD is the sole authority for rules and compendium content.
English rule passages retain its complete wording, punctuation, conditions,
examples and exceptions. French is a complete rendering of those passages;
translation must never add a rule, shorten a restriction or change a quantity.

## UI sources and native Foundry bundles

Edit the paired domain files under `lang/src/en/` and `lang/src/fr/`:

| Domain | Ownership |
| --- | --- |
| `shared.json` | Shared controls, sheet names, warnings and document type labels |
| `actors.json` | Pools, wounds, NPCs, communities and custom fields |
| `character-creation.json` | Character sentence, genres, superhero configuration and Power Shifts |
| `progression.json` | Tier, Effort, Edge, XP and advancement |
| `tasks-combat.json` | Task rolls, defenses, weapons, armor and shields |
| `recovery-healing.json` | Recoveries, Rally, treatment and healing |
| `items-content.json` | Items, Skills, Abilities, Types, Foci and descriptive controls |
| `tooling.json` | Imports and migrations |

Domains divide authoring responsibilities without renaming existing localization
keys. A shared namespace may span domains; each leaf belongs to exactly one
domain. Keep corresponding EN/FR leaves in the same domain. Do not add nested
objects where callers expect a string, such as `CYPHER.Ability.Action`.

```powershell
npm run build:lang
npm run check:lang
```

`build:lang` validates the pair before writing the deterministic native artifacts
`lang/en.json` and `lang/fr.json`. The manifest continues to load these two files.
`check:lang` is read-only: it rejects duplicate members, cross-domain collisions,
missing or unexpected keys, changed interpolation variables, missing literal
runtime keys, missing configured enum labels and stale runtime artifacts.
Integration tests invoke the same checks in CI. Syntax-sensitive interpolation
uses Foundry's single braces, such as `{name}`; translate the sentence, not the
variable. Do not hardcode PX, action labels, or English examples in a template.

This follows [Foundry's native localization contract](https://foundryvtt.com/article/localization/).
Multiple authoring files do not require a custom browser loader or a translation
module. Keep domain files modest; split a domain when different features have
different maintainers, rather than using an arbitrary line-count threshold.

### Changing language in Foundry

Open the world's **Game Settings** sidebar, choose **Configure Settings**, change
**Language Preference** to **English** or **Français**, and save. Follow any
reload prompt. This is a client setting: each player can choose the interface
language in their own browser. See [Foundry's settings guide](https://foundryvtt.com/article/settings/).

The interface setting selects `lang/en.json` or `lang/fr.json`; it does not load
`translations/fr/` directly. Compendium text is stored in its documents. Import
from the EN or FR family pack to obtain that language's content. Changing the
interface language leaves existing world Items, Journals and Actor-owned Items
in their imported language.

## Terminology and inclusive editorial style

The single normative French mechanics lexicon is
[`data/localization/glossary-fr.json`](../data/localization/glossary-fr.json);
the accompanying [translation and inclusive writing policy](terminology-fr.md)
defines confirmed/established/proposed terminology, grammatical conventions,
review criteria and source fidelity boundaries. Historical tables in this
document and earlier UI reviews are not separate translation authorities.

```bash
npm run audit:terminology
```

The audit enforces exact term ownership for the explicitly bound UI labels and
produces an advisory report on inclusive-language and mechanical ambiguities
in the **proposed** French compendium text. Never replace source CRD passages
mechanically based on a word list or automatically approve an entry. A
glossary term's status is **independent** of a proposal's `reviewed` status;
neither terminology nor CI structural checks certify semantic fidelity.

## Reviewed content batches

**PR6 — Skills and Descriptors:** The [source-backed translation review](localization-pr6-skills-descriptors.md)
validates 58 Skill and 53 Descriptor/species editorial records, including
their structured Skill choices, fixed grants and GM intrusion exceptions.
Their `translations/fr/` entries are `reviewed`; the remaining families
retain independent unreviewed editorial status. The normal compiler permits
reviewed French Skill names to coexist with **English** labels in Types and
Foci that are not yet approved. No previously reviewed item IDs or rule data
are renamed by this change.

### PR7 — First 175 Abilities reviewed

The [first Ability review batch](localization-pr7-abilities-batch1.md) validates
**175 of 701 Abilities**, from `ability.a-bit-of-magic` through
`ability.divine-radiance`. They are now `reviewed`, in addition to the
111 Skills and Descriptors approved by PR6; the other **526** Ability
records remain `proposed` for later batches. The
[locked selection](../data/localization/ability-review-batch-1.json)
keeps same-name/different-rule variants separate. The
`npm run audit:abilities-pr7` command writes a bilingual,
source-hashed comparison worksheet; the normal build includes reviewed
French entries while the release gate stays strict for the rest.

### PR8 — Next 175 Abilities reviewed

The [second Ability review batch](localization-pr8-abilities-batch2.md)
approves **175 additional source-backed Abilities** from
`ability.drain-life` to `ability.incredible-velocity`. With the
[PR7 batch](localization-pr7-abilities-batch1.md) and the previously
approved Skills/Descriptors, this gives **461 reviewed FR documents**
out of 1,373. Another **351 Abilities** and **561 other documents**
remain `proposed`. The [canonical batch manifest](../data/localization/ability-review-batch-2.json)
keeps mechanically different versions separate and the audit
`npm run audit:abilities-pr8` writes a complete English/French
comparison worksheet. PR7's reviewed content remains strictly checked,
while the release's global reviewed-only gate is still pending.

### PR9 — Third Ability review tranche (preflight)

The [PR9 editorial preflight](localization-pr9-abilities-batch3.md) selects the
next **175 canonical Ability IDs** after PR7 and PR8, and produces a complete
source-backed bilingual comparison via `npm run audit:abilities-pr9`.
The tranche has been marked `reviewed` in its 175 editorial proposals,
bringing the repository status count to **636 / 1,373** (525 Abilities and
111 Skills/Descriptors). The audit reports all source-hashed bilingual
fields, but a green structural audit does **not** independently prove full
semantic fidelity; the clause-by-clause editorial proof must be confirmed
before interpreting these statuses as a completed human review.
Strict publication remains gated for the 737 pending records.

### PR10 — Final 176 Abilities (review pending)

The [fourth batch](localization-pr10-abilities-batch4.md) inventories the remaining **176 Abilities** from `ability.resuscitate` to `ability.wraith-cloak`. The new comparison audit `npm run audit:abilities-pr10` preserves source-backed English and French pairs. These drafts remain `proposed` until semantic source review; earlier 636 reviewed records stay unchanged.

## Compendium organization and source identities

Keep packs separated by family **and** language. Items and JournalEntries have
different schemas; [Foundry compendiums hold one document type per pack](https://foundryvtt.com/article/compendium/).
The existing paired packs keep collections small, but PR2 intentionally changes document UUIDs: all bilingual counterparts now derive the same _id from the English CRD logical identity.
Do not combine them into one huge pack per language or rename pack collections
merely to reorganize translation files.

The seven families retain their fourteen existing collection IDs: `abilities`,
`skills`, `descriptors`, `types`, `foci`, `rules` and `equipment`, each suffixed
with `-en` or `-fr`. Editorial subfolders do not create additional compendiums.

English source-backed typed data and French display text have different roles.
`migrate:packs` pairs records by their language-neutral CRD logical identity,
aligns typed French fields with the canonical CRD-backed fields, and maps UUIDs
and Focus graph endpoints to French counterparts. Translated names cannot change
canonical _ids, costs, semantic durations, action identifiers or provenance
locators. Existing worlds are not rewritten by this source normalization.

Changing the Foundry interface language does not translate an Item already
imported into a world. Choose the appropriate pack when importing. A future
world-language conversion requires a separate persisted-data migration.

**Canonical ID migration (PR2):** after bilingual mechanics normalization, each
Item or JournalEntry obtains `_id = sha256(canonicalLogicalId).slice(0, 16)`.
EN/FR differ only in pack collection IDs; Folder and Journal page IDs are
migrated deterministically as well. Existing imported Items, world UUIDs and
macros are *not* automatically migrated; back up worlds and reimport relevant
compendium content after installing the new system.

The 259 legacy W4 equipment logical IDs are canonicalized from the English
genre/price/name tuple. The proposal reader temporarily maps the existing
`translations/fr/` editorial files (including Journal page paths) into this
canonical namespace; proposal files remain unchanged until the dedicated
PR3 editorial-source refactor. No historical French `_source` fallback is
approved by this mapping.

## Complete French proposals

Maintain one proposal per logical source identity under `translations/fr/`,
organized by family. Ability batches may be subdivided for editorial ownership;
those folders do not affect the runtime pack names. Each JSON file contains:

```json
{
  "logicalId": "ability.example",
  "sourceLogicalId": "ability.example",
  "language": "fr",
  "status": "proposed",
  "fields": [
    {
      "path": "name",
      "sourceHash": "sha256-of-the-exact-English-UTF8-field",
      "text": "Exemple"
    }
  ]
}
```

The example shows the shape only: a real proposal must cover **every** nonempty
field returned by `translationFields`, including the description, embedded
effect names and text, Effort explanations, table names/results, variants,
properties, granted Skill labels and Journal page names/content. Arrays with
`_id` or `id` use that scoped stable identity in the path, for example
`system.effects.blessing.description` or `pages.<page-id>.text.content`. Legacy
arrays without IDs use an ordinal and the exact source-field hash. Never use
a translated name as a selector.

`proposed` means an editorial draft; `reviewed` means someone checked the full
French text against the supplied CRD. No parser changes that status automatically.
Reuse an existing French translation only after reviewing its complete meaning;
an older book, a similar title or matching numbers does not establish fidelity.
Do not copy the private reference document or its storage into translation tooling.

As of 2026-10-14, the normalized catalogue has 1,373 French proposals: 701
Abilities, 53 Descriptors, 457 Equipment-family Items, 42 Foci, 7 Rules Journals,
58 Skills and 55 Types. All are explicitly `proposed`. Complete editorial
coverage does not mean that these drafts have been approved as `reviewed`.

```powershell
npm run audit:i18n
npm run preview:translations
```

Both commands normalize an owned disposable checkout. The audit writes
`reports/i18n-content-review.json`, distinguishing missing proposals, incomplete
field coverage, stale English hashes, invalid numeric/markup/reference tokens,
review status and paired typed mechanical differences. Preview additionally
writes valid French JSON under `reports/i18n-preview/`; it does not change the
authored packs, generated LevelDB data or a Foundry world. The proposal files are
the review surface; preview files remain diagnostic artifacts. The preview
manifest lists this run's outputs, so older files left in that directory are
not part of the current preview. Full preflight validation precedes preview
document writes.

### Building French compendiums

The standalone build normalizes an owned disposable checkout, reads its EN/FR
catalogue and materializes selected French proposals into temporary compiler
JSON. No preceding source migration is required. It preserves source files under
`packs/*/_source/` and the proposal review statuses. Its generated LevelDB output
is the ordinary content that Foundry loads.

```powershell
# Replace generated packs while preserving authored sources:
npm run build:packs

# Compile all French editorial drafts for review:
npm run build:packs -- --include-proposed

# Check release eligibility: refuse all missing or unreviewed translations:
npm run build:packs -- --require-reviewed

# Build and exercise those drafts in a disposable Foundry world:
npm run test:e2e -- --proposed-translations
```

**There is one French editorial authority:** `translations/fr/`. Every French
document is materialized at build time from the canonical English CRD display
fields plus a complete source-hashed French proposal when it is eligible. The
historical display strings in `packs/*-fr/_source/` are **never** used as a
fallback and cannot influence the compiled French text. Those authoring files
remain temporary mechanical/identity shells pending their removal in a separate
schema migration; they must not be edited as translations.

Normal builds select only `reviewed` proposals. When the corresponding
translation is not reviewed or absent, the build uses the **current English
CRD text**, not any legacy French text. It records
`flags.cypherFoundry.translation.status = "untranslated"` and
`sourceLanguage = "en"` so nobody mistakes that content for an approved
French translation.

`--include-proposed` explicitly selects complete draft and reviewed proposals
and requires full proposal coverage. It is an **editorial preview**, not an
approval workflow. `--require-reviewed` rejects every non-reviewed or missing
translation before compiling any pack. These options are mutually exclusive.
Tagged GitHub releases use the strict mode and consequently cannot publish
until all 1,373 current entries (plus future additions) are reviewed. Standard
CI compiles traceable English-fallback builds to keep the translation project
testable without calling those texts complete. Review and publication status
remain authored exclusively in `translations/fr/`.

`migrate:packs` explicitly rewrites source records when authoring normalization
is intended; it is not a prerequisite for building. `build:packs` replaces only
generated LevelDB outputs in its checkout. Use an owned isolated checkout for
validation without generated changes. The E2E runner handles that isolation itself.
All selected translations are checked and all packs compiled before the build
replaces any pack:
allowed display fields, exact source hashes, markup/numeric/reference safeguards,
bilingual typed mechanical parity and translated Skill-label referents. A stale,
incomplete or mechanically divergent proposal fails the build rather than being
partly applied.

Source hashes cover the exact English field, including HTML. A changed field
requires rereading the CRD and revising the translation; never refresh a hash
just to silence a stale-source error. Numeric tokens, dice expressions, markup
and references are conservative safeguards. They cannot prove that *only*,
*unless*, a number written in words, an example or a fictional prerequisite has
been translated correctly. Review those explicitly before promoting a proposal.

## Review and validation

1. Confirm the English passage's CRD revision, section and complete boundary.
   A matching fragment does not prove that background, callouts or exceptions
   are present. Ability definitions may live in linked standalone Items; retain
   all other relevant Type/Focus context and document the selected source scope.
2. Compare the complete French field with that passage, including quantities,
   examples, targets, times, units, costs, exclusions and optional choices.
3. Check the shared glossary and all corresponding embedded text. Skill labels
   must match the Skill proposals so language differences cannot duplicate grants.
4. Run locale checks, content safeguards and isolated `npm test`. Validate CRD
   fidelity separately with `audit:crd -- --normalized` when the private reference
   is available. Report passage matches and fragment matches separately.
5. Keep generated pack builds and observed live Foundry checks separate from
   source review. Exercise both UI languages when a control changes, and preserve
   the existing `compatibility.verified` unless a new version was actually tested.

Do not claim “100% CRD faithful” or “complete French coverage” from an equal key
count, a source hash, an English fallback or a successful build alone.
