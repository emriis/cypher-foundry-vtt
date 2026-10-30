# Companion support powers

This family adds support clauses to the [permanent follower benefits](follower-abilities.md)
and [shared follower lifecycle](followers-and-benefits.md). The supplied CRD
**2026-07-29** remains the sole authority; `data/crd-companion-powers.json`
records independently reviewed paragraph hashes and sections.

## Source contracts

| Source | Executed behavior |
| --- | --- |
| Automaton Assistant, Builds Allies 3579 | A few declared minutes of completed attention restore 2 Health, capped at maximum. Expert Automaton inherits this through 3590. Fleet does not acquire an unstated repair clause. Zero-Health/destroyed automatons require restoration. |
| Stronger Together, Controls Beasts 3941 | Immediate proximity gives the PC +2 attack damage and both participants one defense asset. A source-bound beast/mount or explicitly already-calmed, still-friendly beast qualifies. |
| Beast Betterment, Controls Beasts 3946; Mount substitution 3939 | Immediate proximity to the chosen beast companion/mount gives +3 recovery Pool points. A merely calmed beast does not qualify. |
| Mount, Controls Beasts 3938 | Declared riding/movement on the PC's turn grants one attack asset, even with an independently acting mount. That mount cannot simultaneously provide ordinary follower attack help. |
| Retainer, Science Fiction / Noble 2337 | An elected GM confirms an intercepted hit and numeric NPC Health damage. The PC pays 2 Intellect, discounted once by Edge; NPC Armor applies to the declared damage. No PC defense die, wound or shield consequence is produced. Zero Health means unconscious, not dead. |

The supplied text gives no universal conversion from PC wounds or Pool damage
to NPC Health. The Retainer dialog therefore requires the GM to adjudicate the
hit and numeric damage before Armor. This does not create an NPC-versus-NPC
attack procedure or silently turn a failed PC defense into an interception.

Accepted distinction: **Stronger Together requires a conscious companion capable
of helping; Beast Betterment requires only presence and life**, including an
unconscious, living companion. Native Foundry incapacitation statuses and shared
condition flags disable active help/mounted movement. Death is an explicit
declaration/native dead status; zero Health alone is not a universal death rule.

## Declared circumstances and rolls

**Companion circumstances** selects the actual source-bound follower or an
already-calmed beast, immediate proximity, living/present status, disposition and
mounted movement on the PC's turn. Players update these declarations when the
fiction changes. Neither token coordinates, translated names nor descriptive
prose establish mechanics. Soothe the Savage's own attack, costs and duration
are not executed by declaring an already-calmed beast.

An initial/replaced link requires ownership of the NPC (normally GM); later
circumstance changes require only the PC owner. Both actual owner identities,
including synthetic Actors, are retained. A pending link grants no benefit;
repeating the declaration resumes it. Replacement invalidates the old proximity
declaration until the new NPC is explicitly selected.

Task bonuses enter the shared engine before its global asset cap. Conditional
damage and assets are saved in the original roll snapshot for paid rerolls.
For an NPC's defense asset, the attacking PC is hindered by one step under
**The Player Always Rolls**, CRD 7569–7570. Duplicate copies of the same passive
power never multiply it. Mount movement does not consume a second PC attack or
invent token movement; the existing round engine still validates the PC action.

Betterment's three points enter the recovery roll's flat bonus and allocation;
paid recovery rerolls add only their retained total increase. They do not grant
the three points a second time. An allocation awaiting input rechecks current
companion circumstances before committing any Pools or recovery markers.

## Timed attention and interception receipts

**Attend to damaged automaton** records an explicitly agreed few-minute duration in game
seconds. Only one attention operation may be active per PC. Advancing time does
not complete work: **Complete attention** explicitly confirms the actual work.
Working attention may be cancelled without healing or resource spending.

Interception is offered in the NPC attack dialog when the actual targeted PC has
a synchronized Retainer. It cannot combine with a shield or PC cooperative mode
in this automated branch. It uses the NPC attacker's action and no PC primary action;
the PC pays before NPC damage. The known source, owners, availability, cost and
declared damage are validated before spending. Non-GM callers cannot force a hit.

Optional version 1 flags are additive; loading a world does not modify it:

- PC `companionContext` and NPC `companionLinks` bind circumstances to actual
  owners. Old superseded NPC links are inert because the PC context ID must match.
- PC `companionRepairs` records timed work and `working/pending/complete/cancelled`
  states; NPC `companionRepairs` receipts share the same atomic write as Health.
- PC `retainerInterceptions` checkpoints the Intellect payment and pending hit;
  NPC `retainerInterceptions` receipts share the damage/condition write.
- Retainer unconsciousness is source-tagged. Resource-point restoration removes
  that annotation and restores availability while retaining unrelated conditions.

A lost response after committed healing/damage resumes without repeating it.
Later damage/healing is preserved; no historical Health snapshot is restored.
Completed attention can finish with zero restoration after unrelated healing
has already filled Health. Cancellation and completion reserve the PC before
resolving the NPC, so an accepted cancellation cannot subsequently heal anyway.
An accepted, paid interception can finish after the source Item is removed. The
attacker's monotonic action revision also makes its interval cleanup resumable
without expiring a second action. Missing/replaced documents or unexpected
follower numeric edits require explicit GM inspection, not silent substitution.

Client guards reserve actual owners from the initial asynchronous request and
prevent local overlapping work/reactions. They are not distributed locks against
arbitrary edits from another client. Partial actions remain visibly pending;
failed writes/chat output never trigger a stale rollback of resources or Health.
The public namespace is `game.cypher.companions`.

## Remaining companion families

Beast Eyes and automaton armor/cypher/flight/turret/force-field upgrades now have
a separate [implementation contract](companion-upgrades.md). Team-Up Ally and
temporary followers from necromancy, Duplicate and Recompile Machine remain
separate contracts. Broader healing/protection/attack/movement/mental Ability
families also remain on the roadmap.

## Validation

Focused tests cover living/unconscious distinctions, NPC defense inversion,
calmed disposition, mounted help exclusion, global caps and original roll data,
recovery allocation revalidation, timed work, actual synthetic NPCs, permissions,
Edge, insufficient resources and uncertain-write resumption. The live scenarios
are scoped by `companion powers:`. Observed results are recorded after execution;
no V13 compatibility or unrelated world changes are implied.

### Observed validation — 2026-10-29

The final isolated `npm test` run passed **1,184 tests**, 32 suites, with no
failures or skips. Lint, the existing type-checking pilot, architecture,
native locale consistency, system/E2E syntax and Git whitespace checks passed.

All **four** final `companion powers:` live scenarios passed together on Foundry
**14 build 369**, Chromium **153.0.8010.12**, system **0.2.0-alpha.1**, in
disposable Data. Observed cases were:

- Actual EN/FR Ability imports in light/dark themes, a 640 × 700 PC sheet,
  keyboard/mouse circumstance controls, capped attacks, reversed NPC defense,
  native unconsciousness, living-companion recovery, reload and paid recovery
  rerolls that add only their increase.
- An independently acting mount's one-asset attack exception without ordinary
  follower help being added for that same mount.
- Timed attention through the PC controls on an actual synthetic automaton,
  explicit completion, an uncertain committed heal, later unrelated damage and
  reload/resumption while the base Actor remains unchanged.
- A real targeted token and NPC attack sheet selecting Retainer, discounted
  Intellect, NPC Armor, unconsciousness at zero Health, no PC wound, restoration
  availability, and uncertain NPC action cleanup resumed once from the PC sheet.

The isolated runner also passed all 15 compiled-pack readability checks and
verified that its installed package matched the tested tree. No compatibility
metadata, compendium sources, generated packs or distribution artifacts changed
in the authoring checkout. Only paired native locale bundles were intentionally
compiled here; no configured user world or Foundry installation was modified.
