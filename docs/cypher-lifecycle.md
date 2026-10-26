# Common cypher lifecycle

## Authority and scope

The supplied **Cypher Reference Document 2026-07-29**, sections **Cyphers**,
**Cypher Limit**, **Using Cyphers**, **Manifest Cyphers**, their random power
and generation tables, and **Power Boost Cyphers**, is the mechanical authority.
Paragraph locators in the locally supplied DOCX are 5964–5988, 6534–6548,
tables 5992–6254 and 6568–6907, and 7331–7358. Private references remain private.

This lot implements acquisition, carried capacity, form, custody, timing and
one-use consumption. Particular effects, attacks against unwilling targets,
assets, damage, Pool changes, duration and recovery-bound effects still require
individual source-backed implementations. A chat card is not power execution.
Resting never silently awards new cyphers: the GM chooses whether to offer them.

## Acquisition and exact generation

The PC dashboard offers **Generate** and **Award a cypher** to the elected
active GM. Choose the content language explicitly. Interface language does not
rewrite existing world content. The final preview is cancellable; only acceptance
creates an embedded copy. The source remains unchanged and unspent.

`data/crd-cypher-generation.json` records CRD d100 rows and paragraph provenance.
`module/rules/cypher-generation-catalogue.mjs` is its browser mirror, checked for
exact equality, complete non-overlapping ranges and real canonical source IDs.
Generation selects canonical identities, never localized names or prose.

Manifest generation draws power first: 1–45 low, 46–80 medium, 81–92 advanced,
93–98 high, 99–100 ultra. It then draws within that power table. Printed 00 is
100. The optional superhero table requires the explicit campaign choice;
37–100 redirects to the ordinary subtle table rather than granting a boost.

**Accepted adjudication:** when a power table selects Teleporter, fix the variant
matching that power (medium/Bounder, advanced/Traveler, high/Planetary,
ultra/Interstellar). Do not reroll its variant. Runtime selects the structured
power enum and keeps the actual source variant's display name, including French.
A manually awarded multi-power source also selects its power in the preview.
Legacy unresolved inventory variants retain the existing activation-time d100.

Power Boost form is an explicit GM choice: subtle or manifest. Its source does
not assign a numeric effect level; acquisition preserves that absence. Ordinary
source effect levels are preserved separately from manifest power categories.

## Inventory and actions

Only carried, unspent cyphers count, combining subtle and manifest forms.
No automatic purge corrects existing over-limit worlds. New acquisitions and
retrieval must fit; reducing an old over-limit inventory remains possible.

- A subtle activation is instant, including outside the character's turn; it
  does not consume the ordinary action.
- A manifest activation uses the ordinary action in managed round flow.
- Discard one or more selected cyphers as **one action** without activating them.
- Native trash deletion of live carried cyphers also checks the discard action,
  including batch deletion. Deleting historical/spent/stashed entries does not.
- Only manifest cyphers can be hidden or physically transferred. Hiding requires
  a declared location. Retrieval checks capacity again. No distance, adjacency,
  extra action cost or automatic time progression is inferred.
- Transfers require ownership of both actual Actors. A targeted unlinked token
  remains the actual destination; its base Actor is not substituted. A GM can
  mediate a transfer between players lacking access to each other's Actors.

The final Item creation/update operation hooks check aggregate capacity for
native drops, imports and macros. Actor creation checks inline starting inventory.
World source Items have no carried limit. Existing worlds load without migration.
See the official [V13 Item API](https://foundryvtt.com/api/v13/classes/foundry.documents.Item.html)
and [V14 Item API](https://foundryvtt.com/api/classes/foundry.documents.Item.html)
for `_preCreateOperation`, `_preUpdateOperation` and `_preDeleteOperation`.

Crafting may start at a full limit. Completion/retry checks space **before any
resource debit**, and a rejected embedded result cannot be marked completed.

## Persistence and partial failures

Optional `flags.cypher.custody` is absent/`carried`, `stashed`, `discarded`,
`transferring` or `transferred`. Location and transfer destination/result UUIDs
record explicit custody. Unknown custody counts conservatively but cannot activate.
Pending transfers continue to count at the source until inspected.

Awards store version-1 receipts under `flags.cypher.acquisitions.<requestId>`:
`pending`, `manual`, `applied`. The profile includes source UUID, power and form;
reusing an ID for another profile is rejected. Applied IDs never copy twice.
A pending creation cannot be retried blindly after reload. The GM inspects and
corrects inventories externally, then records a required reconciliation note.
The sheet exposes interrupted awards/transfers; reconciliation itself does not
create, delete or consume an Item. Transfer source history is retained.

Actual owner/Item reservations reject competing operations on the same client.
They are not distributed locks. The elected GM restricts awards to one active GM identity;
Foundry provides no multi-document database transaction. Remote concurrent edits
and interrupted transfers still need explicit GM inspection. An action committed
before a failed write stays recorded; no stale snapshot rollback overwrites later
changes. Chat publication follows depletion/award; chat failure never permits a
second use or award.

Public macro entrypoints live under `game.cypher.cyphers`; application services
own mutations and deterministic table/capacity rules live under `module/rules`.

## Validation

Focused rules, lifecycle, catalogue and project regression tests cover weighted
boundaries, stable source resolution, Teleporter fixation, capacity batches,
instant/action timing, cancellation, synthetic transfer identity, interrupted
writes, replay and reload. `foundry-cyphers.spec.mjs` exercises actual native
operation hooks, EN/FR dashboards in both themes, persistence and generated
compendium copies. Live results are recorded separately after execution.

### Observed validation — 2026-10-26

The isolated full suite passed **1,116 tests**, with no failures or skips.
Lint, the existing type-checking pilot, architecture dependencies, E2E syntax,
native locale consistency and Git whitespace checks passed. The final French
form label uses the existing UI term “Discret”; locale bundles were rebuilt and
checked after that wording adjustment.

All **six** scoped `cyphers:` scenarios passed on Foundry **14 build 369**,
Chromium **153.0.8010.12**, system **0.2.0-alpha.1**, using disposable Data:

- EN/FR, light/dark dashboards at 640 × 700, keyboard stash/retrieve/use/discard,
  non-overflowing rows and persistence after reload;
- real native aggregate creation/update hooks and inline Actor import rejection;
- French-compendium Teleporter power fixation, source preservation and one award;
- optional superhero preview cancellation and explicit Power Boost form selection;
- real managed-combat timing, rejected repeat activation and grouped native deletion;
- interrupted physical transfer, reload, explicit correction and successful
  synthetic destination creation while leaving the base Actor unchanged.

The runner built, extracted and validated the package in isolation, including
all 15 pack-readability checks. Existing pack sources, generated databases,
distribution artifacts, desktop settings and user worlds were untouched in the
working checkout/configured installation. Only native EN/FR UI bundles were
intentionally regenerated here. Compatibility metadata is unchanged; V13 has
not been tested live in this lot. Particular power effects remain outside scope.
