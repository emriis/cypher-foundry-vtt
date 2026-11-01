# Command and allied powers

This family implements Soothe the Savage, Lighting a Fire Under Them and Team-Up
Ally through the PC sheet and `game.cypher.commands`. The supplied 2026-07-29
CRD remains the sole rule authority; reviewed clause hashes are stored in
`data/crd-command-powers.json`. NPC powers and fictional circumstances require
explicit GM declarations rather than interpretation of names or token geometry.

## Source contracts

| Ability | CRD locator | Implemented behavior |
| --- | --- | --- |
| Soothe the Savage | Changes Shape, paragraph 3728; Controls Beasts, 3930/3933 | Short range, visible speaking source, eligible nonhuman beast, 2 Intellect, non-damaging Intellect attack, action. |
| Lighting a Fire Under Them | Leads, paragraph 4486 | Last action, short-range ally/follower, next action becomes First; Last becomes ordinary. One use until ten-minute-or-longer recovery. |
| Team-Up Ally | Origin Superhero Abilities, paragraphs 3416–3418 | Actual level-4 superhero NPC, one permitted Origin power with agreed NPC adaptation, GM availability and difficulty-2 charm per outing, resource points plus several weeks of care after severe injury. |

The two Soothe occurrences have identical mechanics; their typography differs.
Source evidence uses the Changes Shape occurrence. Team-Up Ally is generated
from the existing Genre catalogue during normalization; no new compendium entry
or translation is authored.

## Calming and maintenance

The elected active GM confirms eligibility, short range, visibility and speech
before costs or dice. Aliens, extradimensional beings, very intelligent
creatures and robots are excluded by the source. The shared task engine applies
Edge/Effort once and handles paid rerolls, including the retained natural-20
cost-refund exception. Generic attack damage bonuses never turn calming into
damage. Failed attacks grant no calm and cannot be resumed as successful ones.

Accepted adjudication: calm lasts until a ten-minute-or-longer source recovery.
Maintaining it beyond that point requires an action each turn without paying
the initial Intellect cost again. The maintenance control spends that action
and records the next actual source-turn boundary. Missing a turn or changing
combat ends that maintenance interval; it cannot be restarted after a gap
without a new attack. Outside combat, interruption is explicitly declared by
the GM through the end control; no fictional round duration is invented.

Calm does not establish friendly disposition. Stronger Together and Beast Eyes
on a calmed beast now require a tracked successful calm plus their existing
presence/disposition declarations. Expiration or explicit ending invalidates
those benefits immediately on read, including native shared vision.

Payment and the awaiting source record share an Actor update. A successful
settlement checkpoints pending state before writing the actual NPC's reverse
link, then acknowledges the source record. An uncertain NPC response is
resumable after reload without another payment. A later recovery prevents an
old paid-reroll card from granting a fresh interval.

## Next-action timing

Lighting has a single source allowance across acquired copies. The source's
Last action and a pending use are recorded before updating the recipient.
An uncertain target response can be finished without consuming another use.
The next accepted primary/extra action consumes the recipient's command in
the same update as managed action usage. Rejected tasks, defenses, initiative
and minor activities do not consume it. Recovery renews the source allowance;
it does not remove an unspent recipient command.

Managed combat projects the retained command into the round queue, preserving
rolled initiative scores. An explicit Last plan becomes normal; ordinary plans
gain First eligibility. Declare a Last action in the round plan to give it an
ordinary slot rather than attempting it during the First phase. A recipient
that has already acted waits for its next action; elapsed slots never replay.
Pending not-yet-entered slots can be promoted after the current commanding slot.
Any First follow-up permits only the existing minor activity, not another
primary action. Preparation and waiting retain their explicit declarations.

Outside managed round flow, the command still has a persistent one-action
lifetime, while the GM adjudicates execution order. No rolled initiative is
rewritten to simulate the effect in the classic tracker.

## Superhero ally

One actual prepared level-4 NPC is bound to the source. Choose an existing
Origin Superhero Ability other than Team-Up Ally and write its agreed NPC
mechanics. The runtime does not copy a PC Ability onto an NPC and pretend that
its mechanics are executable there. Declared task modifications use the
existing follower asset rule and global cap. No task count, attack profile or
Health formula is invented.

Accepted adjudication: this ally stays level 4; it does not receive the general
follower tier progression. It is kept outside permanent follower slots. Binding
has a resumable pending checkpoint and an NPC reverse link; repeated source
clicks do not grant additional allies.

Each named outing needs a fresh GM availability declaration and difficulty-2
Intellect charm task. Its paid rerolls use the shared pipeline. Only a successful
current outing enables help or independent action. Closing the outing or
starting another invalidates older charm cards. Presence, incapacitation,
Health and the fixed level are rechecked when benefits are read. Independent
actions exclude ordinary help by that ally.

At zero Health the ally is marked injured rather than treated as a lost
follower. This flag is part of the same Health update, including native/manual
damage. An attributable attack correction reverses its own injury requirement
if it restores positive Health; intervening healing retains the existing manual
reconciliation boundary. Ordinary manual Health increases do not clear a
recorded severe injury.

Restoration uses the existing Restore Follower resource project: level 4 costs
2 resource points, with the previously accepted upward rounding. The GM must
confirm several weeks of care, enter the actual duration and identify its
source. A generic one-week project is rejected for this ally. No exact number
of weeks is invented. Completion restores Health, ends the old outing and
clears the injury restriction; a new outing still needs availability/charm.
Partial project settlement follows the existing receipt/manual-review contract.

## State and validation boundaries

Optional versioned flags hold source references, reverse links, recovery/turn
revisions, pending settlement and outings; no persisted schema migration is
needed. All multi-document activations are elected-GM actions with local guards
on the actual participating Actors, including synthetic Actors. Guards do not
claim distributed isolation from arbitrary external edits. No stale snapshot
rollback overwrites later Health, resources or circumstances.

Focused rule/service/content tests cover costs, permissions, rejected
declarations, source identity, non-damaging attacks, recoveries, maintenance,
pending resumption, managed timing, fixed-level help, severe injury, attack
correction and paid resource care. Live scenarios are scoped by
`command powers:`; observed results are recorded after execution.

### Observed live validation — 2026-11-01

All **five** scoped scenarios passed together on Foundry **14 build 369**,
Chromium **153.0.8010.12**, system **0.2.0-alpha.1**, in disposable Data:

- Actual EN/FR compendium imports in light/dark themes on a 640 × 700 PC sheet,
  mouse/keyboard Soothe declarations, a failed attack, reload, a retained
  natural-20 paid reroll, preserved synthetic/base NPC Health, Stronger Together
  and recovery expiration.
- Real Team-Up binding and outing dialogs, paid charm reroll after reload,
  task-specific capped help, fixed level after tier growth, severe injury,
  rejected care without confirmation, several-week resource-project settlement,
  ended outings and stale charm cards.
- Managed Lighting activation on a pending Last slot, ordinary execution,
  rejection of a duplicate primary action, exhausted/renewed source allowance,
  a later First slot and preserved initiative scores.
- The existing round-flow execution/reload and EN/FR light/dark GM-panel
  scenarios, including waiting, follow-up, Last timing and keyboard controls.

All 15 compiled-pack readability checks and packaged-tree verification passed.
No V13 live result is claimed; compatibility metadata remains unchanged.

The final isolated `npm test` passed **1,238 tests** across 32 suites, with no
failures or skips. All 16 focused command rule/service/content tests passed.
Lint, the existing type-checking pilot, architecture, native locale consistency,
system/E2E syntax and Git whitespace checks passed on the final source tree.

Changes cover runtime rules/services and their round/recovery/attack/follower/
project integrations, PC controls, reviewed source evidence and automation audit,
tests, documentation, and paired locale sources plus intentionally compiled
native bundles. Compendium authoring sources, generated pack databases,
distribution artifacts and the manifest remain unchanged in the authoring
checkout. No configured user world or Foundry installation was modified.
