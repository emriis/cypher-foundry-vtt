# Task rolls, Effort, and Edge

Rule authority: the supplied `Cypher-Reference-Document-2026-07-29.docx`, read in
place under the private reference library. Source locators:

| Behavior | CRD section |
| --- | --- |
| Skills, two-asset cap, paid Effort, Edge, and ordinary free levels | Rules of the Game > Easing Tasks |
| Natural results, damage/effect choices, and Pool refunds | Rules of the Game > Special Rolls |
| Independent costs and Effort limits for extra actions | Rules of the Game > Actions; Easing Tasks > Effort |
| Permanent bonuses and special shift categories | Superheroes Genre > Power Shifts |
| Chosen Pool, rank, and wound-funded levels | Superheroes Genre > Superheroics; Really Impossible Tasks |
| Two damage points per area-attack Effort level | Rules of the Game > Area Attacks |

## Reading the calculation

`task-preparation.mjs` reads actual Actor state and rejects invalid input before
writes. `task-effort.mjs` allocates paid/free levels; `tasks.mjs` combines task
steps; `task-outcome.mjs` resolves the die. `task-service.mjs` pays accepted costs,
applies consequences and publishes chat. `item-service.mjs` translates weapon
familiarity and matching training once into this shared contract. A matching
weapon skill is already included in proficiency and is not added again as a
generic skill. Only the light weapon's separate easing remains additional.

Paid `effortLevels` ease the task. Paid `damageEffortLevels` add three damage per
level on a hit; both share the character's Effort score and one cost calculation:
three Pool points for the first paid level, two for each additional level, minus
Edge once, with a minimum of zero. Damage Effort does not also ease the task.
An explicit `areaAttack` context changes the damage increment to two. Spray and
Arc Spray resolve distinct attacks/actions and do not automatically use that
area-attack rate.

Skills contribute at most three easing steps and assets at most two. Independent
rule/circumstance modifiers are separate from assets. Wounds and unfamiliar
armor hinder tasks; Dodge already incorporates its armor modifier, so it does
not receive the same Speed penalty twice. Numeric inputs must be finite whole
numbers. Legacy easing-only Effort and asset requests retain clamping; invalid
split allocations are rejected rather than reassigned silently.

## Three different free-level contracts

| Grant | Uses the character's Effort score? | Uses the ordinary six-level ceiling? |
| --- | --- | --- |
| Ordinary free Effort from an applicable ability | No | Yes, together with paid levels |
| Two levels from taking a Superheroics wound | Yes, within the chosen Pool's raised limit | Within the limit raised by rank |
| Applicable permanent Power Shifts | No | No; tracked separately |

Ordinary `freeEffortLevels` and `freeDamageEffortLevels` require a declared
`freeEffortSource`. This is an explicit applicability confirmation, not automatic
parsing of names or descriptions. The caller/player/GM must verify the source's
conditions, remaining uses, and any requirement to apply paid Effort. This
generic interface does not implement every ability's cooldown, once-per-round
limit, optional minor effect, or a Cypher's after-roll grant. Never claim otherwise
when adding automation: each such source needs its own reviewed service and tests.

An owned Ability with stable key `superheroics` and the persisted choice
`flags.cypher.superheroicsStat` raises that Pool's score and global ceiling by
rank. An absent choice grants no exception; existing worlds remain unchanged
until the player selects their CRD-granted Pool. The `push` choice grants two
free easing levels and costs a real moderate wound, with normal overflow and
capacity rules. Its wound and Pool cost commit together before dice; the resulting
wound hindrance is included. A natural twenty refunds Pool points, not this wound.
For an attack, the player can allocate zero, one or both pushed levels to damage;
the remaining pushed levels ease the task.

Accuracy and Block/Dodge Power Shifts apply automatically to their known task
contexts. Other supported categories require a declaration in the conditional
modifiers controls: Dexterity, Intelligence, Resilience, Strength, Savant, Single
Attack, and Power. Confirm Strength's melee/thrown damage context, Savant's two
selected skills, Single Attack's chosen attack, and Power's chosen ability.
Power never eases attack rolls. Duplicate declarations do not duplicate bonuses.
Special categories such as Flight and Prodigy do not become generic free Effort.
Healing's extra recovery is handled by the separate recovery service.

## Costs precede each action

Before an action can start, its actual Pool must cover that action's cost after
Edge. Rejection changes no Pool, rolls no die and changes no target. Ability
activation and the first attack share Edge when using the same Pool; subsequent
attacks are new actions with fresh Edge and their own Effort costs.

Arc Spray does not reserve or require the sum of hypothetical later costs. It
checks the first action including activation, then checks the current Pool
immediately before each later attack. If a later action is unaffordable, the
sequence stops and returns `completed: false` with only completed results.
Earlier costs, ammunition and target damage remain persisted. A natural twenty
can refund points that make the next action affordable. Writes to different
documents remain sequential, not an atomic cross-document transaction.

The sheet collects fresh choices before each extra attack. Dismissing a later
dialog stops the sequence without costs or dice for that new action. The service's
optional `chooseAttackOptions` callback provides the same boundary for macros.
Without that callback, legacy macros reuse paid choices but apply a declared
ordinary free grant or pushed wound only to the first action. A conditional grant
must be confirmed again for a later action; one checkbox never accepts three wounds.

Generic Ability-effect activation also receives Edge, including active Edge
bonuses, before its Pool cost is validated. Source-specific Ability services
remain responsible for bundling activation and task costs when they share an
action; separate clicks must not be treated as one action automatically.

## Routine and special results

The player can leave **Roll the die even if this task becomes routine** checked,
or decline dice if the final difficulty is zero. An automatic routine success
still pays accepted Effort and applies attack/healing consequences. It has no
natural result, special effect, cost refund or paid-reroll button. Nonroutine
tasks always roll regardless of that checkbox. Existing macros default to dice.

On a successful damaging attack, natural 19/20 offers extra damage or a minor/
major effect before target damage is persisted. If that post-roll choice is
dismissed, the accepted action uses extra damage; it does not cancel or roll again.
A natural twenty refunds paid Pool points even if a remaining target number
above twenty makes the task fail. Failure still causes no attack damage or
minor/major effect. Refunds add paid points to current Pool state rather than
restoring an old snapshot. See [runtime-refactor.md](runtime-refactor.md) for
paid-reroll persistence and [attack-rerolls.md](attack-rerolls.md) for recorded
target damage, special choices, original effect intervals and partial-write limits.

## New attempts after failure

A new ordinary attempt is distinct from a paid XP reroll: it applies at least
one paid Effort level, consumes a fresh action, keeps the original expenses and
records explicit same-task/time confirmation. See [task retries](task-retries.md)
for GM veto, lineage, retained-result and interrupted-write boundaries.

## Maintaining the contract

Use deterministic Given/When/Then regressions at the pure and application layers.
Exercise the real weapon-to-task pipeline to detect modifier double counting,
not only a stub that captures options. Cover accepted split costs, malformed
input, source-specific free limits, rejection before dice/writes, partial attack
sequences, and reload persistence. Real Foundry tests must exercise the controls
and structured chat metadata. Keep comments, both locales, and these contracts
current whenever a modifier or source-specific service changes.
