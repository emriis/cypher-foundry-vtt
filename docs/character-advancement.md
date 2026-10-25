# Character advancement

## Authority and scope

The sole rule source is the supplied 2026-07-29 CRD, **Character Advancement**,
**Reaching a New Tier**, **Gaining Resource Points**, and **Advancement Beyond
Tier 6**. Current checked-in DOCX paragraph locators: 8085–8111, 8120–8122,
8172–8178. The inability/training cancellation is defined at paragraph 7440.
Source locators apply to `docs/Cypher-Reference-Document-2026-07-29.docx`.

This workflow buys advancement and grants source Items. It does not execute
all effects described by a granted Ability or implement spending resource points
on projects, crafting or repairs.

## Purchases and training

Each accepted advancement costs 4 XP. The four main categories can each be
purchased once per character tier. One **Other** choice may replace one main
category; the other three purchases must be distinct main categories. An
immutable purchase record prevents changing a bought slot's label from making
that category available again. Bought controls are readonly and preserve all
ArrayField subfields during ordinary sheet submission.

Increasing Capabilities allocates exactly four nonnegative integer points to
the three Pools. Perfection increases the chosen Edge. Extra Effort cannot be
bought at the six-level cap. Recovery, Armor and Weapons retain their respective
source-backed benefits. Other: Genre requires tier 3 or higher. Other: Focus
adds an eligible Ability from the current Focus; it does not replace the Focus.

Skill advancement cancels an inability to ordinary (`practiced`) proficiency,
trains an ordinary skill, or specializes training at tier 2 or higher. Combat
training requires tier 2; combat specialization requires tier 4. Authored
`minimumTier` and `minimumSpecializationTier`, attack categories, canonical
combat Skill identity and explicitly declared custom skill kinds are respected.
An ordinary advancement does not grant expert training. A new custom Skill
explicitly declares general/attack/defense applicability and, for category-based
weapon training, its attack category. Names and descriptions never decide this.

Resource points are awarded from the tier at which the purchase occurs:

| Purchasing character tier | Resource points per advancement |
| --- | ---: |
| 1–2 | 1 |
| 3–4 | 2 |
| 5 and higher | 3 |

The fourth purchase at tier 2 therefore still awards one point before reaching
tier 3. Tier is no longer capped at six; character tiers 7, 8, 9 and higher are
supported while Ability tiers remain 1–6 and the ordinary Effort score remains
capped at six.

## Ability choices and accepted no-banking policy

Paid Focus/Genre replacements require an eligible selected source before XP is
spent. Focus selection follows the actual Focus flowchart and previously selected
nodes. Source resolution occurs again at the mutation boundary. Granted category
permissions and any explicitly granted armor Item accompany the Ability.

On the fourth purchase, collect the new tier's free Focus choice and the free
Genre choice at tiers 3, 6, 9 and every subsequent multiple of three. Choose an
eligible Ability of the new tier or lower, never above Ability tier 6. A paid
choice made by that same fourth purchase participates in the preview, so the
free choice sees its newly unlocked branches and cannot duplicate its
nonrepeatable Genre grant. If all Focus options are exhausted, no nonexistent
Focus Ability is fabricated. Unspecified/real-world genres have no Genre list
in this workflow; a custom campaign explicitly chooses an applicable source genre.

**Accepted user adjudication:** choices cannot be banked. All required new-tier
choices are collected and validated before the fourth purchase commits. Closing
any selection cancels that entire purchase, with no XP, resource, Item or tier
change. The preceding three completed purchases remain intact.

Genre eligibility is a runtime projection of `data/crd-genre-abilities.json`;
a content contract checks canonical identity, minimum tier and genre parity.
The application maps the Actor's `sciFi` setting to the source's `science-fiction`
identifier. EN/FR compendium indices supply localized names and actual source
UUIDs. Canonical identity, not translated names, prevents repeat acquisition.
Unproven legacy/custom copies lacking source identity are not guessed from names.

## Persistence, compatibility and interrupted writes

`flags.cypher.advancementPurchases` records purchasing tier, slot and category.
`flags.cypher.advancementPending` checkpoints an operation involving embedded
Items. Missing flags mean no recorded history or interruption. Local actual-Actor
reservations reject overlapping purchases and preserve synthetic token identity.
They are not a cross-client database lock.

Actor-only purchases commit XP, advancement effects, resource gain and any tier
transition together. Embedded Skill/Ability/armor writes first persist the paid
checkpoint, then apply the Items, then finalize the Actor. An uncertain partial
failure retains the checkpoint and blocks replay after reload. Already committed
XP/Items are not rolled back from a stale snapshot. The GM explicitly reconciles
XP, Items, slots and tier, then acknowledges that reconciliation through the
sheet. Acknowledgement only clears the block; it does not refund or finish an
uncertain purchase automatically. Chat publication follows successful state
finalization; a failed chat write cannot buy the same slot a second time.

Old `focusAbilityPendingTier` flags remain one explicit legacy entitlement. They
must be settled before further advancement, using current-tier-or-lower
eligibility. No new pending entitlement is generated by tier advancement. No
historical Genre choices, resource deficits or purchase categories are inferred
from an existing tier. Old bought slots are used as the available legacy category
evidence; existing invalid purchases are not silently rewritten.

The only DataModel constraint change removes the PC tier's upper bound. The
field name/type/default/lower bound and stored values are unchanged; existing
worlds hydrate safely without a world migration. Ability, Focus, Type and
Community content tiers are unchanged. No compendium sources, generated packs
or user worlds need rewriting. Historical incorrect gains require explicit GM
review rather than an automatic retroactive credit.

Macro callers of `purchaseAdvancementSlot(index, options)` supply `abilityId`
for Other: Focus, `abilityUuid` for Other: Genre and any required
`weaponSkillCategory`. A fourth purchase supplies `tierChoices.focus` and/or
`tierChoices.genre` with those same source choices. Existing explicit tier
completion also requires four bought slots and the required source choices.
`selectFocusAbility` remains the compatibility facade for the legacy entitlement;
it no longer grants unlimited unearned Focus selections.

## Validation contracts

Deterministic and application tests cover tier thresholds, category uniqueness,
readonly purchase evidence, training restrictions, inability cancellation,
capability allocation, Focus graph edges, source permissions, canonical Genre
identity, paid/free grants, no banking, rejection before XP, synthetic identity,
repeated activation and interruption checkpoints. Real Foundry scenarios cover
EN/FR, both themes, 640×700 sheets, keyboard controls, cancellation, actual
compendium grants, ArrayField form preservation, tier 7 and reload persistence.
Observed results are recorded separately from these scenario definitions.

## Observed validation — recorded 2026-10-25

- Isolated normalized `npm test`: **1,031 passed**, no failures or skips.
- Scoped Foundry run: **5 passed** on Foundry **14.369.0**, Chromium
  **153.0.8010.12**. EN and FR each exercise light/dark themes at 640×700,
  keyboard controls, cancellation before fourth-purchase spending, actual
  compendium grants and reload persistence. Separate scenarios cover paid
  Focus/Genre choices, synthetic tier-7 progression and interrupted writes;
  the existing player vertical slice also passes.
- Isolated preparation: all **15** compiled-pack readability contracts,
  ZIP/manifest verification and runtime/E2E syntax checks pass.
- Lint, the explicit typecheck pilot, architecture dependencies and locale
  source/bundle consistency checks pass.

The live iteration caught a FormDataExtended grouping issue when disabled
selects shared names with hidden persisted values; disabled display controls
are now unnamed. The normalized suite also verifies exact canonical Genre
variant IDs rather than pre-normalization aliases. These fixes preserve bought
slots and distinguish same-key Type/Genre definitions.

This is scoped Foundry 14 coverage. Foundry 13 and the full E2E suite were not
rerun; no compatibility declaration was changed. Validation used disposable
checkout/Data directories and left authored compendium sources, generated
packs, distribution artifacts and the user's worlds unchanged.
