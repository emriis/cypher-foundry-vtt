# CRD Content Roadmap

This is the master roadmap for converting the 2026-07-29 Cypher Reference
Document (CRD) into a Foundry-first content and automation layer.

Completed work remains recorded here as completed history. Only work that is
obsolete or contradicted by the current source is removed.

## 1. Status legend

- **Complete** — implementation and acceptance contracts are complete and merged.
- **In progress** — implementation exists but the scope is not complete.
- **Planned** — not implemented yet.
- **Blocked** — cannot proceed without a source, model, or explicit decision.

A content family is not complete merely because records exist. Completion
requires source coverage, structured mechanics, provenance, reference integrity,
tests, and a deterministic build where applicable.

## 2. Current program status

| Area | Status |
| --- | --- |
| Architecture and source/build foundations | Complete |
| Core Cypher rules and character foundations | Complete for the implemented system scope |
| Skills | Complete |
| Abilities | Complete canonical catalogue and runtime lifecycle |
| Types | Complete |
| Descriptors | Complete |
| Foci | Complete |
| W4 equipment/weapons/armor/shields | Complete source-backed inventory |
| Subtle/Manifest/Power Boost Cyphers | Complete source-backed inventory |
| CRD Journals | Planned |
| Quick Reference | Planned |
| Player/GM guides | Planned |
| Genre Ability integration | Complete |
| Broader genre reference layer | Planned |
| CRD creature extraction | Not applicable: supplied CRD contains no creature inventory |
| Artifact extraction | Blocked: supplied CRD contains no Artifact inventory |
| Runtime consumption of all structured mechanics | In progress |
| Playwright/Foundry E2E infrastructure | Complete; gameplay coverage continues to grow |

## 3. End-state architecture

### 3.1 Structured reusable content

Reusable character and equipment content is represented as Items with stable
logical IDs, provenance, bilingual pairing, and structured mechanics.

### 3.2 Reference Journals

Rules, procedures, and navigation material belong in Journals. Journals do not
replace structured reusable Items.

### 3.3 Automation

Automation consumes structured content through application services and pure
rules. Source extraction alone is not considered automation.

## 4. Phase 1 — Architecture and foundations — Complete

The completed phase established:

- source/build conventions;
- deterministic compendium generation;
- provenance and logical IDs;
- dependency boundaries;
- compatibility facades;
- test organization;
- pack validation.

These items remain historical acceptance criteria and are not pending work.

## 5. Phase 2 — Core rules and character foundations — Complete

Completed scope includes the implemented Cypher task, Effort, Edge, wounds,
recovery, advancement, and character-service foundations.

The Ability runtime model is also implemented:

- standalone Ability Items;
- structured costs and cost options;
- structured effects and modifiers;
- recovery-based end conditions;
- actor-owned active effect state;
- activation/deactivation;
- cost handling;
- modifier aggregation;
- structured Ability roll-table resolution.

## 6. Phase 3 — Reusable player content — Complete

### 6.1 Skills — Complete

The CRD Master Skill List was extracted with canonical identity, bilingual
pairing, provenance, and content contracts.

### 6.2 Abilities — Complete

The Ability catalogue has canonical identity, variants, provenance, localization,
Genre Ability integration, reusable references, and reference-integrity tests.

Same-name Abilities remain separate when their mechanics differ.

### 6.3 Types — Complete

The complete source-backed Type inventory is normalized and paired in English and
French, with structured mechanics and tests.

### 6.4 Descriptors — Complete

Descriptors, including species-style descriptors, are represented as reusable
source records with structured stat/skill/benefit data, provenance, pairing, and
fidelity/contract tests.

### 6.5 Foci — Complete

All 42 Foci have standalone Ability references, flowchart integrity and tier
checks, EN/FR identity checks, provenance contracts, and representative CRD
fidelity coverage.

### 6.6 Equipment family — Complete

W4 is complete for all source-backed equipment families in the supplied CRD.

The source inventory contains 259 English records paired with 259 French records
across equipment, weapons, armor, and shields.

Artifacts are not marked incomplete through implementation: the supplied CRD has
no Artifact inventory, so extraction is explicitly source-blocked.

## 7. Phase 4 — CRD Journals, Quick Reference, and guides — Planned

### 7.1 Core CRD Journal

- [ ] Inventory reference and procedure sections.
- [ ] Define Journal source schema and hierarchy.
- [ ] Implement deterministic Journal generation.
- [ ] Link Journal entries to structured records.
- [ ] Add EN/FR and provenance tests.

### 7.2 Quick Reference

- [ ] Extract high-frequency rules.
- [ ] Create concise Journal entries.
- [ ] Link to authoritative detailed rules.
- [ ] Add navigation and tests.

### 7.3 Player Guide

- [ ] Build navigation after linked content exists.
- [ ] Link character creation, reusable options, equipment, combat, recovery,
  advancement, and Quick Reference.

### 7.4 GM Guide

- [ ] Build navigation after linked GM content exists.
- [ ] Link running rules, combat, recovery, GM procedures, rewards, genres,
  tables, and Quick Reference.

## 8. Phase 5 — Genres — In progress

### 8.1 Genre inventory

- [ ] Build the complete genre reference/navigation layer.
- [ ] Record genre-specific sections and provenance.
- [ ] Identify remaining genre-specific structured content.

### 8.2 Genre Abilities — Complete

- [x] Fantasy Genre Abilities.
- [x] Science Fiction Genre Abilities.
- [x] Superhero Genre Abilities.
- [x] Canonical identity integration.
- [x] Same-key/different-mechanics variants.
- [x] EN/FR materialization.
- [x] Provenance.
- [x] Contract tests.

### 8.3 Genre Journals

- [ ] Genre overview.
- [ ] Character-creation procedure.
- [ ] Genre rules.
- [ ] Genre skill guidance.
- [ ] Recommended character options.
- [ ] Cross-links to reusable content.

## 9. Phase 6 — GM library — Planned, with one source limitation

### 9.1 GM procedures

- [ ] GM procedures.
- [ ] GM Intrusions.
- [ ] Encounter guidance.
- [ ] Rewards and treasure.
- [ ] Preparation and adjudication guidance.

### 9.2 Creatures and NPCs

The CRD conversion does **not** include a creature extraction plan because the
supplied CRD contains no creature inventory.

The NPC Actor model is a generic, user-authored stat block rather than an
extracted creature catalogue. Its schema covers level/target number, health,
armor, damage, movement, modifications, description, motive, environment,
combat, interaction, use, loot, GM Intrusion suggestions, and private GM notes.
Damage remains a source-faithful free-text field for now: examples are needed
before splitting wound severity, Pool damage, armor bypass, or multiple wounds
into structured mechanics.

### 9.3 Random tables

- [ ] Inventory actual CRD random tables.
- [ ] Represent genuine random tables as RollTables.
- [ ] Keep prose lists as Journal content.
- [ ] Validate results and weights.

## 10. Phase 7 — Runtime automation and verification — In progress

The original automation goal remains valid, but the work is now driven by
structured data already present in the source packs.

### 10.1 Completed runtime foundations

- [x] Ability activation and cost handling.
- [x] Ability effect lifecycle and recovery expiration.
- [x] Ability modifier aggregation.
- [x] Type/Focus advancement benefits for supported structured categories.
- [x] Weapon attacks for core attack/damage behavior.
- [x] Armor and shield runtime behavior covered by current models/services.
- [x] Cypher depletion.
- [x] Damage, wounds, and recovery.
- [x] Player-facing Playwright/Foundry E2E runner infrastructure.

### 10.2 Current runtime closure work

- [x] Resolve weapon `mechanics.targetEffects` against the selected NPC level
  and carry matching effects into the attack result/chat flags.
- [x] Audit every structured weapon `range`, `properties`, and `mechanics`
  field and classify it as runtime, descriptive-only, resolved/presented, or
  model-gap in [the weapon runtime matrix](crd-weapon-runtime-matrix.md).
- [ ] Apply weapon target effects to persisted target state. This is blocked on
  defining an effect/status model and duration lifecycle; selection and chat
  flags alone are not application.
- [x] Add structured NPC attack data for numeric, wound, and Pool damage, Armor
  bypass, multiple wounds, and secondary-effect metadata.
- [ ] Execute NPC wound/Pool attack damage against player targets. Keep this
  separate from NPC Health damage and require a target-side application contract.
- [x] Successful attacks automatically apply numeric damage to the selected NPC
  target and persist Health changes.
- [x] Consume `mechanics.ignoresPhysicalArmor` through a pure Armor-bypass rule
  exactly once.
- [ ] Implement range resolution after defining the target-token/scene-distance
  contract.
- [ ] Close remaining stored-only weapon mechanics when their CRD semantics and
  required state models are explicit.
- [ ] Verify all structured granted Type/Focus benefits in gameplay, including
  granted armor categories.
- [ ] Implement generic Cypher `variants` resolution.
- [ ] Implement generic Cypher `randomRange` resolution.
- [ ] Implement generic Cypher `rollTables` resolution.
- [ ] Audit structured Cypher effects and implement source-backed runtime
  semantics where required.
- [ ] Add unit, behavior, and E2E contracts for the resulting mechanics.

### 10.3 Verification

- [x] Real Foundry/Playwright E2E runner.
- [x] One worker-scoped browser session and GM login.
- [x] Disposable-world cleanup restricted to generated E2E worlds.
- [x] Browser and system syntax preflight.
- [ ] Expand gameplay E2E coverage as runtime mechanics are closed.
- [ ] Run final provenance/reference/stale-build audits after the runtime work.

## 11. Cross-cutting contracts

### Identity

- Display names are never canonical deduplication keys.
- Same name plus identical mechanics may share one canonical record.
- Same name plus different mechanics must remain separate.

### Bilingual content

- English and French records share canonical logical identity.
- Mechanical data remains equivalent.
- French may temporarily retain English CRD text when no faithful localization
  exists.
- Translation never changes rules, numbers, costs, durations, ranges, tiers, or
  prerequisites.

### Provenance

Every CRD-derived record must be traceable to its source section and language.

### Automation-first data

If a CRD mechanic maps to a supported structured field, it belongs in that field
rather than only in prose.

If the model cannot faithfully represent a mechanic:

1. preserve source text;
2. document the model gap;
3. extend the model only from an explicit source requirement;
4. add tests before consuming the new field.

### Testing

Business/content tests validate contracts and invariants rather than arbitrary
compendium counts.

Completed families require, as applicable:

- schema tests;
- identity tests;
- provenance tests;
- EN/FR pairing tests;
- reference-integrity tests;
- mechanical fidelity tests;
- deterministic build validation;
- CI validation.

## 12. Current work queue

### W1 — Types — Complete

- [x] Complete CRD inventory.
- [x] Normalize mechanics.
- [x] Resolve Ability and Skill references.
- [x] Complete EN/FR pairing and provenance.
- [x] Add fidelity and contract tests.

### W2 — Descriptors — Complete

- [x] Inventory descriptors and species-style descriptors.
- [x] Normalize stat/skill/benefit mechanics.
- [x] Review source-specific benefits versus reusable Abilities.
- [x] Complete EN/FR pairing and provenance.
- [x] Add fidelity and contract tests.

### W3 — Foci — Complete

- [x] Inventory all Foci.
- [x] Rebuild Ability references.
- [x] Validate flowchart structure and tier progression.
- [x] Complete EN/FR pairing and provenance.
- [x] Add structural inventory/reference contracts.
- [x] Add CRD fidelity tests.

### W4 — Equipment foundations — Complete

- [x] Complete source-backed equipment, weapons, armor, and shields.
- [x] Validate model fields against CRD mechanics.
- [x] Document model gaps and source-backed extensions.
- [x] Validate weapon-specific properties against source tables.
- [x] Extract provenance and bilingual pairing.
- [x] Add fidelity and contract tests.

### W5 — CRD Journal foundation — Planned

- [ ] Inventory reference/procedure sections.
- [ ] Define Journal source schema and hierarchy.
- [ ] Implement deterministic Journal generation.
- [ ] Link Journals to structured records.
- [ ] Add EN/FR and provenance tests.

### W6 — Quick Reference — Planned

- [ ] Extract high-frequency rules.
- [ ] Create concise Journal entries.
- [ ] Link to authoritative rules.
- [ ] Add navigation and tests.

### W7 — Player/GM Guides — Planned

- [ ] Build player navigation.
- [ ] Build GM navigation.
- [ ] Validate all links.

### W8 — Genres and GM library — In progress

- [x] Canonical Genre Ability integration.
- [ ] Complete genre reference/navigation.
- [ ] Add actual CRD random tables.
- [ ] Add GM procedures and rewards.
- [ ] Do not add a CRD creature extraction task: the source contains no
  creature inventory.

### W9 — Runtime automation and E2E — In progress

- [x] Define the player-facing vertical slice.
- [x] Build the real Foundry/Playwright runner.
- [x] Establish structured Ability runtime.
- [x] Establish core equipment/attack runtime.
- [ ] Close structured weapon mechanics.
- [ ] Close generic Cypher variants/random tables.
- [x] Audit structured weapon mechanics with an extracted/modelled/runtime-gap
  matrix.
- [ ] Complete the extracted/modelled/validated/runtime/E2E matrix for all
  structured mechanics, including Cypher effects.
- [ ] Expand high-value player and GM E2E workflows.
- [ ] Run final provenance/reference/stale-build audits.

## 13. Historical milestones

Meaningful milestones remain recorded here rather than treating every PR as a
roadmap phase:

- architecture foundations and the Phase 1-8 refactor: complete;
- Master Skill List extraction: complete;
- Ability identity hardening and catalogue: complete;
- Type, Descriptor, Focus, and W4 equipment completion: complete;
- Genre Ability integration: complete;
- CRD Cypher inventories: complete for the source-backed Cypher categories;
- E2E runner hardening and ApplicationV2 sheet rendering: complete.

## 14. Source and governance rules

- The 2026-07-29 CRD is the source revision tracked by this roadmap.
- Do not invent missing rules or silently repair source ambiguities.
- Do not make Journals a second source of truth.
- Do not duplicate reusable Abilities.
- Do not use display names as canonical identity keys.
- Do not weaken tests to make extraction pass.
- Do not hand-edit generated LevelDB packs.
- Keep repository documentation in English.
