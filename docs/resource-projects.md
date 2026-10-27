# Resource-point projects

## Source contract

The supplied CRD (2026-07-29) is authoritative: **Crafting, Building, and
Repairing** (paragraphs 7963–7964), **Resource Points**, **Goals and Activities**,
**Spending Time** and **NPC Crafting** (8117–8171). Resource points synthesize
available time, materials, money and circumstances; they are not a new equipment
inventory or an invented monetary exchange rate.

The existing `system.resourcePoints` balance and advancement rewards are
preserved. Purchases still grant 1 point at tiers 1–2, 2 at tiers 3–4 and 3 from
tier 5. The project workflow adds spending and receipted GM awards/corrections;
it does not alter XP, character advancement or Ability-specific resource grants.

Points are spent **after the required work time**, generally without a roll.
Proposing or starting a project reserves and spends nothing. When ready, the GM
confirms that the work was actually performed, rechecks current prerequisites
and balances, then completes the payment and result. An elapsed world clock
alone never pays for a project or proves the required work took place.

## Activities

| Activity | Cost and requirements |
| --- | --- |
| Rest / carouse | 0 points; narrative record, not an automatic Pool recovery. |
| Craft manifest cypher | Low: 2 points/trained; medium: 3/specialized; advanced: 4/expert. Requires an actual manifest Item template and genre-appropriate crafting. Higher power is not available from this table. |
| Craft ordinary object | 1 point, trained, up to level 4. Higher level or technology requires specialization and an explicit higher cost of at least 2. Excludes cyphers/artifacts. |
| Repair object | 1 point, trained, original level up to 4; actual Object target must be damaged or broken. |
| Make contact | Level 3/5/7 costs 1/2/3 points. No invented NPC stat block is generated. |
| Make investment | 1 point and explicit confirmation of at least an expensive fictional investment; dividends are adjudicated. |
| Research | Information levels 1–3/4–5/6–7 cost 1/2/3 points. Higher information levels are not sold by this table. |
| Restore follower | Half the actual NPC follower level, minimum 1, rounded upward. Default duration one week; a different duration requires an identified source. |
| Befriend | Twice the friend level, maximum level 7. Explicit GM declaration of harm to a resource-point friend doubles later costs. Narrative relationships remain adjudicated. |
| Craft artifact | At least 5 points, specialized/expert, up to level 5; an actual artifact template and GM-approved benefit/details are required. |
| Other goal | Explicit positive cost, duration and agreed outcome; no inferred universal cost table. |

Accepted user adjudications: odd follower levels round upward (level 3 costs 2);
ordinary repair cannot restore a destroyed Object. Recreating one is a new
crafting project producing a separate result; the destroyed Actor is retained.

The chosen owned crafting Skill must have the required training, and its
applicability is explicitly confirmed. Names and descriptions never establish
qualification. A commissioned actual NPC can provide declared crafting expertise
instead; the resource-point cost and time remain the same. Any necessary social
interaction with the NPC is adjudicated through the usual task workflow.

## Sheet and macro workflow

The PC sheet's **Projects and resources** section offers:

1. Propose an activity, time, appropriate Skill or commissioned NPC, result
   details and optional contributions. Where applicable, select an actual target
   or imported Item template. World Items and the PC inventory supply template
   choices; macros can also use a compendium Item UUID.
2. The elected active GM reviews the calculated cost, time and resolved
   contributor names/amounts, target, source and qualification, confirms the
   fictional prerequisites and everyone's consent, then starts the project.
3. After the required world time, confirm actual work and complete the project.
   Changes to the Skill, target, source power or available points can reject
   completion before payment. Cancel a proposed/active project without payment.

Contributions reduce the principal PC's share of **one total cost**. Participants
do not each pay that full cost. Shared benefits are recorded; a singular crafted
object is not duplicated for helpers. The GM settles all actual participant
Actors, including synthetic Actors, without requiring a player client to write
another player's balance.

Use the GM award/correction control for an additional award or a documented
balance adjustment. Each accepted request has a receipt ID. The existing raw
balance field remains a manual editing surface; old/manual changes are not
retroactively invented as transaction history.

The public entry points are under `game.cypher.projects`:
`createProject`, `projectReview`, `approveProject`, `completeProject`,
`cancelProject`, `resumeProject`, `reconcileProject`, `adjustResourcePoints` and
`setBefriendPenalty`. Mutations other than proposals/cancellation require the
elected active GM. A source-aware macro proposal can use:

```js
const id = await game.cypher.projects.createProject(pc, {
  kind: "repairObject", label: "Repair the window", durationSeconds: 3600,
  targetUuid: objectActor.uuid, skillItemId: craftingSkill.id,
  genreConfirmed: true, skillAppropriate: true
});
```

## Applied results and boundaries

Repair clears the actual Object's level/destruction damage; its revision changes
normally, invalidating stale attack-reroll attribution. Restore Follower restores
the actual NPC's numeric Health to maximum. Linked follower availability is restored after successful completion. Actual
links, progression and replacement now have their own
[follower contract](followers-and-benefits.md); unlinked historical followers
retain explicit GM confirmation. Known other-owner, obsolete or unsynchronized
links reject before payment. Source-specific powers and narrative circumstances
still require explicit adjudication.

Crafting copies the selected template's mechanics and complete description into
one new owned Item, with quantity one, unequipped and not depleted where those
fields apply. A known numeric template level overrides a cheaper declared level.
A crafted cypher is fixed at the paid power and a specific matching variant;
it retains no random variant table that could grant a higher power. This does
not automate its descriptive power effect. A crafted artifact keeps its template
benefit; no new benefit is invented from prose.

Ordinary crafting without a template creates an Object Actor at the declared
level/material, inheriting the PC's ownership. A result UUID is saved. Existing
inventory objects are not silently converted to Object Actors. Higher-level
repairs, special shield/Ability repair exceptions, quick crafting powers,
restricted bonus resource points and broad crafting-power effects remain
separate source contracts. Narrative contacts, research, friendship and
investment outcomes have durable project records rather than invented effects.

## Persistence, concurrency and failure

Version-1 `flags.cypher.projects` records store proposals, approval, deadlines,
state and settlement. `flags.cypher.resourcePointReceipts` records actual debits
and GM adjustments. `flags.cypher.befriendPenalty` records the explicit GM
declaration. These new optional workflow flags preserve old Actor/Item schemas
and balances; no world migration or compendium source rewrite is required.

All resource owners are validated before the first debit. A debit and its
receipt share one Actor write. A failed later contribution leaves a frozen
settlement: **Resume interrupted payment** skips participants with committed
receipts. It does not charge them twice or refund already committed work.

The result has a pending checkpoint before creation/repair. If that write is
uncertain, resumption requires explicit GM reconciliation instead of risking
duplicate Items or overwriting later target damage. The reconciliation control
requires a note and records the GM's external correction of resources and result;
it does not itself debit, refund, create or repair. This also handles missing
targets or other blocked settlements. Chat publication follows completion;
publication failure cannot turn a completed project into a second payable one.

Client-local guards reject overlapping actions. One elected active GM settles
currency across clients; Foundry document writes remain separate operations,
not a distributed transaction. Manual edits outside the workflow still require
ordinary GM adjudication.

## Validation scope

Focused pure/application regressions cover source costs, qualification, timing,
late invalidation, collaboration, synthetic targets, replay protection and
interrupted writes. Scoped `projects:` Foundry scenarios exercise EN/FR and both
themes, keyboard sheet actions, world-time refresh, reload, actual compendium
crafting, new Objects, followers and receipt-based resumption. Record observed
validation separately from the existence of those tests. Compatibility metadata
is unchanged; no V13 live result is implied.

### Observed validation — 2026-10-26

The isolated `npm test` run passed all 1,096 tests with no skips, including 25
focused project rule/application regressions. Lint, the existing type-checking
pilot, architecture dependencies and native locale consistency passed.

All four scoped `projects:` E2E scenarios passed on Foundry 14 build 369,
Chromium 153.0.8010.12 and system 0.2.0-alpha.1 in disposable Data. They covered
EN/FR and light/dark at a 640 × 700 PC sheet size, keyboard proposal/approval/
completion, work-time refresh and reload, receipted collaboration resumption,
real compendium cypher copying, uncertain-output reconciliation, new Object
results and synthetic follower restoration without changing the base Actor.
The runner built, extracted and verified the package in its own temporary
checkout. No packs, distribution artifacts, installation settings or user worlds
were changed in the working checkout or configured Foundry installation.

### Common cypher inventory integration

Cypher crafting can be approved while inventory is full, but completion and
resumption require a free carried slot before any new resource debit. The
native Item batch hook also checks the eventual result. Rejected creation leaves
an uncertain-output checkpoint rather than a completed project; inspect and
reconcile it explicitly. See [common cypher lifecycle](cypher-lifecycle.md).
