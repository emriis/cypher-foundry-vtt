# Shield runtime contract

## Source authority

Supplied CRD, revision 2026-07-29:

- Rules of the Game / Damage / Damage to Objects, paragraph 7748: a PC's
  defensive shield takes wounds rather than losing object levels.
- Rules of the Game / Defending / Dodge / Armor and Shields, paragraphs
  7930–7936: explicit absorption choice, independent capacity, overflow,
  destruction, and GM intrusions.
- Foci / Understanding Your Focus / Stands Like A Bastion, paragraph 4968:
  Shield Master adds one moderate wound slot to the shield.

The private reference is read locally; it is not copied into the repository.

## Normal shield behavior

| Trigger | Result |
| --- | --- |
| Equip an intact shield | It becomes an available choice for Block; it grants no additional armor easing or dodge penalty. |
| Successful Block, shield explicitly selected | The shield receives the entire original wound; the PC receives none. |
| Successful Block, ordinary reduction selected | Reduce the incoming wound by one step on the PC; leave the shield unchanged. |
| Failed defense | The PC receives the original wound; the shield receives none. |
| Successful Dodge | Avoid the wound without spending shield capacity. |
| Minor/moderate track full | Additional wounds overflow to the next severity, including cascading through both tracks. |
| First major wound, direct or from overflow | Mark the shield broken, unequip it in the same Item update, announce destruction, and exclude it from further absorption. |
| Several incoming wounds in one successful Block resolution | Recheck the shield for every wound. After destruction, resolve the remaining wounds using ordinary one-step Block reduction on the PC. |

A normal shield starts with **3 minor, 2 moderate, 1 major** wound slots. Minor
and moderate wounds do not diminish its effectiveness. Shield Master increases
only the shield's moderate capacity; it does not change the PC's track or rewrite
the shield's saved base maxima. Any major wound destroys a normal shield even
when an old/custom Item has a larger stored major maximum.

Equipping does not imply consent to sacrifice the shield. The PC defense dialog
retains the ordinary reduction choice. The NPC attack dialog also offers each
available target-owned shield as an explicit Block choice for wound attacks.
Both entrypoints use the same defense service. Direct `addWound`/`applyDamage`
calls do not manufacture a successful Block or automatically consume a shield.

Destroyed shields remain in inventory with their wound history and broken label;
they are not deleted. Their equipment controls are disabled. No generic recovery
or automatic repair is invented: this CRD passage provides none. A GM may edit
the Item to adjudicate restoration, loss, or destruction by intrusion.

## Ownership and persistence

Absorption requires a PC, current Actor/Item ownership, a valid severity, and the
actual equipped, intact Item in that Actor's collection. An unavailable explicit
selection rejects before Effort costs or dice. Equipment changes and absorption
share the Actor's client-local action guard with tasks. Nested consequences carry
the accepted task context; competing calls cannot consume the same snapshot.

Every absorption rechecks membership and current wounds after asynchronous dice
or previous hits. If the selected shield disappears or breaks during the action,
the successful Block still reduces the remaining wound on the character. The
actual absorption count is recorded in chat metadata; mixed shield/PC outcomes
include a localized note for the remaining reduced wounds.

Item writes are awaited before success chat. An Item write failure propagates
without publishing absorption. A later chat failure does not undo an already
committed wound. Guards are local to one client; they are not cross-client locks
or multi-document transactions. Synthetic token Actors retain their own Items
and wound state instead of updating the base Actor or another token.

No persisted fields or world migration are introduced. Existing major wounds
already make a shield unavailable, even if its saved equipped flag remains true.

## Explicit boundaries

- Unyielding Shield (Superheroes Genre / Origin Superhero Abilities, paragraphs
  3425–3428) changes destruction and recovery, and permits attacks. Those clauses
  require a separate source-bound shield designation and action contract; owning
  a descriptive Ability does not make every shield indestructible.
- Throw Shield, Bouncing Shield, Improvised Shield and Virtual Shield retain
  their individual execution boundaries; this change does not implement them.
- Hidden Shield (Fuses Flesh and Steel, paragraphs 4256–4259) has its own attack
  options and resource-based repair taking about a day. It does not establish
  automatic repair for ordinary shields, and its special procedure remains
  outside this normal-shield contract.
- Paid task rerolls currently do not replay or reverse previously persisted
  attack/defense damage. That existing reroll boundary also applies to shields.

These limitations must remain visible when assessing complete Ability automation.

## Validation

Focused application regressions cover destruction, overflow, explicit choices,
NPC wound attacks, permission/membership rejection, stale selections, concurrent
calls and failed persistence. DataModel tests protect major-wound destruction
without writes during preparation. Live scenarios import actual EN/FR shields,
exercise equipment and Block through the PC sheet, reload saved wounds and the
broken state, and isolate an NPC attack against one synthetic target.

Observed on 2026-10-19:

- Isolated normalized `npm test`: **764 passed**, no failures or skips.
- Current-source runtime lane: **510 passed**, no failures or skips; the focused
  shield regressions also passed after the final mixed-outcome chat change.
- Lint, type-check pilot, architecture audit, system/E2E syntax and locale checks
  passed.
- Isolated build: **15 compiled-pack checks** and package/manifest verification
  passed.
- Foundry **14.369.0**, Chromium **153.0.8010.12**: **4 live scenarios passed**.
  Both EN/FR source shields completed the lifecycle through the PC sheet, including
  explicit ordinary reduction, six shield hits, automatic destruction,
  unavailable equipment controls, absence from the next Block dialog and reload.
  A two-wound NPC attack changed only one synthetic Actor; the separate NPC-sheet
  scenario chose a linked target's shield through its actual defense dialog.

The full live gameplay suite, V13, theme/viewport combinations and multiplayer
cross-client contention were not rerun. `compatibility.verified` remains 14.369.
Generated compendium packs, ZIPs and the disposable world stayed outside the
authoring checkout. Runtime locale bundles were rebuilt from their paired domain
sources; existing user worlds were not migrated or edited.
