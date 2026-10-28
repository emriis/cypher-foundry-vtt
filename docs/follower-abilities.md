# Permanent follower Ability benefits

This family consumes the shared [follower lifecycle](followers-and-benefits.md).
The supplied CRD **2026-07-29** is the rule authority. The reviewed first-passage
hashes and section locators are in `data/crd-follower-abilities.json`; the pure
plans list the additional paragraphs supporting alternatives and selection limits.

## Implemented benefits

| Ability | Permanent contract |
| --- | --- |
| Automaton Assistant | One level 2 automaton |
| Automaton Fleet | Four level 2 automatons |
| Expert Automaton | One level 3 automaton, or +1 level to an existing level 2/3 automaton and one new level 2 automaton |
| Automaton Evolution | +1 level to one automaton per acquired copy |
| Beast Companion | One level 2 beast per acquired copy, respecting that source copy's repeatability |
| Improved Companion | +1 level and existing modifications to a beast/mount; at most three acquired improvements |
| Mount | One level 3 mount, or advance an eligible beast to level 3 and gain a new level 2 beast |
| Basic Follower | One level 2 follower, two level 3 modifications including charm |
| Expert Follower | One level 3 follower with three chosen level 4 modifications, or advance an existing lower-level follower to 3 and gain a new level 2 follower |
| Improved Follower | +1 level and existing modifications; one new modification; at most one acquired improvement per tier |
| Band of Followers | Four level 3 followers with three chosen level 4 modifications each, or advance four existing level 2 followers to 3 and gain four new level 2 followers |
| Machine Companion | One level 3 machine |
| Improved Machine Companion | One new level 5 machine, or advance an existing lower-level machine to 5 |
| Retainer | One level 2 retainer |

CRD sections: Fantasy Genre / Dungeon Fantasy / Druid; Science Fiction Genre /
Space Opera / Noble; Foci / Builds Allies, Controls Beasts, Explores, Leads and
Talks to Machines. Only permanent numeric grants in the table are covered here.
No replacement creature's unstated task profile is invented in an alternative.

Accepted adjudication for **Improved Follower**: the new modification initially
equals the follower's **initial level at acquisition + 1**. Earlier progression
and improvements are not added retroactively. Subsequent tier progression and
explicit modification improvements advance it normally. Its optional `gainedAt`
offset records that boundary, defaults to zero for older task records, and
survives replacement. The existing agreement
to preserve absolute Health damage also applies to source-backed level gains.

Accepted distinction: Automaton Evolution and fixed-level upgrades change only
the general level. Existing modifications increase with Improved Companion,
Improved Follower and normal two-tier progression. Optional `taskLevelExclusions`
retains level-only gains without treating them as modification improvements.

## Interaction and authority

**Apply follower Ability** on the PC sheet selects an actual owned Ability,
its acquisition tier, a complete source alternative and all actual NPCs/tasks.
The active elected GM confirms creature appearance, size, movement and other
fiction-dependent qualifications from the source. These are not inferred from
names, descriptions, geometry, creature artwork or translated text.

NPCs already exist; the CRD supplies no bestiary to create them from. New NPCs
must have the source's initial level. Their existing maximum Health is retained;
the GM explicitly declares Health growth, as in the common lifecycle. Required
modification counts/levels are enforced. Charm is an explicit technical task ID,
not a label match. Generic optional modifications remain GM creature declarations.

An earlier manually linked grant can be explicitly bound to an acquired Ability
using the historical option. Its initial profile and acquisition tier must match
the source, and its receipt must be synchronized. Binding retains the original
slot, numeric baseline, current Health, availability, progression and improvements.
It cannot silently reinterpret an already source-bound grant or replay a historical
upgrade alternative. A profile that does not match needs explicit GM review.

Cancellation and rejected choices write nothing. One acquired Item copy grants
once; source limits span all retained use receipts. Imported repeatable copies
remain separate acquisitions. Nonrepeatable benefits cannot be multiplied by
duplicating their Items. Removing an Ability does not erase already granted
followers, improvements or the receipts needed to resume a pending operation.

## Persistence and failure boundaries

Public operations are exposed through `game.cypher.followers`:
`followerAbilityChoices`, `followerAbilityDetails`, `applyFollowerAbility`,
`followerAbilityUses` and `synchronizeFollowerAbility`.

Optional version 1 flags are additive; loading an existing world changes nothing:

- `flags.cypher.followerAbilityUses.<id>` records the acquired Item ID, technical
  key, source name, acquisition tier, alternative, affected slot IDs and
  `pending`/`complete` state.
- A follower slot's optional `sourceAbility` records its family, original acquired
  Item, source key and use receipt. Replacement retains this metadata.
- A task's optional `gainedAt` records improvements already present when a newly
  granted modification was acquired; existing tasks retain zero by default.
- A slot's optional `taskLevelExclusions` counts source-backed level-only gains;
  older slots retain zero and their established manual-improvement behavior.

All known prerequisites, source limits, quantities, selected families, profiles
and actual owner permissions are checked before the first write. The action
reserves actual PC/NPC owners, including synthetic Actors, on that client. Only
the elected active GM applies these multi-document benefits; these guards are
not distributed locks against arbitrary external document edits.

One PC update checkpoints the complete selection and all pending slots. Each
NPC then uses the existing atomic numeric/receipt synchronization. A rejected
or uncertain response leaves visible pending work: **Finish applying benefit**
resumes the saved selection, including after reload or removal of the source
Ability. It does not recompute/repeat an upgrade or allocate new slots. Unexpected
manual numeric changes use the existing reconciliation flow. No stale snapshot
rollback overwrites later wounds, Health changes or improvements.

## Explicit remaining contracts

This does not certify all effects of these Abilities. Retainer interception,
Automaton Assistant's quick repair, Mount's mounted movement/attack exception,
Stronger Together, Beast Betterment, Beast Eyes, automaton armor/cypher/flight/
turret/force-field upgrades and other active companion powers remain separate.
Team-Up Ally also needs its availability/charm and superhero-power contract.
Temporary followers from necromancy, Duplicate and Recompile Machine require
activation costs, timing, expiration and their own consequences.

Neither NPC-versus-NPC adjudication nor a universal creature damage/Health formula
is invented. Source acquisition/advancement remains with the existing Type,
Genre and Focus workflows; this family applies the acquired benefit afterward.

## Validation

Focused rules, service and content contracts cover quantities, alternatives,
profiles, limits, source identity, historical binding, synthetic owners, retained
damage, uncertain writes, reload resumption and replacement. The scoped live
scenario is `follower abilities:`. Observed full-suite and live results are
recorded after execution; compatibility metadata remains unchanged.

The final isolated `npm test` run passed **1,168 tests** across 32 suites with
no failures or skips. Lint, the existing type-checking pilot, architecture
dependencies, locale consistency, system/E2E syntax and Git whitespace checks
passed. Changes are limited to runtime rules/services and PC controls, reviewed
source evidence/audit coverage, tests, documentation and paired locale sources
plus their intentionally compiled native bundles. Compendium sources, generated
pack databases, distribution artifacts and the manifest remain unchanged.

### Observed live validation — 2026-10-28

Both scoped Foundry scenarios passed on **14 build 369**, Chromium
**153.0.8010.12**, system **0.2.0-alpha.1**, in disposable Data. The first
exercised actual EN/FR compendium imports in both light/dark themes at a
640 × 700 PC sheet size, keyboard and mouse controls, cancellation, required
task profiles, source improvements, preserved damage, the initial-level
modification adjudication, future tier progression and reload persistence.
The second resumed an uncertain four-NPC grant from the sheet after reloading
and deleting the acquired source Item, with no duplicate slots or Health gain.
The fixture reported no browser errors. All 15 compiled-pack readability checks
and the packaged-tree verification passed in the isolated runner. No V13 live
result is claimed and compatibility metadata remains unchanged.
