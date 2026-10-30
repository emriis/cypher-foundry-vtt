# Automaton upgrades and Beast Eyes

## Source and decisions

The supplied 2026-07-29 CRD is the sole rule source: **Builds Allies**, paragraphs
3586–3587, 3595–3596, 3601 and 3604, and **Controls Beasts**, paragraphs 3939 and
3943. Independently read clause hashes are in `data/crd-companion-upgrades.json`.
The owner pays the armor/cypher upgrade's Intellect cost **each activation**, with
Edge, rather than at installation. Each automaton has one physical form: normal,
light armor, heavy armor or turret. Installed flight, an active field and timed
cypher capacity remain separate; the turret's explicit immobility overrides flight.

## Installation and use

The PC's Followers section provides GM installation and activation controls.
The elected active GM settles these cross-document operations. The retained
Ability is bound to one synchronized, source-qualified automaton slot. A
replacement inherits installed capabilities but never the former NPC's active
transformation. Duplicate installations of the same upgrade are rejected.

- Light/heavy armor costs 3/6 Intellect before Edge and uses the automaton's
  action. It is freely usable armor for its owner. An immediate-distance
  declaration automatically equips it; otherwise normal equipment controls
  equip it later. One persistent Item per slot preserves Block damage through
  transformations. Recasting does not repair it. A one-hour or longer owner
  recovery ends the transformation. Other armor is not automatically restored.
- Cypher capacity costs 3 Intellect before Edge and adds one slot for 86,400 game
  seconds. Inventory display, acquisition and native inventory validation use
  the effective limit; an open sheet refreshes when game time changes. Expiry
  changes neither saved capacity nor carried Items;
  an existing excess remains visible under the ordinary over-limit policy.
- Flight is installed without a resource/action cost. It declares long normal
  movement, reduced to 20 feet (6 m) per round when carrying its owner, including
  while worn as armor. The circumstances control declares carrying; no token
  geometry, movement, anatomy or unrelated passenger allowance is inferred.
- The level 5 force field includes the actual automaton and explicitly selected
  creatures declared within immediate range. Its benefit ends at the owner's
  ten-minute or longer recovery. Incoming PC wounds reduce one severity; NPC
  Health damage reduces by 3 independently of Armor bypass. Identical fields
  do not stack. Recipient links alone cannot grant protection. Circumstance
  updates replace the declared recipient set when creatures enter or leave.
- A turret creates a heavy, very-long-range, 7-damage attack Item for the owner
  or chosen ally. Ordinary equipment controls declare its grip; ordinary heavy
  weapon familiarity applies. Operator attacks gain one ease step and use Last
  action through the shared attack/reroll engine. Ending the form disables the
  retained weapon and releases its effective hand allocation; explicitly
  reconfiguring a turret back to normal also uses the automaton's action.
- An independent automaton can instead fire one hindered autonomous shot per
  combat round, with Last action timing. Outside combat, the GM supplies a
  stable narrative round ID. The GM adjudicates NPC-versus-NPC hits; numeric
  damage uses the actual target's Armor and field protection. Against PCs, the
  GM explicitly declares a wound/Pool profile for the numeric weapon and the
  existing defense pipeline resolves it at automaton level minus one. The
  system does not invent a numeric-to-wound conversion. An interrupted shot
  remains pending for GM review and cannot replay automatically.
- Beast Eyes costs 3 Intellect before Edge and uses the owner's action. It uses
  the declared beast companion, chosen mount, or already calmed friendly beast;
  it does not execute Soothe the Savage. The owner explicitly declares the
  one-mile (1.6 km) range and may suspend/resume that circumstance without a
  second purchase. A ten-minute or longer owner recovery ends the link.

Normal follower help and ordinary NPC attacks are disabled while the automaton
is transforming or in armor/turret form. Turret attacks use their dedicated
source-qualified path. Physical feasibility, range and calmed disposition remain
explicit declarations; the system does not measure adjacency or establish them
from descriptive prose.

## Vision and state boundaries

Beast Eyes optionally identifies one actual Scene Token for native sight.
Its vision profile remains native: no NPC ownership, control, sight settings,
vision-mode defaults or saved PC senses are overwritten. The token contributes
vision to users owning the linked PC. Hidden tokens retain the non-GM restriction
and off-level tokens do not contribute. Without a token, the persisted link is
narrative only. Native vision represents sight; other senses remain descriptive.
The extension uses the V13/V14 Token `hasSight`, `_isVisionSource` and
[`initializeVisionSource`](https://foundryvtt.com/api/v14/classes/foundry.canvas.placeables.Token.html)
contracts. V13 API availability does not establish live V13 compatibility.

Optional version-one flags hold installations, activations, recovery revisions,
field recipient links and action receipts. No stored schema default or migration
is required for actors without these flags. Services reserve actual document
identities before their first asynchronous source read, including synthetic
Actors. Installation/activation are GM-authoritative; client-local guards are
not cross-client locks.

Payment and a pending activation are persisted together. Each subsequent action
and proxy Item has a durable identity. A lost response can be resumed without
paying again, recreating equipment or consuming the acknowledged action again.
Deleted/duplicate proxy Items require GM reconciliation rather than silently
creating undamaged replacements. Recovery revisions invalidate benefits in the
same PC update as rest; cleanup only unequips retained armor. Cleanup failure
does not restore the benefit, refund costs or overwrite intervening damage.

Attack history snapshots field mitigation for paid rerolls even after expiry.
PC defense history likewise snapshots its one-severity reduction. A redirected
attack keeps the original defender's protection separately from the actual
recipient's, so a successful Block reroll can return a residual wound correctly.
Shields still receive the original wound severity because the field protects
creatures.

## Validation

Focused rules/application/content tests cover source profiles, activation costs,
permissions, exclusive forms, damage retention, uncertain-write resumption,
expiry, field mitigation, shield distinction, attack reroll snapshots, token
identity and autonomous shot limits. Live scenarios are selected with
`companion upgrades:`. Observed results must be recorded after execution.

### Observed validation — 2026-10-30

The isolated complete suite passed **1,203 tests**, 32 suites, without failures
or skips. The focused rules/application/DataModel/content run passed 23 tests.
Lint, the existing type-checking pilot, architecture, native locale consistency,
system/E2E syntax and Git whitespace checks passed.

Three live scenarios passed on **Foundry 14 build 369**, Chromium
**153.0.8010.12**, system **0.2.0-alpha.1**, in disposable Data:

- Keyboard installation and activation from real EN/FR compendium Abilities,
  automatic armor donning, preserved Block damage through light/heavy changes,
  paid activation costs, day-limited capacity, reload and recovery expiry.
- Actual autonomous turret damage after Armor and field mitigation, repeated
  shot rejection, turret immobility and the shared PC defense consequences at
  the hindered NPC level.
- A separate owner-player session receiving the beast's native sight without
  beast ownership or saved sight changes; reload preserves the link and the
  owner's recovery removes the additional source without browser exceptions.

The installation scenario was rerun across all four EN/FR and light/dark
combinations on a 640 × 700 PC sheet. Its final rerun also observed an open
inventory changing from capacity 3 to 2 on the game-time update alone, before
any recovery or sheet reopening. Redirected-defense field snapshots, paid
activation resumption and lost action acknowledgements have deterministic
regression coverage; they are not additional live scenarios.

Each live runner passed all 15 compiled-pack checks and verified its isolated
package. Only paired locale bundles were compiled in the authoring checkout;
compendium sources, generated packs, distribution artifacts, compatibility
metadata and configured user worlds were unchanged. V13 was not tested live.
