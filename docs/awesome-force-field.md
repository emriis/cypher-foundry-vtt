# Awesome Force Field

This contract implements the personal field and remote-barrier option of
Awesome Force Field, not the Force Field cypher's own activation lifecycle.
Entry points are available on the PC protection panel and through
`game.cypher.forceFields`. Services keep rule calculations, Foundry persistence
and sheet declarations separate.

## Authority and decisions

The supplied 2026-07-29 CRD is the sole source:

- Superheroes Genre / Origin Superhero Abilities, Awesome Force Field,
  paragraphs 3363–3365: personal Intellect Block, optional five-point shatter,
  next-turn return and escalating dedicated Effort for remote level-six fields.
- Cyphers / Manifest Cyphers / Manifest Cypher Descriptions, Force Field,
  paragraphs 7017–7019: shape, range, dimensions, obstruction, gas and individual
  Intellect containment attacks. Awesome's ten-minute recovery duration
  overrides the cypher's one-hour duration.
- Objects and materials: the existing two-stage Object damage contract is
  reused under the accepted nonphysical-barrier adjudication.

Reviewed passage evidence is in `data/crd-awesome-force-field.json`.
The existing canonical genre Ability and cypher descriptions are preserved.

Accepted adjudications:

- One incoming wound per defense roll. Only an explicitly selected Awesome
  Intellect Block can offer shattering, after success leaves a residual wound.
- Remote barriers are nonphysical Object Actors with original level 6, level
  damage and post-break destruction damage. They are not physical materials.
- The GM declares shape, placement, initial occupants and whether an action
  crosses a barrier. No token coordinates establish geometry or adjacency.

## Personal defense and costs

Initial activation costs no Pool points but consumes an ordinary action.
Dead/incapacitated owners cannot activate it. Recasting cannot bypass the
shattered interval. The field expires at the owner's ten-minute or longer
recovery, using the existing recovery epochs; reloading does not renew it.

The defense chooser explicitly selects physical Block, Mage Armor or Awesome.
Intellect Block easing deduplicates equal bonuses from these Ability sources;
different magnitudes combine according to the accepted general policy.
Ordinary Block wound reduction and physical Armor modifiers remain applicable.
A shield selected to absorb the wound follows its existing separate track.

Shattering is offered after dice, when the personal residual wound exists.
Closing the choice keeps that wound. The five-point cost uses only the Edge
left after defense Effort. A retained natural 20 cancels action costs, including
shattering. The Pool payment, field deadline and unique receipt share one Actor
write; original-card metadata records the actual additional spending.

Managed combat uses the source combatant's next actual turn revision, not a
round estimate or initiative ordering. Outside the original combat, the GM
confirms the next narrative turn. Missing Combat state does not restore the
field automatically. Open sheets refresh at combat boundaries.

Failed-defense rerolls use the existing wound contribution/revision contract.
They can offer shattering after a successful retained Block, remove only the
recorded injury and preserve later wounds. Unsafe attribution requires manual
reconciliation before any new shatter payment. Ordinary rerolls keep spending;
the retained-20 exception refunds the original action's recorded cost once.
An already-successful Block can also cancel its still-attributable residual
with a later shatter, including a free shatter on a retained 20.

## Remote barriers and containment

Remote creation is settled by the elected GM. The personal field never counts
toward remote capacity. Creating another barrier requires one plus the number
of currently intact, active remote fields in dedicated Effort levels. Existing
Effort score, Superheroics and Intellect Edge rules apply. Missing range or
placement declarations, insufficient resources and stale permissions reject
before payment. Wall/path shapes cannot declare enclosed creatures.

Creation first persists its payment and pending identity, then creates the
Object and acknowledges its UUID. Resume searches the original identity before
creating anything, retaining damage, payment and expiry even after reload or
source Item removal. Abandon/end retains spending and historical documents.

For each initially declared living NPC in a cube/sphere, the GM starts one
non-damaging Intellect attack. Synthetic NPC identity is preserved. In managed
combat this must remain in the original creation step; outside combat the GM
confirms the same action. The first declared target reserves the creation's
Effort levels and already-used Edge, charging only additional levels at their
incremental cost. Further targets have separate attack allocations. A retained
20 on that first attack refunds the creation payment once as well as the
attack's own cost. Extra attack damage never damages the captive.

Each target is checkpointed with costs before dice. Successful attacks write
an NPC receipt and acknowledge the source entry. A paid reroll can upgrade a
miss against the original still-active barrier; it cannot create a new field
or bind a creature whose departure was recorded. Interrupted unknown outcomes
require the GM's observed-result control and a note, without automatic dice or
payment replay. This is not paralysis or unconsciousness: a captive can act
inside the volume.

An intact active field rejects explicitly declared crossings before costs;
attacking the barrier itself remains possible through Object attacks. Current
level provides protection/resistance. Breaking removes obstruction; destruction
requires subsequent damage under the existing Object rule. Breaking, ending
or recovery expiration also disables containment. The GM can record a departure
explicitly so later damage corrections cannot put a creature back inside.
Generated barriers cannot use authoring reset or resource-project repair.
Expired Object Actors remain historical but reject fresh attacks/damage.

## Explicit boundaries

The system creates no native Walls or collision geometry. Dimensions, passages,
line of effect, gas and presentation remain GM declarations. There is no
invented suffocation timer. NPC containment has the shared task contract;
opposed PC containment remains GM adjudication. The Force Field cypher's own
activation, Ice Armor/Improved Ice Armor and Electric Armor remain later lots.
Client-local reservations are not cross-client locks; elected-GM settlement
serializes barrier authoring, and partial writes remain visible for review.

## Validation

On 2026-11-03, isolated `npm test` passed **1,280 tests**, with no failures or
skips. Lint, the explicit rule type-check pilot, architecture, locale and syntax
checks passed. Focused rules, application and source tests cover cost sharing, shattering,
retained results, attribution loss, deadlines, creation resumes, nonphysical
destruction, synthetic containment and declared crossings.

All **seven** scoped live scenarios passed together on **Foundry 14 build 370**,
Chromium **153.0.8010.12**, system **0.2.0-alpha.1**, in disposable Data:

- Four Awesome scenarios: actual EN/FR source imports, light/dark themes at
  640 × 700, keyboard/mouse activation and selected Intellect Block, shattering
  and reload; declared cube creation and synthetic containment, unchanged base
  Actor/Health, native Object damage, breaking, later destruction and recovery
  expiration; attributed defense rerolls and once-only 20 refunds, including a
  previously successful Block newly cancelling its residual wound.
- Three existing protective-foundation scenarios passed as regressions,
  including separate recipient recovery, source-removal resume and original
  protection snapshots after expiration.

The runner also normalized and built the bilingual packs, validated all 15
compiled-pack contracts and verified the installed archive in its temporary
checkout. No V13 live result is claimed and compatibility metadata is unchanged.
Authoring changes cover rule/application integrations, sheet controls/templates,
paired locale sources and their intentionally compiled native bundles, reviewed
evidence, audit coverage, tests and roadmap documentation. Compendium sources,
generated databases, distribution artifacts and the manifest are unchanged in
the authoring checkout. The configured user world and installation were not
modified; the isolated server used a separate port from the existing instance.
