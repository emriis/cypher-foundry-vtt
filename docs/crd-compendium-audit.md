# CRD compendium audit — 2026-10-11

The supplied **2026-07-29 CRD** is the sole authority for this audit. The English
compendiums contained extraction errors, incomplete passages, and incorrect
mechanical fields. Those verified defects were corrected. Individual Ability,
Cypher, and passive-benefit automation remains incomplete; catalogue presence,
schema validation, and chat output do not establish executable behavior.

## Later source audit (PR4, 2026-10-21)

The historical 2026-10-11 review below used a private DOCX and describes the
then-current **1,372-document** normalized catalogue. It is retained as a
dated result, not a current completeness claim. The repository now contains
a source file at `docs/Cypher-Reference-Document-2026-07-29.docx` with a
**different file SHA-256**, and the normalized catalogue includes 1,373 EN
records. See [the PR4 source callout inventory](crd-callout-audit.md) for the
current DOCX SHA, 890 callout candidates, 226 visual groups, 61 tables, exact
coverage evidence and source-locked outstanding decisions. Do not silently
reuse historical paragraph locators against the newer file.

## Evidence and reproducibility

The private reference is `docs/local/Cypher-Reference-Document-2026-07-29.docx`,
with SHA-256
`cbc222b131436fef77b75af80c362a6cf67f0baa70c9380ccac3a3a31964d626`.
The library is read-only and remains private. No other book establishes rules.

Run `npm run audit:crd -- --normalized` to reproduce the distributable-source
report at `reports/crd-compendium-audit.json`. Omit `--normalized` to inspect the
authoring catalogue, including legacy editorial records. The optional Python 3
adapter reads Word XML with standard libraries; the Node auditor inventories
sources, checks wording, and records application consumers. Neither Python nor
the private CRD is a CI/runtime dependency.

The normalized report contains **1,372 English records** and a per-record list
of text fields, CRD locations, base-cost evidence where applicable, implemented
consumers, and remaining automation gaps. Reports remain local, ignored artifacts.

| Pack | Records | Whole reviewed text fields | Exact fragment fields | Empty fields |
| --- | ---: | ---: | ---: | ---: |
| Abilities | 700 | 702 | 8 | 0 |
| Descriptors/species | 53 | 55 | 37 | 0 |
| Equipment, weapons, armor, shields, Cyphers | 457 | 426 | 69 | 31 |
| Foci | 42 | 0 | 42 | 0 |
| Rules Journals | 7 | 9 | 0 | 0 |
| Skills | 58 | 3 | 55 | 0 |
| Types | 55 | 0 | 55 | 0 |
| Total | 1,372 | 1,195 | 266 | 31 |

Fields and records have different counts: nested effects, table results,
properties, and Journal pages are also inspected. Formatting whitespace and HTML
are ignored for wording checks; punctuation, words, numbers, and entry boundaries
remain significant. Similarity and punctuation folding only locate candidates.
They never approve a paraphrase or authorize an automatic repair.

An **exact passage** matches a bounded Ability definition or an explicitly
reviewed source selection. A **fragment** proves the words occur in the CRD,
without certifying completeness or ownership. All 259 ordinary equipment-family
descriptions were additionally checked against their exact genre/price/name
table row; 31 source note cells are empty. All 198 Cypher definitions and all 53
descriptor packages have bounded source selections. Descriptor descriptions now
retain characteristics and restrictions that cannot be expressed by a skill name
alone.

Type and Focus introductions still have fragment-level evidence. Their Ability
definitions are separate referenced Items, as required by the source architecture.
This audit does not certify every parent-package numeric field, starting equipment
bundle, or graphical prerequisite arrow. Skills retain representative procedure
contracts; the three multipart procedures have explicit reviewed selections.
The seven Journals are selected rule sections, not the entire CRD.

For Abilities, 383 explicit, supported cost headers match the stored base Pool
cost. The other 317 have no supported simple cost header or require additional
review. A matched base cost does not certify escalation, Effort, wound costs, or
target-specific consequences.

## Corrections

- Restored CRD punctuation and removed corrupted Unicode without replacing
  source wording with summaries. French English fallbacks were updated alongside
  English sources; genuine translations were preserved unless explicitly
  replaced by a pending-translation source fallback.
- Removed neighbouring Abilities, headings, and GM intrusions accidentally
  absorbed into Fast Talk, Expert Combatant, Press Advantage, Basic/Greater
  Necromancy, Empathic Sense, Fence Out Evil, and other descriptions.
- Restored omitted continuations and restrictions in Retainer, Blood Sorcery,
  Understand Beast, Divine Radiance, and related passages. Embedded Open Inner Eye
  options have explicit source scopes so the parent ritual timing is not appended
  to each child definition.
- Replaced the fabricated Grand Illusion definition with **Grandiose Illusion**
  and its CRD Last action timing. Restored **Supreme Retribution** as the actual
  name of the existing Quells Evil tier-six definition, preserving its Foundry ID
  and graph references.
- Materialized Noble Defender, Noble Sacrifice, and Hand to Eye as separate
  bilingual Ability Items, and restored their Type grants. Their prose is
  source-faithful; their individual effects still require execution contracts.
- Corrected Advanced Command's base cost from 7 to 4 Intellect and retained the
  named Pool on eight zero-plus costs. Corrected Naron/Prota choices from the
  obsolete Persuasion label to the CRD Charm skill.
- Restored complete equipment notes for Smartphone, Digital intoxicant, Smart
  device, Hotel stay, and Carryall. Removed unrelated paragraphs from weapon
  properties and the Climbing gear/Sports car rows. Sports car and Energy pack
  are ordinary equipment, with no invented weapon damage or object level.
- Restored seven paired rule Journals from reviewed CRD sections and tables,
  replacing invented summaries, including an incorrect PC Armor explanation.
  Journal/page IDs remain unchanged. Their French content explicitly retains
  English source pending translation.
- Repaired eleven Genre manifest passages, including Unyielding Shield's
  unrelated Type/Focus text, missing boundaries, and corrupted bullet characters.

Normalization now distinguishes English definitions whose differences are not
yet modeled structurally. It counts distinct definitions rather than duplicate
occurrences, preserves unambiguous English/French association, and redirects
Type tier references when an identical duplicate is merged. HTML formatting
alone does not create a new variant. Existing authoring IDs are preserved for
corrected records; ordinary canonical deduplication can redirect aliases and
definition-signature logical IDs can change when a source definition is repaired.
Repeated normalization and reversed directory enumeration have regression
coverage.

## Automation and accepted decisions

The [capacity inventory](passive-wound-capacity.md) extends the initial Tough
slice to every reviewed Ability clause granting additional wounds, including
shield capacity and explicit rank eligibility. It records the source locations
and the user's severity-specific interpretation of overlapping capacity grants. Support for
an additional-wound clause does not certify the other effects in that Ability.

Tough now supplies an explicit unconditional minor-wound capacity modifier.
Derived preparation, PC wound overflow and Healing Hand consume the same
effective track without persisting bonus maxima. Removing the Item preserves
existing wound counts. Other passive benefits remain open; this does not certify
Armored Body's immunity or any Descriptor effect. Older owned Tough Items require an explicit
source refresh because runtime behavior never infers modifiers from their names.

Validation for this slice on 2026-10-17: isolated `npm test` passed 724/724;
the current-source runtime lane passed 475/475. Lint, the type-check pilot,
architecture, system/E2E syntax and locale checks passed. The isolated build
passed all 15 compiled-pack checks and ZIP/manifest verification. A focused live
Foundry 14.369.0 scenario passed using actual EN/FR Tough documents, rendered
capacity, wound overflow, reload persistence and removal without lost wounds.
This is focused gameplay evidence; it does not claim full-suite V13 or V14
gameplay verification. The verified manifest build is now 14.369.

A separate direct run of `tests/integration/repository-contracts.test.mjs` on
raw authoring sources passed six checks and rejected legacy equipment IDs in
the catalogue check. Those equipment records are unchanged from `main`; the
same contract passed in the normalized isolated suite above. The focused
manifest check passed again after updating the verified build. No unrelated
equipment normalization or generated-pack writes were applied to this checkout.

The subsequent [recovery and healing implementation](recovery-and-healing.md)
adds Healing Hand, independent source-backed recovery allowances, treatment and
safe paid-reroll consequences. Its report records the related source contracts
and validation; other Ability clauses in the inventory remain incomplete.

| Family | Implemented consumers | Remaining work |
| --- | --- | --- |
| Abilities | Structured activation costs/effect selection, declared modifier aggregation, recovery expiration, inline tables, selected grants; playable Spray/Arc Spray; fourteen permanent follower benefits; conditional/timed companion support and Retainer interception ([contract](companion-powers.md)) | Further active/temporary companion powers, most other target effects, conditional/passive rules, additional costs, and Effort alternatives need individual contracts |
| Types/Foci | Character grants and referenced Abilities; Focus tier/prerequisite selection | Inherit individual Ability limitations; full source-package field review remains separate |
| Descriptors/species | Pool/skill choices, selection guards, extra minor wound grants and 34 reviewed numeric/conditional species contracts ([contract](followers-and-benefits.md)) | Narrative mobility/communication, adapted Mutation and turn-replacement powers retain separate family contracts; old Skill history requires explicit review |
| Skills | Selected task modifiers and tier restrictions | Source procedures, applicable circumstances, kits and assets require explicit adjudication |
| Weapons | Familiarity, attack modifiers, numeric NPC damage, supported target effects, explicit range/one-handed adjudication, alternate category | Hands, deployment, operator participation, material/object interaction, and enforced action economy need explicit contracts/state |
| Armor/shields | Equipping, armor damage/repair and hindrance; shield Block choice, independent wounds, overflow and destruction ([contract](shield-runtime.md)) | Individual special notes and special shield Abilities require source-backed contracts |
| Ordinary equipment | Quantity/equipping and declared depletion | Task assets, environmental effects, travel and equipment setup remain adjudicated |
| Cyphers | Common generation/acquisition, capacity, custody, timing, depletion, variant selection and inline tables ([contract](cypher-lifecycle.md)) | Actual power effects, targeting, duration, damage and stat consequences remain descriptive |
| Journals | Rules reference | Reference content does not execute gameplay |

`system.randomRange` is a position in a generation table, not a power's damage
or effect-roll formula. It must not be turned into a gameplay roll merely because
it contains numbers.

Three user decisions govern implementation:

1. **Stunstick:** one round by default, with one explicit GM extension to two.
   This is implemented. Its source-declared zero damage stays zero. Supported
   level-gated effects persist on the targeted NPC; the NPC sheet displays the
   active effect and exposes the extension button to an authorized GM. Repeated,
   expired, and unauthorized requests perform no writes. Combat expiration uses
   the application round plus one/two rounds. Outside combat, the existing
   narrative boundary consumes one/two NPC actions; no elapsed-time measurement
   or perceptible-end-of-fight inference is introduced.
   Open NPC sheets refresh automatically when the combat clock changes, without
   persisting flags during rendering or replacing synthetic Actors with world
   Actors. The live scenario checks expiration without a manual sheet refresh.
2. **Fiction-dependent conditions:** explicit player/GM confirmation, followed
   by automatic application and tracking. This is the accepted policy for consent,
   adjacency, perceived combat end, and comparable conditions. It is not already
   implemented for every descriptive power.

3. **Repeated Stunstick hits:** keep two hindrance steps with the latest expiry
   against the same level-three-or-higher NPC. This is implemented for the complete
   structured target-effect contract, including hits from different weapons.
   The selected interval retains its ID and GM decision; an equal or earlier
   deadline does not shorten it or reopen an already-used extension. Expired
   intervals cannot be revived. Narrative play preserves the largest remaining
   action count. Independent effects remain independent. Existing overlapping
   flags are resolved on read without writes; later mutations consolidate them.
   This is a recorded user adjudication, not a stacking rule claimed from the CRD.

NPC attack resolution consumes hindrance, while other opposed tasks and passive
NPC defenses still need explicit execution contracts. Duration tracking alone
does not close those remaining target-effect cases.

## Closing the remaining work with BDD/TDD

1. Review one CRD effect family and enumerate its source parameters, conditions,
   target kinds, costs, duration, and termination events. Record unsupported
   fields instead of guessing semantics.
2. Add deterministic Given/When/Then contracts for success, rejection,
   cancellation, permissions, costs, repeated activation, and expiration.
3. Implement shared pure calculations and application services. Model effects
   explicitly; never execute localized names or arbitrary description text.
4. Connect explicit confirmation and target selection to those services. Preserve
   synthetic Actors, await mutations, and guard repeated local actions. New
   persisted fields require migration contracts for existing world data.
5. Add a live sheet scenario for the actual persistence/UI boundary, then mark
   only that reviewed effect family complete in the per-entry matrix.

Prioritize passive modifier/termination contracts shared by several Abilities
and descriptor benefits, then concrete Cypher effects, then weapon setup and
participant/object state. These are implementation gaps, not permission to invent
rules or silently derive resource stores or adjacency from the grid.

## Regression evidence and change scope

`data/crd-text-fidelity.json` stores **1,378 reviewed field contracts**, with CRD
locations, evidence scopes, and SHA-256 values. Hashes protect reviewed wording;
they are not a substitute for source review. See [development.md](development.md)
for the update procedure. Focused independent transcriptions and BDD regressions
demonstrated the extraction, cost, identity, and Stunstick defects before repair.

Validation observed on 2026-10-11:

- **Unit/content/integration/BDD:** `npm test` passed 540/540 tests in a
  normalized temporary checkout. Focused stacking tests first reproduced the
  defect, then passed; 24 focused audit/application tests also passed after the
  final shared-contract refactor.
- **Static checks:** lint, the explicit JSDoc type-check pilot, architecture
  dependencies, system syntax, and E2E syntax passed.
- **Build/package:** all 14 EN/FR packs built and the system archive packaged
  successfully in a disposable checkout.
- **Live Foundry:** 30/30 E2E scenarios passed on Foundry V14 with Chromium
  153.0.8010.12. This includes the real Stunstick sheet control, repeated hits,
  preserved GM duration, automatic display expiration, Spray, and Arc Spray.
  These results do not establish live V13 compatibility; manifest compatibility
  metadata was not broadened.

Local evidence is retained in `reports/crd-audit-final-node.log`,
`reports/crd-audit-delivery-live.log`, `reports/crd-stunstick-stacking-red.log`,
and `reports/crd-compendium-audit.json`.

The initial checkout was clean. Changes belong to these families:

| Files | Purpose |
| --- | --- |
| English `_source` records and Genre manifest | Exact source wording, complete reviewed passages, corrected fields/grants and source notes |
| French `_source` records | English fallbacks, matching mechanical changes, explicit pending translations and paired Journals |
| Text evidence data and Node audit/migration tooling | Reproducible source comparison, conservative per-entry consumers, stable normalization |
| Rules/application/NPC sheet/template/locales | Zero damage, bounded Stunstick duration, accepted stacking, authorized GM extension and localized display |
| Bootstrap hooks | Refresh visible NPC effect displays on combat clock/activity changes |
| Content/migration/application/rule/E2E tests | Source fidelity, reference/identity integrity, duration and real persistence regressions |
| Documentation, package script and changelog | Maintenance procedure, corrected completion claims and runtime limitations |

Serialization-only equipment changes introduced during review were removed.
Generated packs and distribution files are validated in disposable checkouts.
The installed world and its imported copies of Items are outside this source
authoring pass; source corrections reach existing copies through reimport or an
explicitly scoped migration.
