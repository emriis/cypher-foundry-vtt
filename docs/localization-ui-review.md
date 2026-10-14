# UI localization review

This review covers the system's interface strings, not the completeness of
compendium translations. UI copy describes the implemented control or result;
English CRD-derived descriptions must retain the supplied CRD wording, and
French descriptions must preserve every condition, limit and consequence.

## Editorial glossary

The following French wording is the current editorial proposal. Confirmed
user decisions take precedence over these proposed defaults.

| English | French | Meaning and boundaries |
| --- | --- | --- |
| Tier | Rang | Ordinary character progression, separate from superhero Rank. |
| Rank | Degré de puissance | Superhero Type progression; the displayed label names the Type explicitly. |
| Effort | Effort | Levels and paid Pool points remain distinct quantities. |
| Edge | Avantage | The user's accepted term; not a die-roll advantage mechanic. |
| Pool | Réserve | Existing points in a stat Pool; choosing a Pool does not grant another Pool. |
| Might / Speed / Intellect | Puissance / Célérité / Intellect | Stable stat identifiers remain `might`, `speed`, and `intellect`. |
| Power (power shift category) | Pouvoir | Distinct from the Might stat, translated as Puissance. |
| Step | Pas | Difficulty adjustment. A wound severity change is instead a degré de gravité. |
| Eased / hindered | Facilité / entravé | Preserve the modifier's direction; avoid the ambiguous désavantage. |
| Ability | Aptitude | Consistent across activation, Type and Focus descriptions. |
| Enabler | Aptitude passive | Activation classification only; this label does not imply permanent duration or unlimited uses. |
| Superheroics | Prouesses héroïques | Proposed ability name; all its exceptional Effort limits remain explicit. |
| Power Shifts | Amplificateurs de puissance | The category named Power remains Pouvoir. |
| First Action / Action / Last Action | Action réflexe / Action / Action lente | User-confirmed activation classes. Ordinal references such as the first action in combat retain their ordinary sequential meaning. These terms do not create extra actions or change timing. |
| Rally | Se reprendre | A Pool-spending healing action, with the superhero restriction stated separately. |
| Focus / Cypher | Focus / Cypher | Retained names; lowercase in ordinary French prose. |
| XP | PX | Locale-specific abbreviation for experience points. |

French guidance uses consistent **vous** forms, sentence case, typographic
apostrophes and ellipses. Labels use infinitives; warnings identify the problem
and, when appropriate, the corrective action. Existing key IDs and formatting
placeholders are preserved so editorial changes do not alter stored data or
break callers.

## Concrete corrections

| Keys or group | Correction |
| --- | --- |
| `TYPES.Item.type`, `TYPES.Item.focus` | Add the names of the already registered Item types. |
| `CYPHER.Sheet.Item` | Add the missing registered sheet name. |
| `CYPHER.Ability.ReferenceMissing` | Replace a raw missing key with an actionable reference warning. |
| `CYPHER.XP.Label` | EN remains XP; FR becomes PX. Use this key for costs instead of hardcoded PX. |
| `CYPHER.Stat.PoolValue` | Use Current points / Points actuels rather than the false friend Actual value. |
| `CYPHER.Warning.NotEnoughPool` | Refer to the full action cost rather than Effort alone. |
| `CYPHER.Roll.ExtraHinder` | Remove the misleading attribution of all extra hindrance to Lucky Shot or weapon unfamiliarity. |
| `CYPHER.XP.RerollCompare` | Identify the retained result without implying that the largest numerical result is always preferable. |
| `CYPHER.Healing.HandResult`, `CYPHER.Recovery.Sources.mind-surge` | Restore the exact Intellect stat name in French; Intelligence denotes a different power shift category. |
| `CYPHER.Armor.ManageInInventory`, `CYPHER.Advancement.OtherFocusNote`, `CYPHER.Advancement.OtherGenreNote` | Remove references to tabs that the current dashboard no longer exposes. |
| `CYPHER.NPC.DamagePlaceholder`, `CYPHER.NPC.MovementPlaceholder` | Supply localized replacements for hardcoded examples. |
| `CYPHER.PowerShift.*` | Use concise, source-named category labels. Preserve the CRD asterisk on special categories. |
| `CYPHER.PowerShiftDescription.*` | Add complete source descriptions in English and full French proposals. Expose these as help text rather than truncating applicability in a label. |

Power shift descriptions were checked against the supplied
`Cypher-Reference-Document-2026-07-29.docx`, Superheroes, Power Shifts,
paragraphs 3043–3054. The complete sentences preserve the movement, gymnastics,
crafting, endurance, thrown-damage, attack-exclusion and prerequisite details
that the earlier parenthetical labels omitted. English help text is taken
directly from those paragraphs; it is not a mechanical paraphrase.

The example ability name **Instinct incroyable (Incredible Instinct)** in the
Savant French description remains an editorial proposal. The English name is
retained in parentheses to preserve the source reference until the shared
compendium terminology is reviewed.

## Runtime findings and authoring structure

The initial two locale files contained 568 matching keys, with matching
interpolation placeholders. That parity did not catch missing runtime keys,
the uppercase `Configuration.Alternate` reference to a lowercase key, or the
PC card's nonexistent `CYPHER.Ability.Action.<value>` keys. The existing
`abilityActionLabel` helper provides the actual action-label mapping. Preserve
the existing string `CYPHER.Ability.Action`; replacing it with an object would
break its current callers.

Keep one runtime locale artifact per language for the existing manifest
contract. Maintain authoring files by domain, then merge them deterministically
with duplicate-key rejection, EN/FR key and placeholder parity, enum coverage,
and reference checks. Suggested domains are shared labels and sheets,
character creation and advancement, tasks and combat, recovery and healing,
content and Items, and import and migration. These domains are source-file
boundaries, not new persisted localization key namespaces.

Keep the glossary and translation review status outside localized mechanical
fields. Compendium identities and rule data remain language-neutral, and a
translated display name must never become a rule lookup key.
