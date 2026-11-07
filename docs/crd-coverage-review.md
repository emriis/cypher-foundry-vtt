# CRD, implementation and documentation review — 2026-11-05

This review reconciles the supplied **2026-07-29 CRD**, the implementation and
the documentation at **`22e2f2a`**, on `main`, after PR #174. The initial working
tree was clean. It records documentation corrections and remaining work; it
does not implement the open rules or change accepted adjudications.

Subsequent reference delivery is tracked in the
[information-library plan](information-library-plan.md#lot-2-delivery-register).
Tranches 2A–2E add all fourteen complete source chapters, their contents/index
and separate attribution pages, bringing the catalogue to 1,389 EN documents
with paired FR documents and 23 Rules Journals. The
[complete source partition](../data/crd-reference-completeness.json) accounts
for all 7,747 nonblank paragraphs at 0–8201, all 100 baseline visual groups and
all 61 Word tables. No explicit callout deferral remains. This completes the
source-reference delivery, not the runtime automation register. The inventory and counts
below remain the historical `22e2f2a` audit snapshot; these reference additions
do not close the runtime-rule or particular-power gaps listed here.

Library lot 3 additionally provides a twelve-page player guide and eight
quick-reference cards, bringing the current catalogue to **1,391 EN documents**
with paired FR documents, **25 Rules Journals** and **441 paired Journal display
fields**. These editorial resources link the complete source and actual sheet
controls; they do not extend the canonical source partition or close remaining
rule/Ability automation work.

The reference is `docs/Cypher-Reference-Document-2026-07-29.docx`, SHA-256
`cbf439c9d6fc2c55860a8d0fa52a70be838522e66482d2706bd6ea3f6142c729`.
Paragraph numbers below belong to that file, including table paragraphs. The
earlier private-file hash in `data/crd-text-fidelity.json` is different. Its
locators require revalidation against this reference.

## Reading the status correctly

Four questions have separate answers:

1. Is the definition present, with its complete source text and provenance?
2. Is the mechanic represented by structured data?
3. Does a service actually validate, spend, apply and expire it?
4. Have the applicable source, transaction, UI and live contracts been checked?

An inventory-complete family can still have descriptive effects. A matching
text fragment is not a complete passage. A declared GM ruling can be a supported
workflow without automatic geometry. A `reviewed` French proposal is an
editorial status with structural checks, not a fresh semantic review performed
by this audit. No single global completion percentage follows from these counts.

## Current inventory and reproducible evidence

The source and localization audits were rerun against this unchanged baseline.
Normalization and diagnostic writes used isolated checkouts or ignored reports.

| Family | Authored EN documents | Normalized EN documents | Current FR editorial status |
| --- | ---: | ---: | --- |
| Abilities | 642 | 701 | 701 reviewed proposals |
| Descriptors/species | 53 | 53 | 53 reviewed proposals |
| Equipment, weapons, armor, shields and cyphers | 457 | 457 | 457 reviewed proposals |
| Foci | 42 | 42 | 42 reviewed proposals |
| Selected Rules Journals | 7 | 7 | 7 reviewed proposals |
| Skills | 58 | 58 | 58 reviewed proposals |
| Types | 55 | 55 | 55 reviewed proposals |
| Total | 1,314 | 1,373 | 1,373 reviewed proposals |

The normalization difference is expected catalogue assembly, including Genre
definitions and canonicalization; it is not evidence of 59 missing authored
Abilities. Equipment includes **259 ordinary equipment-family records** and
**198 cyphers**: 86 subtle, 103 manifest and 9 Power Boost. Teleporter has four
manifest power placements but remains one definition.

The French audit reports **2,981/2,981 translatable fields**, zero orphaned
proposals, zero invalid/incomplete entries and zero typed mechanical differences.
Proposal review statuses were read, not changed. Native interface localization
and semantic review of every French sentence remain separate evidence scopes.

Reproduce the diagnostic reports from the repository root:

```powershell
npm run audit:crd -- --crd docs/Cypher-Reference-Document-2026-07-29.docx --output reports/crd-doc-code-audit-authored.json
npm run audit:crd -- --normalized --crd docs/Cypher-Reference-Document-2026-07-29.docx --output reports/crd-doc-code-audit-normalized.json
npm run audit:callouts -- --normalized --output reports/crd-doc-code-callouts.json
npm run audit:i18n
```

`audit:crd` exit zero means a report was produced. It does not certify every
field, complete source coverage or runtime behavior. Its current normalized
result includes 692 exact-passage Ability description fields, nine
`passage-difference` warnings, and additional nested fields. Only **375** Ability
base-cost headers are checked; **326** are not checked by that limited header
matcher. These are matcher classifications, not numbers of correct/incorrect
Abilities or full cost certifications.

### Source warnings that do not establish omissions

Direct comparison with the complete intended CRD ranges confirms the following
nine descriptions. The automatic passage parser truncates multipart options or
absorbs adjacent embedded children; these warnings do not justify source edits.

| Ability | Independently checked CRD paragraphs |
| --- | --- |
| Idol | 1305–1312 |
| Audacious Blast | 2432–2435 |
| Mindslice | 1347 |
| Split Skull | 1236–1239 |
| Gut Ripper | 1271–1274 |
| Flamboyant Swordplay | 1647–1650 |
| Sorcerous Suggestion | 1348 |
| Detect Spirit | 1344–1346 |
| Swing Through | 1383–1386 |

The source labels/costs are moved to Item identity/fields as appropriate; HTML
and formatting whitespace are normalized for comparison. See
[`crd-parent-descriptions.test.mjs`](../tests/content/crd-parent-descriptions.test.mjs)
and the independent selections in `data/crd-text-fidelity.json`. Divine
Radiance's whole definition is found at 843–852, while its two effect
descriptions are assembled around separate Effort clauses at 845 and 849.
Their `needs-section-mapping` warnings require multipart evidence, not guessed
replacement wording. Type/Focus package prose and other fragment fields still
need field-level completeness/provenance review beyond this limited matcher.

### Callouts, examples and tables

The fresh callout inventory finds **8,202 paragraphs**, **61 Word tables**,
**890 callout candidates** and **226 visual groups**. **100 groups** still need
destination/completeness review. Paragraph evidence is 255 verbatim matches,
11 locator-only cases and 624 without proven complete paragraph coverage.
These are not 624 missing Item definitions.

All 42 Focus Genre-theme passages and their 42 GM-intrusion passages are
represented. Four explicit deferrals remain: superhero examples at 3035–3036,
equipment depletion advice at 5594 and the Doing Something Else reminder at
7953. Of 1,379 historical field contracts, 1,193 source windows revalidate under
the current hash; other contracts need their own evidence. See
[the callout audit](crd-callout-audit.md) and
`data/crd-callout-adjudications.json`.

The 61 tables include lists, price comparisons, equipment rows, action examples,
forms, procedures and genuine random tables. They must not all become random
RollTables. Cypher generation and embedded result tables already have consumers;
table inventory, Journal destination and native RollTable authoring are separate
questions.
The [reference destination checklist](crd-reference-destinations.md) retains all
100 open visual-group locations and all 61 table locations as individual entries.

## Documentation corrections established by current code

| Previous claim or omission | Current evidence and correction |
| --- | --- |
| README and `crd-foundry-mapping.md` still place weapon target effects, cypher variants and inline tables in future work | `weapon-effect-service.mjs`, `item-service.mjs` and `cypher-generation-service.mjs` execute the supported contracts. Remaining work concerns other effect consumers, particular powers and source-specific exceptions. |
| Core rules described as complete without an explicit residual rule register | Keep the completed foundations, but add the missing/partial procedures below. Finishing advancement purchases does not finish Earning XP or every combat procedure. |
| Mapping tables label Abilities and Cyphers simply complete | Qualify this as catalogue/identity coverage. Generic activation, chat and depletion do not execute all effect prose. |
| Initial Ability inventory says 41 Foci and plans against 53 Ability records | There are 42 Foci and 701 normalized Abilities. Preserve the initial extraction history as history, with current status and links. |
| Equipment model audit says depletion ranges cannot be represented | `item-artifact.mjs` and `item-equipment.mjs` contain `depletionMin`/`depletionMax`, threshold migration and `none`; `item-service.mjs:303–319` rolls those ranges. This model gap is closed. Artifact catalogue extraction remains source-blocked. |
| Earlier weapon audit adds unsupported CRD systems and obsolete backlog | Reconcile timing, training, hands/operators and cutting with current consumers. Remove unverified standalone spacecraft combat, an Artifact-weapon section, heavy-weapon gravity damage and training exemptions, and a three-way ammunition policy. Actual explosives 5278–5281, optional ammunition advice 5438, gravity 7861–7862, Artifact depletion 5293–5298 and individual Pilot/Starpilot powers remain in scope; see the corrected [weapon audit](crd-weapon-mechanics-audit.md). |
| Localization coverage table describes all proposals as proposed | Current proposal files/audit mark all 1,373 reviewed. Update the current table, retain dated validation history and the distinction between status and semantic certification. |
| Architecture service map omits later implementation families | Add object, companion-upgrade, temporary-follower, command, protection and Awesome services with their contracts; source state includes specialized Actor flags, not only generic active effects. |
| Some machine-audit gaps contradict current consumers | `scripts/crd-audit/automation.mjs` still says hands/tripod/operators and weapon timing are missing and omits dedicated physical-shield execution. It also adds broad remaining-condition text to every Ability. Its results need manual reconciliation; repairing this classifier is open tooling work, not a reason to reopen the implemented mechanics. |

## General-rule residual register

**Missing** below means no dedicated rule-aware procedure was found in the
reviewed service/UI path. **Partial/manual** means existing tasks, editing or
explicit declarations can represent some outcomes. Neither status means every
table decision should be inferred or automated. These entries extend the
completed contracts in the [master roadmap](crd-content-roadmap.md).

| ID / priority | CRD rule and locator | Current boundary and concrete follow-up |
| --- | --- | --- |
| C1 / High | Movement, 7625–7630 and 7899–7902 | **Missing dedicated workflow.** `item-service.mjs` handles immediate movement with a heavy Last attack, but short movement plus an action must hinder all tasks through the end of the next turn, and running long distance must hinder them by two. Add declared movement actions, action usage and persistent end-of-next-turn intervals. Keep range/route declarations with the GM. |
| C2 / High | Non-Rest Recovery, 7942–7943 | **Missing.** `recovery-service.mjs` implements completed rest/Rally, with ordinary recovery benefits. Add source-bound hostile effects consuming one or more eligible recoveries and time for a new defense, granting no ordinary Pool/wound benefit. Distinguish an effect ending on recovery from a recovery spent attempting to end it. |
| C3 / High | Explosives 5278–5281; Area Attacks 7944–7949 | **Partial.** `rules/task-effort.mjs` supports the two-damage area increment; `task-service.mjs` still resolves one target per call. General area Dodge hindrance, declared target sets, shared damage Effort, one roll versus per-target rolls and source-specific minimum damage need a coordinated contract. Arc Spray, Bouncing Shield and other specialized sequences do not close this general rule. |
| C4 / High | Configuration-switch action, equipment paragraph 5806 | **Partial.** `item-service.mjs:326–363` validates and saves configuration and announces an action cost, but does not consume managed round usage. Grip, hands, deployment, operators and attack category timing already work; only the switch's actual action expenditure is open. |
| C5 / High | NPC modifiers and circumstances, 7569–7570 and 7825–7902 | **Partial/manual.** General conditions, guard, prone/blinded/dazed cases, explicit extra steps and extreme range exist. `rules/general-effects.mjs:26–45` does not project every NPC hindrance/ease onto an opposing PC task. Weapon hindrance is consumed in NPC attacks, not universally in NPC defenses/other opposed tasks. Review both directions and retain explicit applicability for cover, light, mist, water, gravity, mounts, disarming and aimed attacks. |
| C6 / Medium | Other Defenses, 7939–7941 | **Partial/manual.** Ordinary stat defenses and special-damage tasks exist. An NPC bite plus a conditional poison defense is not one linked structured secondary-effect workflow in `npc-combat-service.mjs`; a secondary record alone does not execute it. Automatic failure is available for supported cases, but a clear voluntary no-defense choice and linked reroll attribution need review. |
| C7 / Medium | NPC interaction/allies and independent followers, 7970–7984 | **Partial/manual.** Intellect tasks, follower help/progression, source-bound allies and some independent attacks work. General communication hindrance and ordinary temporary NPC allies are declarations rather than a complete social/ally procedure. Independent NPC-versus-NPC outcomes remain GM adjudication; do not invent opposed rolls from a generic NPC Actor. |
| C8 / Medium | Defeating NPCs, 7735–7740 | **Partial/manual.** Health damage/Armor bypass are persisted. The post-defeat choice of death, unconsciousness or GM surrender is not a universal outcome chooser with attributable reversal. Numeric damage must not silently mean death. Mental/poison Armor exceptions need source-specific attack declarations, not name inference. |
| C9 / Medium | Earning XP, arcs and awards, 7990–8075 | **Missing dedicated arc/award workflow.** One editable XP balance and validated spending/intrusions exist. Initial free arc, later 1-XP arcs, step/climax/resolution rewards, Aid a Friend, story awards and GM milestone advancement need reference content and an explicit, receipted award procedure. Optional split XP needs an opt-in policy and separate accounting; it is not silently enabled. |
| C10 / Medium | Skill procedures, 64–246; object-style hacking/locks, 7749 | **Partial/manual.** Selected Skill modifiers and ordinary task retries work. Preserve skill-specific prerequisites, suggested difficulties, tools, language/communication and examples in reference content; add procedure-specific automation only from reviewed clauses. Treat the optional level-reduction interpretation of hacking/lockpicking as a declared mode, not ordinary physical object damage. |
| C11 / Medium | Character creation, 1–641; genre creation and Superheroes, 2912–3348 | **Partial/modelled.** Source application, tier/rank, Skills and Power Shifts have implementation. A full creation/progression matrix must still certify starting equipment, source alternatives, genre Skill availability, Power Shift categories and all parent Type/Focus/Descriptor benefits. Generic fields or a passing representative test do not certify each source package. |
| C12 / Ongoing | Exceptional healing, special damage and power-specific exceptions, 7813–7823 | **Partial by family.** Existing healing, conditions, specialist-damage protection and declared environmental profiles are usable. Other immunities, disease/poison treatments, gravity/senses/breathing and healing restrictions need individual source contracts. Many are explicit GM adjudications, not universal damage tables to invent. |

The single-GM/client reservation model, unknown partial writes, missing sources,
legacy owned Items requiring explicit source refresh and ambiguous intervening
healing remain documented operational boundaries. They require tests and clear
reconciliation controls as new families are added, not blanket stale-state
rollback. See the existing transaction and reroll contracts.

## Ability and cypher effect work that remains

The following is a family work partition, not a claim that every example is
wholly unsupported. Review each canonical variant and each clause before closing
an entry. Source names are examples for reviewers, not runtime dispatch keys.

| Family | Source-backed examples / locators | Remaining scope |
| --- | --- | --- |
| Passive stats, training, attack/defense and immunities | Combat Prowess 842; Expert Combatant 920; Enhanced Stat 1748; Armored Body 3355 onward | Generic modifiers cover only supported explicit fields. All additional damage, conditional training/easing, selected Pool grants and immunity clauses need inventory and consumers. Wound capacity support does not finish the rest of Armored Body. Include Descriptor benefits that are not standalone Abilities. |
| Direct offensive powers | Onslaught 2365 onward; Mindslice 1347 | Validate target kind, sight/range, stat, damage versus wounds, physical/mental Armor, paid Effort and special results. Generic base-cost payment and enriched chat do not make an attack. |
| Area and multiple attacks | Concussive Force 1762 onward; Spin Attack 1779 onward | Apply C3 with each source's targets, per-action allocation, extra actions, minimum damage and secondary effects. Preserve the completed shield/Spray sequences. |
| Further armor, retaliation and touch effects | Ice Armor 5163 onward; Improved Ice Armor 5185 onward; Electric Armor 4823 onward | Personal protections and Awesome are implemented; ice/electric contact damage, declaration, cost, duration and consequences remain separate. The Awesome barrier branch is not Force Field cypher activation. |
| Further healing and restoration | Resuscitate 5096 onward; Exceptional Healing Abilities 7813–7814 | Build on treatment, Rally, Healing Hand and restricted-damage attribution, adding each source's wound/Health amounts, restrictions, repeated use and recovery rules. |
| Movement and spatial powers | Magic Portal 1773 onward; relevant Focus definitions | Movement grants, flight/teleportation, phasing, destinations, transport recipients and duration need source-specific contracts. Automaton flight profiles are not a general movement engine. |
| Senses, concealment and detection | Invisibility 1764 onward; Detect Spirit 1344–1346 | Visibility/knowledge declarations, attacks that reveal a user, sense restrictions, targeted recipients and expiry; preserve the source-backed Beast Eyes implementation without generalizing it to every sense power. |
| Mental/social control, illusion and dispelling | Mind Reading 2364 onward; Grandiose Illusion 3990 onward; Spellbreaker 1776 onward | Willing/unwilling targets, attack and resistance, range, maintained actions, durations and effect-removal ownership. Soothe/Lighting/Team-Up do not finish every command or mental power. |
| Transformations, forms and further created entities | Changes Shape Focus, 3712–3835; source-specific forms elsewhere | Reconcile changed stats, senses, attacks, equipment, recipients and restoration; shared Actor schemas do not prove form execution. Temporary undead/Duplicate/Recompile companions already have their narrower contracts. |
| Rituals, prepared powers and special resource costs | Idol 1305–1312; Blood Sorcery 3887 onward; Prepare Spell 958 onward | Ritual time, depletion, stored/temporary power ownership, wound-funded Edge, prepared cypher equivalence and source-restricted crafting/resource points need dedicated flows. Resource projects do not execute every rapid-crafting or creation Ability. |
| Unfinished branches of existing families | Recompile Machine offensive bricking/explosion; other source variants in the existing contracts | Keep the exact implemented branch and remaining branch visible per canonical definition. A family label or common key cannot close unimplemented alternatives. |
| Particular cypher powers | Cyphers 5955–7380, including Power Boost 7330–7380 | All 198 definitions have common lifecycle support, but their general effect application remains descriptive in `item-service.mjs:25–38`. Partition healing/Pool/Edge, Skills/Effort, attacks/areas, protections, movement, senses, control, creation and Power Boost effects. Variants, tables, awards, capacity and depletion are completed infrastructure, not these power effects. |

`ability-service.mjs:28–97` selects an effect, pays its base cost and publishes
text; `ability-runtime-service.mjs` handles supported recovery end conditions.
`rules/ability-modifiers.mjs` consumes explicit Pool maximum, Edge and wound
capacity modifiers. Specialized services implement additional families. Every
new family needs its own acceptance matrix for source variants, costs, targets,
timing, cancellation, repeated activation, partial failure, rerolls, expiry,
reload, EN/FR controls and live behavior where applicable.

## Full reference-content destination register

This register covers every substantive top-level CRD chapter. It inventories
destinations rather than certifying every sentence. Blank/title paragraphs
0 and 5953–5954 have no game rule; Credits 8180–8201 require attribution/license
preservation rather than a new gameplay feature. There is no creature or
Artifact catalogue in this CRD. Their absence does not prevent supporting the
general Artifact rules at 5293–5298 or a user-authored NPC model. Community
Actors are an extra system capability, not a CRD catalogue to fabricate.

| CRD chapter / paragraphs | Existing representation | Content still needing a destination or verification |
| --- | --- | --- |
| Creating Your Character, 1–49 | PC schema, source application and selected rule excerpts | Full ordered creation guide, choices, initial resources/equipment and links; keep native sheet editing separate from certified creation rules. |
| The Core Character, 50–63 | Core PC fields and source foundations | Core character reference/flow and examples in the Player Guide. |
| Skills, 64–246 | 58 Skill Items, selected task modifiers | Genre lists, procedure context, examples, prerequisites and cross-Skill advice; link Items to complete references. |
| Descriptors, 247–456 | Descriptor Items, stat/Skill grants and supported modifiers | Source-specific narrative/conditional clauses and all non-Ability benefits; creation choices and references. |
| The Real World Genre, 457–617 | Type/Skill/option Items | Subgenre guidance and the full genre creation/reference layer. |
| Genre Character Abilities from Types and Foci, 618–641 | Canonical Ability/grant infrastructure | Explain cross-genre selection, restrictions and the accepted exact-bonus non-stacking boundary in the reference layer. |
| Fantasy Genre, 642–1857 | Types, species/options and Genre Abilities | Dungeon Fantasy, Swords & Sorcery, Epic Fantasy rules, creation advice, equipment recommendations and source-wide examples. |
| Science Fiction Genre, 1858–2906 | Types, species and Genre Abilities | Hard SF, Space Opera and Postapocalypse procedures; gear/technology, species restrictions and genre navigation. |
| Superheroes Genre, 2907–3437 | Ranked Types, Power Shifts and Origin Abilities | Complete superhero creation/reference including examples 3035–3036, Shift category clauses, scale, rank and Origin guidance. |
| Foci, 3438–5229 | 42 Items, Ability references/graphs, all 84 theme/intrusion paragraphs | Introductory selection/progression guidance, all package prerequisites/benefits and full graph-to-source review; keep flavour and mechanical evidence distinct. |
| Equipment, 5230–5952 | 259 ordinary equipment-family Items; Artifact depletion model | Price/category and currency-comparison references, equipment-use guidance, general Artifact rules, missing depletion advice 5594, descriptive special notes and services. |
| Cyphers, 5955–7380 | 198 Items, weighted generation/variants/tables, common lifecycle | Usage philosophy, subtle/manifest/Power Boost rules and linked tables in Journals; individual effects as above. Table weights and Item presence do not replace whole-section reference content. |
| Rules of the Game, 7381–7985 | Many rule/application services; selected Journals | Full rules navigation, remaining C1–C8/C10/C12, circumstance/illumination/area tables, interaction and example actions, Doing Something Else and explicit adjudication guidance. |
| Advancing Your Character, 7986–8179 | Advancement, resource projects, paid rerolls and intrusions | Earning XP/arcs/story/milestone/optional split XP; full downtime/qualification/crafting reference and source-bound special cases, without reopening completed advancement purchases. |

Seven Rules Journals are selected excerpts, not the complete Player Guide, GM
Guide or CRD index. Future reference work must retain full source clauses,
examples, boxed continuations and provenance; concise Quick Reference entries
should link to those complete passages. Guides should be navigation layers
rather than competing copies of rules. The 100 unresolved boxes and 61 table
destinations need an explicit per-entry decision, not only chapter-level ticks.

## Revised work order and completion evidence

1. **Close the high-priority general-rule gaps:** C1 movement, C2 non-rest
   recovery, C3 areas and shared Effort, C4 configuration action, C5 NPC modifier
   projection. Each is its own source-backed implementation lot.
2. **Continue effect families with explicit scope:** ice/electric protection,
   then other offensive/healing/movement/control families; track cypher effects
   alongside compatible Ability mechanics without treating their lifecycles as
   interchangeable. Add residual Descriptor/Type/Focus clauses to that matrix.
3. **Cover the remaining core/reference procedures:** linked defenses, NPC
   outcomes/interactions, arcs/awards/optional XP, Skills and creation packages.
   Some need a supported declaration/reference, others a stateful workflow.
4. **Complete source/reference navigation:** all chapter destinations, 100 boxes,
   61 table classifications, full Journals, Quick Reference and Player/GM guides.
5. **Repair audit classification and verify the final matrix:** map every
   structured field and canonical clause to extracted/modelled/executed/tested
   evidence; revalidate old locators under the current CRD hash and distinguish
   current owned-world data from refreshed compendium definitions.

No new live Foundry result or runtime pass count is claimed by this documentation
audit. Prior feature reports remain dated and scoped. The checks here are the
fresh source/callout/localization reports, direct code/test inspection, and
**23 passing source/callout/localization contract tests**, plus documentation
link/consistency checks and comparison of all 161 appendix locations to the
callout report. Production modules, source definitions,
translations, generated packs, the manifest and user worlds are not modified by
these documentation changes.
