# Followers and conditional species benefits

## Source and scope

The supplied **Cypher Reference Document 2026-07-29** is the sole authority:
**Interacting With NPCs / Followers** (7974–7984), **Inflicting Damage on NPCs**
(7735), **Restore Follower** (8161), **Fantasy Species** (1798–1852), and
**Science Fiction Species** (2810–2893). Numbers are paragraph locators in the
supplied DOCX; no private reference file is copied or changed.

This lot supplies follower links, common advancement, declared task levels,
help and replacement, and reviewed numeric species benefits. It does not infer
an Ability's follower grant, invent a creature, parse localized names/prose,
infer token distance, or resolve narrative circumstances automatically.

Accepted user adjudications:

- Follower level gains increase maximum and current Health by the same amount,
  preserving absolute damage already suffered.
- Follower help is separate from PC cooperative-action modes. Its assets share
  the normal global cap with every other asset; it does not consume PC help.

## Follower workflow

The GM links an **existing actual NPC**, including a targeted unlinked token,
from the PC dashboard. A source declaration and confirmation establish the grant.
Linking never creates or chooses a creature from descriptive Ability text and
never changes document permissions. The GM can assign NPC ownership separately.

Declare acquisition tier, actual task levels and Health growth. NPC Health is
*often* three times level, not universally so: the dialog defaults growth to 3
but explicitly requires the GM to confirm the follower's profile. Task levels
are absolute effective levels, including any inability, rather than inferred
relative modifiers or matches against skill names.

For every two tiers gained after acquisition, add one to level and task levels,
including tiers beyond six. Already recorded gains never repeat or disappear
because of a later manual tier correction. Character advancement awaits writable
updates; the elected GM also handles remote/manual tier edits. Missing permissions,
interrupted updates or unexpected manual level/maximum edits remain visible and
can be synchronized or explicitly reconciled. No writes occur during preparation.

The NPC sheet displays the same follower-specific task levels as the PC dashboard.
Generic NPC modification prose is not reinterpreted or rewritten.

An available follower defaults to helping attacks. Choose attack help, defense
help or independent action, and declare availability separately. Ordinary tasks
can use an available helping follower; combat respects its selected role. Roll
options can exclude a follower for this task or explicitly select a task-specific
level. Level 5 or higher for that task gives two assets; lower levels give one.
The task engine applies the combined asset cap after follower, PC cooperation,
other assets and supported species assets have been added. Known conditions
that prevent the NPC from helping also prevent its assets. NPC Health/condition
edits refresh the owner dashboard without mutating its document.

Independent action replaces help. Existing NPC-to-PC attack controls check that
role; a former follower whose slot now references a replacement is an ordinary
NPC again. This CRD supplies no universal NPC-versus-NPC attack procedure here;
independent scouting, opposing NPC actions and their outcomes remain GM adjudication.
This lot does not invent a damage-growth formula or schedule an extra PC action.

A replacement occupies the same source slot and retains acquisition tier,
recorded tier gains, additional declared level improvements and the original
numeric follower profile. The old NPC remains unchanged. The replacement is an
actual selected NPC; a synthetic Actor's world base is not substituted. Unmodelled
source-specific improvements such as special powers require their own upcoming
Ability-family contract or explicit GM handling; they are not copied from prose.

Restore Follower uses the actual synchronized level for its existing Resource
Point cost and restores Health and linked availability. A known follower of
another PC, an obsolete link or an unsynchronized profile is rejected before
approval/payment. Old unlinked followers retain the earlier explicit GM
confirmation workflow rather than being guessed or automatically migrated.

## Reviewed species contracts

`data/crd-species-benefits.json` and its browser mirror contain **34** reviewed
numeric/conditional contracts. Each records canonical source identity, benefit
slot or conditional skill, source paragraph and an independently checked CRD
passage hash. Original authoring IDs are legacy aliases only: normalization can
rewrite them. Canonical identities bind both content languages.

| Family | Supported behavior |
| --- | --- |
| Conditional damage | Cyborg melee, D’nec light ranged energy, Dragonfolk chosen energy, Drakain blades, Dwarf axes, Elf bows, Gnome light melee, Halfling light thrown, Hellborn unarmed, Orc heavy melee, Rigellian ranged projectiles, Vendeer spears, Zantari ranged energy |
| Recovery | Dwarf adds 1 to the recovery roll; D’nec receives a separate fixed Intellect point, capped by the effective maximum |
| Natural-one intrusion immunity | Source-defined Block/Dodge/Might/Intellect defenses and Stealth/Athletics/Recognizing Motive tasks |
| Wound resistance | Aarak falling, Hellborn fire/heat, Zantari cold/ice; reduce personal wounds one severity step |
| Conditional assets | Delph pheromones, prepared camouflage and Prota's prepared task-specific shape |
| Conditional training | Dragonfolk intimidation except against dragons/dragonfolk, Dwarf underground/mountain navigation, Elf forest stealth |

Structured weapon categories/families determine known facts. Otherwise an explicit
per-task checkbox confirms the complete source condition; no extra amount is
accepted from that checkbox. Known contradictory weapon size cannot be overridden
by declaring a light/heavy gift. Distinct species gifts are additive outside the
Ability non-stacking group. Duplicate copies of one canonical gift do not mint a
second entitlement. A natural-one immunity removes only the free intrusion,
not failure, costs, ordinary GM intrusions or the die result. Rerolls retain that
original task context. Damage gifts are included in the original attack snapshot,
so paid rerolls do not add them a second time.

Choose Dragonfolk energy explicitly. The owner may establish it; changing an
established choice is a GM correction. The name is displayed, never parsed to
infer the nature of an attack. Delph camouflage and Prota shape preparation take
600 seconds of **game time**, with declared scope and a separate confirmation
that work completed uninterrupted. Simply waiting, opening/cancelling a dialog,
or checking an inapplicable source does not grant an asset.

Conditional training is stored separately from a Skill's permanent level. A new
conditional grant leaves an otherwise untrained Skill practiced. On a confirmed
applicable task it supplies the same training improvement as the source grant;
training acquired independently remains effective outside that condition. The
pipeline revalidates owned source IDs before costs or dice. Ordinary task retries
make fresh condition choices; paid rerolls keep the resolved original snapshot.

Typed incoming damage uses explicit `falling`, `fire`, `heat`, `cold`, `ice` tags.
Environmental profiles save these tags; ordinary defense API callers can declare
`incomingDamageTags`. No tag is inferred from a hazard/attack name. Personal
resistance applies before PC overflow, while a shield still absorbs the original
full severity. Block/interception forecasts and defense-reroll correction use the
same distinction. A fully resisted environmental occurrence needs no die or
Effort; stale helper/gift choices reject before the processing checkpoint.
Do not enter the same automatic species protection again as manual protection.

The D’nec point is applied once outside rolled allocation; recovery rerolls add
only their retained-roll difference and never repeat that fixed grant.

## Existing worlds and persistence

There is no persisted-schema rename or destructive world migration. Optional
version-1 flags retain existing data. New grants acquire mechanical bindings;
old grants are untouched until the GM explicitly requests a refresh/review.

- PC `flags.cypher.followers.<slot>` stores source, actual NPC UUID, original
  profile, monotonic gains, role, availability, replacement history and state.
- NPC `flags.cypher.followerProgress` stores owner/slot, profile revision and
  applied level/maximum. Level, Health and receipt commit in the **same NPC write**.
  A lost response can be retried after reload without increasing Health twice.
- Unexpected manual numeric changes mark the slot `manual`. A GM inspects/corrects
  the actual NPC before recording a note; synchronization never restores a stale
  Health snapshot. Conflicting owner/slot receipts do not supply help.
- Owned Ability `flags.cypher.ruleBenefit` and Skill `conditionalTraining` store
  versioned canonical rule IDs. Energy choices and preparation live in separate
  optional PC arrays; completed preparations preserve their declared scope.

**Link existing benefits** resolves recorded source IDs and technical slots,
including reviewed legacy authoring IDs, against actual world/compendium sources.
It preserves unknown gifts and all current Skill levels. It never matches names.
Old unconditional training cannot reveal whether later training came from another
source: **Review conditional training** therefore requires the GM to select the
actual Skill, independently justified base level and a review note. Repeating
that review never removes later independent training. Unknown historical sources
need explicit source reconciliation, not automatic guessing.

Client-local guards reserve actual owners; they are not distributed locks.
Registration/replacement and historical numeric correction are explicit GM actions.
Partial multi-document operations retain checkpoints and surface the need for
synchronization/reconciliation; no snapshot rollback overwrites later changes.

Public entrypoints are `game.cypher.followers` and `game.cypher.speciesBenefits`.
Pure rules live under `module/rules/`; application services own writes and sheets
collect/display declarations. Neither content descriptions nor preparation hooks
execute mutations.

## Remaining family work

The numeric contracts above do not certify every species/descriptor or Ability.
Aarak glide and Naron communication remain narrative; Mutant's adapted Focus
choice, Stelan's damage-for-next-turn replacement and further source-specific
follower powers require their own family contracts. Human's second descriptor
and the three earlier extra-minor-wound species grants retain their existing
implementation. Individual Cypher power effects also remain separate.

The next family work should consume these shared contracts, rather than duplicate
progression, caps, permissions, preparation, attribution or resource spending.
The [permanent follower Ability family](follower-abilities.md) now adds fourteen
source-backed grant/improvement contracts, source limits, complete alternatives,
historical binding and resumable use receipts. Its contract separately lists
active powers, temporary followers and remaining companion exceptions.

## Validation

Focused rules/application/content tests cover progression, retained damage,
replacement, uncertain-write replay, the global asset cap, conditional training,
preparation, energy choice, immunity context, resistances, shield separation,
reroll attribution and source hashes/identity. The isolated full suite and
`followers:|benefits:` live scenarios are reported after execution. Live scenarios
exercise EN/FR, light/dark, PC/NPC sheets, keyboard controls, reloading, actual
compendiums, synthetic replacement and restoration, legacy review, and typed
environmental protection. Compatibility metadata is unchanged; no V13 live
validation is implied.

### Observed validation — 2026-10-27

The final isolated `npm test` run passed **1,148 tests**, with no failures or
skips. Lint, the existing type-checking pilot, architecture dependencies, locale
consistency, E2E/system syntax and Git whitespace checks passed.

All **five** scoped `followers:|benefits:` Foundry scenarios passed on Foundry
**14 build 369**, Chromium **153.0.8010.12**, system **0.2.0-alpha.1**, using
disposable Data. They exercised EN/FR and light/dark PC/NPC sheets at a 640 × 700
PC sheet size; keyboard registration, role and task selection; tier growth and
retained Health damage; unconscious-helper exclusion and cross-document sheet
refresh; reload and uncertain-write resumption; synthetic replacement and
Resource Point restoration; real bilingual species grants, conditional training,
axe/recovery bonuses, preparation and explicit historical training review; and
typed wound resistance, shield separation, successful paid-reroll correction
preserving a later wound, and fully resisted environmental occurrences.

The E2E runner normalized, built, extracted and verified its package in isolation,
including all 15 compiled-pack readability checks. No compendium source,
generated database, distribution artifact, compatibility metadata, configured
Foundry setting or user world was changed in the working checkout/installation.
Only native EN/FR UI bundles were intentionally regenerated here.
