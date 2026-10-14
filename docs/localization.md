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

## Editorial glossary

| Source term | French | Status and meaning |
| --- | --- | --- |
| First action | Action réflexe | Confirmed by the user; activation class `firstAction` |
| Action | Action | Confirmed by the user; activation class `action` |
| Last action | Action lente | Confirmed by the user; activation class `lastAction` |
| Powerhouse | Puissance incarnée | User-confirmed Type name; includes physical, dexterous and intellectual capabilities |
| Powerstar | Prodige du pouvoir | User-confirmed Type name; one central spectacular superpower |
| Edge | Avantage | User's established term; Pool cost reduction, never a different die-roll procedure |
| Might / Speed / Intellect | Puissance / Célérité / Intellect | Existing stat vocabulary; identifiers remain unchanged |
| Pool | Réserve | Current points and maximum capacity remain distinct |
| Effort | Effort | Levels applied and points paid are different quantities |
| Tier | Rang | Editorial proposal; ordinary character progression |
| Rank | Degré de puissance | Editorial proposal; superhero Type progression |
| Ability | Aptitude | Editorial proposal |
| Enabler | Aptitude passive | Editorial proposal for activation classification; not necessarily permanent, cost-free or unlimited |
| Step | Pas | Difficulty change; use degré de gravité when discussing a wound severity |
| Ease / hinder | Faciliter / entraver | Preserve the direction and number of steps |
| Asset | Atout | Distinct from Avantage and Effort |
| Superheroics | Prouesses héroïques | Editorial proposal; preserve its stated Effort exceptions |
| Power Shifts | Amplificateurs de puissance | Editorial proposal; the Power category itself is Pouvoir |
| Rally | Se reprendre | Healing action; retain its genre-specific conditions |
| Focus / Cypher | Focus / Cypher | Editorial proposal to retain these terms |

Use consistent **vous**, sentence case, French punctuation and readable sentences.
Maintain the same register across names, help and warnings. Preserve measurements
in both source unit systems, formulas, examples, prerequisites, duration, targets,
action classes and cancellation conditions. Do not introduce D&D-style
“advantage/disadvantage” wording to describe easing and hindrance.

Action labels translate a source classification, not the order of every ordinary
sentence. “Your first action in combat” may mean *votre première action du combat*;
it must not automatically become *votre action réflexe*. Likewise, *action réflexe*
does not grant a reaction outside the CRD action sequence, and *action lente* does
not change the rule's duration. Stored enum values remain `firstAction`, `action`
and `lastAction`.

## Compendium organization and source identities

Keep packs separated by family **and** language. Items and JournalEntries have
different schemas; [Foundry compendiums hold one document type per pack](https://foundryvtt.com/article/compendium/).
The existing paired packs keep collections small and preserve saved UUIDs.
Do not combine them into one huge pack per language or rename pack collections
merely to reorganize translation files.

The seven families retain their fourteen existing collection IDs: `abilities`,
`skills`, `descriptors`, `types`, `foci`, `rules` and `equipment`, each suffixed
with `-en` or `-fr`. Editorial subfolders do not create additional compendiums.

English source-backed typed data and French display text have different roles.
`migrate:packs` pairs records by their language-neutral CRD logical identity,
aligns typed French fields with the canonical CRD-backed fields, and maps UUIDs
and Focus graph endpoints to French counterparts. Translated names cannot change
equipment IDs, cost fields, semantic durations, action identifiers or provenance
locators. Existing worlds are not rewritten by this source normalization.

Changing the Foundry interface language does not translate an Item already
imported into a world. Choose the appropriate pack when importing. A future
world-language conversion requires a separate persisted-data migration.

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

# Build and exercise those drafts in a disposable Foundry world:
npm run test:e2e -- --proposed-translations
```

Normal builds select only `reviewed` proposals. They otherwise use the existing
French source records, which may contain legacy English fallback text; that text
is not counted as an approved French translation. `--include-proposed` selects
both proposed and reviewed text and requires complete proposal coverage for the
normalized catalogue. The compiled documents record the selected status under
`flags.cypherFoundry.translation`; compiling a draft never promotes it to
`reviewed`.

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
