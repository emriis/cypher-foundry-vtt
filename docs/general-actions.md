# Cooperation, guarding and special damage

Authority: the supplied **2026-07-29 CRD**, sections **Cooperative Actions**
(reviewed paragraphs 7956–7962), **Guarding** (7965–7969), **Special Damage**
(7815–7823) and **Modifying Attack and Defense** (7825–7879).
The private reference remains under `docs/local/`; it is not distributed.

## Player workflow

PC and NPC sheets expose a shared general-action panel. Conditions and guarding
are explicit declarations. PCs can target one actual token to declare cooperation
or resolve a complementary task, a determined foe's draw, a guard intervention,
or the Speed task needed to pass an NPC guard. Fictional applicability and
positioning remain explicit; no token-distance or localized-name inference runs.

| Declaration | Executed behavior |
| --- | --- |
| Help | One asset, two with positive applicable training, none with inability. The beneficiary selects applicable help in the task dialog. Only selected one-task help is consumed. Several helpers share the normal two-asset cap. |
| Complementary task | Success grants one task asset, including success on a paid reroll. |
| Defense help | One asset on all selected defenses until the helper's actual next turn. It is not consumed by the first defense. |
| Distraction | One step against the distracted NPC's attacks for the declared interval; several distractions never add more than one step. |
| Draw | Redirect the NPC's next selected attack to the actual source Actor. A determined foe requires an Intellect task; success also hinders that defender by two steps. Two simultaneous draws cancel. |
| Take | If the original defense leaves a hit, transfer the complete attack and an additional minor wound to the selected interceptor. This also covers a successful Block that still leaves a wound, including shield overflow. The interceptor cannot repeat it before their next turn. |
| Guard | All defenses are eased; attacks are refused. An eased Speed intervention can prevent the declared NPC action, consuming that NPC action when attempted. Passing an NPC guard requires a hindered Speed task. |

The user adjudication is **one cooperative mode per task or attack**: Help,
Distraction, Draw and Take cannot combine on the same resolution. Defense help
belongs to Help. The NPC attack dialog offers one mode and explicit interception
and drawn-shield choices. No cooperation mode is silently selected.

## Conditions and declared threats

* Dazed hinders all tasks and eases attacks against the affected NPC.
* Stunned prevents tasks other than defenses. The tracker can still be advanced
  normally; this does not automatically skip all stunned combatants.
* Paralysis prevents actions requiring movement. A caller can explicitly declare
  an action requiring no physical movement. Paralysis and unconsciousness make
  incoming physical attacks automatic hits, without dice or a paid reroll.
* Blindness supplies the CRD's two-step modifier for attacks against that target.
* Prone supplies opposite melee/ranged modifiers only when the attack form is
  explicitly supplied. Weapon category, chosen Pool and coordinates do not
  determine attack form.
* A declared general hindrance carries an explicit number of steps.

Conditions can end manually or at the affected source's next turn. The CRD's
"usually about one round" for dazed does not impose a universal duration on all
sources. Other unusual effects and sensory circumstances require adjudication;
there is no automatic hallucination, gravity, drowning or disease-severity rule.
These general effects are displayed on sheets; unrelated core token-status icons
are not treated as an alternative rules store.

Special-damage controls accept a complete declared profile: difficulty, wounds,
Pool damage and optional condition. Poison and disease use Might defense;
psychic attacks use Intellect defense. These stat defenses do not apply Block or
Dodge armor modifiers. Wounds and Pool loss can apply together on a failure.
The profile's conditions have explicit/manual duration unless the API caller
supplies a declared interval. No universal poison or disease damage is invented.

An ongoing disease can save its profile for daily checks. A repeat requires
24 hours of advanced game time or explicit confirmation that a day passed.
The next reminder advances after an accepted check; no unattended defense dice
are rolled. Ongoing infection is an explicit declaration independent of whether
one particular daily defense succeeds, and the GM ends it when appropriate.

Damage requiring specialized treatment must be explicitly marked. Its actual
added wound tiers and actual Pool loss are protected from ordinary recovery,
Rally, treatment, healing and direct sheet restoration. Other wounds and Pool
loss can still heal. Completing appropriate specialized treatment explicitly
ends that restriction; it permits subsequent healing, without itself restoring
damage. Specialized Ability activation is outside this general-rule workflow.

## Persistence and rerolls

`flags.cypher.generalEffects` stores declarations with stable effect IDs and
actual source UUIDs. Missing flags are an empty list; no schema migration is
needed. Read-only preparation filters expired intervals without document writes.

Next-turn intervals capture a Combatant identity and a persisted turn revision.
`preUpdateCombat` increments the entered Combatant's revision in the same
forward-turn update. Initiative reordering and rewinds do not consume a turn.
Deleting or leaving that encounter expires its scoped intervals. Outside combat,
narrative intervals and interception cooldowns require explicit completion.
Existing weapon-effect duration contracts remain independent.

The original task card remains authoritative after reload and repeated rerolls:

* Complementary help, a determined Draw and a guard intervention apply once on
  success, using their original interval. A later reroll cannot prevent an NPC
  action after that NPC's recorded action revision has already advanced.
* Defense history identifies the actual damage recipient. Correcting a Dodge
  can remove an interceptor's attributed wounds and cooldown while preserving
  subsequent injuries. A retained Block that still leaves a hit preserves the
  interception without applying it twice.
* Poison/disease/psychic history records wounds, Pool loss and effect IDs.
  A successful reroll removes that contribution, including its treatment
  restriction, rather than healing arbitrary wounds or clearing unrelated states.
* Original Pool expenditure is retained. The existing natural-20 exception and
  XP rules remain unchanged.

Local action reservations cover the actual source, NPC and recipient, including
synthetic Actors. They are not cross-client locks or a multi-document database
transaction. Before a reroll mutates consequences, its origin card records a
pending checkpoint. Partial writes or lost damage attribution require explicit
GM reconciliation instead of replaying an uncertain correction.

The focused deterministic contracts are `general-effects.test.mjs` and
`general-actions.test.mjs`; `foundry-general-actions.spec.mjs` owns live UI,
reload, synthetic interception and source-turn/specialist-damage verification.

## Macro entry points

The Actor facade exposes `declareCooperation`, `rollCooperativeAction`,
`passGuard`, `setGuarding`, `setGeneralCondition`, `removeGeneralEffect`,
`resistSpecialDamage` and `repeatDiseaseExposure`. Task callers can select
`cooperativeMode: "help"` with `cooperativeEffectIds`; omitting the IDs explicitly
accepts all currently declared applicable help. NPC attacks accept one mode plus
the actual `takeAttackActor`, `physicalAttack` and explicit `attackForm` context.
