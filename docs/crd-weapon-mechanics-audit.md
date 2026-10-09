# CRD weapon mechanics audit

## Scope

This audit covers the Cypher Reference Document 2026-07-29 across the entire document, not only the genre equipment tables.

The CRD is the sole authority for weapon automation. A rule is automatable only when the CRD states enough information to determine its mechanical result. Generic Cypher knowledge, inferred behavior, or conventions from other versions are not sufficient.

The audit separates:
1. weapon-native mechanics;
2. general combat rules that apply to weapons;
3. weapon-related rules supplied by abilities;
4. genre/environment rules that modify weapon use;
5. descriptive or narrative information that must remain non-automated.

## 1. Core weapon rules

### Weapon categories

The CRD defines three standard categories:

| Category | Base damage | Explicit combat behavior |
| --- | ---: | --- |
| Light | 2 | attack is eased; may be made as a First action |
| Medium | 4 | normal action timing |
| Heavy | 6 | requires two hands; attack is a Last action |

The category also determines the default price category, but price is an equipment/economy mechanic rather than attack resolution.

Current implementation:
- base damage: implemented;
- light attack easing: implemented;
- heavy two-handed source flag: implemented;
- light First-action timing: not yet represented as structured attack timing;
- heavy Last-action timing: not yet represented as structured attack timing.

The action-order information must not be inferred from twoHanded: the CRD explicitly gives timing semantics to the weapon category.

### Weapon familiarity

The CRD states that an unfamiliar weapon makes the attack hindered. This is already represented by the existing free-use/practiced weapon logic and must remain separate from weapon-specific hindrances.

### Weapon ranges

The CRD defines melee attacks as immediate range, thrown melee weapons as up to short range, ranged weapons by their listed maximum range, and attacks at the limit of a weapon range as extreme range and hindered. Some weapons explicitly extend their extreme range.

Current implementation:
- primary and extreme range categories: preserved as structured Item data;
- extreme-range hindrance: implemented through an explicit attack-dialog declaration after the GM confirms whether the target is at the weapon's range limit, and the declared state adds one hindrance step;
- the adjudication and source range categories are recorded in the task chat flags;
- automatic token/grid distance measurement and range-limit validation: not implemented by design;
- melee/thrown semantics: currently descriptive rather than independently represented.

The attack dialog must not pretend to determine range from scene coordinates. If the GM does not declare extreme range, no range hindrance is added. An explicit extreme-range category is preserved for adjudication, but this feature does not independently validate whether a target lies inside it.

The last point should only become structured if the source data gives a mechanically reliable distinction. Do not infer melee merely from a weapon name.

## 2. Weapon skill and proficiency

Weapon familiarity is not only a binary equipment flag. The CRD treats attack methods as skills and explicitly uses the normal skill progression.

### Skill levels that affect weapon attacks

| Level | Task modifier | Weapon-attack consequence |
| --- | ---: | --- |
| Inability | -1 step | The attack is hindered |
| Practiced | 0 | No skill adjustment |
| Trained | +1 step | One ease |
| Specialized | +2 steps | Two eases |
| Expert | +3 steps | Three eases, when an ability explicitly grants expert status |

The CRD also states that gaining training twice in the same skill makes the character specialized. Expert status is not a normal advancement step and requires an ability that explicitly grants it.

For weapons, distinguish:
- weapon familiarity: whether the character can freely use the weapon/category/family;
- attack skill: a skill for a specific attack method or broader weapon class;
- other task modifiers: Effort, assets, wounds, light-weapon easing, range, and source-specific weapon effects.

These must not be collapsed into a single boolean.

### Core and Type-provided familiarity

The CRD states that core characters freely use light weapons. Characters who cannot freely use a weapon are hindered when attacking with it.

Types can grant broader familiarity, including all weapons, selected weapon categories, and selected weapon families.

The CRD also contains explicit Type abilities such as Expert Combatant that grant training in a chosen specific attack or broader attack category. Some Types combine free weapon use with a separate trained attack skill.

Therefore a character may simultaneously have free use of a weapon and a trained attack skill; no free use but a trained attack skill, where the training cancels the unfamiliar-weapon hindrance; no free use and a specialized attack skill, producing the skill's remaining ease after the familiarity penalty; or an explicit inability, which must not be counted twice with the same unfamiliar-weapon penalty.

### Attack-skill scope

The CRD uses weapon skills at several scopes, including a specific weapon or attack method (swords, axes, bows, guns, etc.) and broad categories such as light/medium/heavy bashing, bladed, or ranged weapons.

The current data model already distinguishes weaponFamily and attackSkillCategory on attacks and attackCategory on skills. This is the correct direction, but runtime resolution must use the character's actual skill level rather than only a binary practiced flag.

### Inability cancellation

The CRD explicitly gives the real-world character an inability with medium and heavy weapons while allowing free use of light weapons. It also explicitly says that training in a specific medium/heavy weapon class cancels the inability but does not itself ease the attack in that special case.

The runtime therefore cannot blindly add a familiarity penalty and a trained-skill ease as independent modifiers in every case. It must establish the effective weapon-skill state and apply the resulting step modifier exactly once. In particular, an inability must not double-hinder an already unfamiliar weapon.

### Multiple training and specialization

The CRD states that trained plus trained in the same skill becomes specialized, specialized provides two ease steps, and expert provides three ease steps only when explicitly granted by an ability.

The existing skill item model already stores inability, practiced, trained, specialized, and expert. The weapon runtime should consume those levels directly rather than introducing a second proficiency scale.

### Ability-driven weapon training

Weapon training is not confined to equipment or Type data. The CRD contains abilities that grant training in a specific weapon attack, training in a broad weapon category, and specialization or expert status at later tiers when the character gains the skill normally. It also contains abilities that temporarily grant training in a specific attack.

The audit therefore covers Types, Descriptors, Foci, ordinary skills, advancements, and abilities, not only weapon equipment.

Current implementation:
- skill levels are structurally represented;
- Type/Descriptor skill progression can create or advance skills;
- Focus/Ability data can grant practiced weapon categories/families;
- attack resolution currently treats weapon familiarity mostly as a binary penalty and only recognizes a practiced matching attack skill as an explicit exception.

Missing:
1. a single pure resolver for weapon proficiency/familiarity;
2. correct handling of trained, specialized, and expert attack skills;
3. explicit prevention of double-counting an inability/unfamiliar-weapon penalty;
4. source-traceable tests for Type/Focus/Ability grants at each supported scope;
5. temporary weapon-skill states where the CRD ability explicitly makes them possible.
## 4. Explicit weapon properties found in equipment

### Two-handed use

The CRD explicitly describes heavy weapons and specific medium weapons such as a quarterstaff as requiring two hands. mechanics.twoHanded is therefore valid.

A medium weapon can explicitly require two hands without becoming a heavy weapon. twoHanded must remain independent from attackType.

### One-handed firing hindrance

The CRD explicitly lists weapons for which an attack is hindered when fired with one hand, including rifles and shotguns.

The source-derived `hinderedWhenUsedOneHanded` flag is now structured for the affected CRD weapon entries. The PC attack dialog lets the user declare one-handed use; only that choice adds the hindrance. It remains independent of `twoHanded`.

### Rapid-fire

The CRD explicitly labels certain weapons as rapid-fire. This is a capability used by abilities such as Spray and Arc Spray.

Being rapid-fire does not itself grant an additional attack. It makes the weapon eligible for specific abilities. The rapidFire flag is therefore valid, but its additional behavior belongs to ability runtime.

### Armor penetration

The CRD explicitly describes weapons that ignore a specified number of points of physical Armor. mechanics.ignoresPhysicalArmor is valid and already extracted.

The runtime consequence is source-derived Armor bypass, not a new damage type. Individual exceptions, such as force-field exceptions, must remain source-derived.

### Cutting physical materials

The CRD explicitly describes the Monomolecular blade as cutting physical materials up to a specified level. cutsThroughMaterialsLevel is valid.

This is object/material interaction, not ordinary NPC damage.

### Tripod and required operators

The CRD explicitly describes weapons requiring a tripod and a specified number of operators. requiresTripod and requiredOperators are valid.

They should become attack prerequisites only when the system can reliably represent the equipment setup and participating operators. Until then, preserve the source data without inventing actor state.

### Alternate configuration

The CRD explicitly describes a weapon that can switch from heavy to medium configuration as an action. The existing alternateConfiguration projection is valid.

Runtime still needs a proper configuration transition. Do not implement arbitrary weapon modes beyond the CRD.

## 4. Special weapons

### Stunstick

The CRD explicitly states: no damage; level 2 or lower loses the next action; level 3 or higher is hindered by two steps for a round or two.

Structured target-effect extraction and the supported persisted runtime lifecycle are implemented for the declared `loseNextAction` and `hindered` effects.

### Explosive weapons

The CRD has a dedicated rule for bombs, grenades, missiles, and similar explosives: they affect multiple targets in an area; affected creatures can require separate attack rolls; the GM may simplify this; success normally applies listed damage; failure typically applies smaller damage; grenades can be thrown a short distance; launchers can deliver them at range; Effort adds 2 damage per level instead of 3; PCs caught in the area make block or dodge rolls instead of the attacker making attack rolls.

The word typically matters: the system must not encode failed explosive attacks as universally dealing 1 damage. Individual explosive entries must provide their own explicit failure effect when one exists.

Missing structured mechanics include explosive/area identity, area size, delivery mode, explicitly stated failure effect, explosive Effort scaling, and the PC defense mode.

## 5. Explicit special effects on weapon attacks

The CRD contains weapon/armament descriptions with effects beyond ordinary damage, including Might defense follow-ups, stun/loss of next action, hindering, damage-track changes, burning, restraint/grappling, electrical damage, and Armor penetration.

These are source-specific mechanics. They must never be inferred from names such as taser, grenade, laser, or firearm.

The extraction layer must preserve the actual mechanical statement before runtime automation. targetEffects is only the first example and is not expressive enough for every explicit weapon effect in the CRD.

## 6. Ammunition and weapon use

The CRD science-fiction armaments section explicitly describes ammunition handling as three campaign choices: exact tracking, abstracted upkeep, or no tracking.

This is not a universal weapon property. The system must not invent magazine sizes or ammunition counts, and depletion must not be repurposed as ammunition.

Abilities that consume attacks worth of ammunition or power belong to ability runtime.

## 7. Weapon-related abilities

The CRD contains weapon-dependent abilities including Spray, Arc Spray, firearm additional attacks, Special Shot, Sniper, weapon-specific Lethal Capability, weapon mastery, knife/axe/whip/bow attacks, projectile interception, and abilities that modify ranged or melee damage.

These are not intrinsic weapon mechanics. The architecture should connect weapon source capabilities to ability prerequisites/effects rather than hard-code abilities into weapon attack resolution.

## 8. Environment and genre rules affecting weapons

The CRD explicitly contains weapon modifiers for low gravity, high gravity, and zero gravity.

Low gravity: heavy weapons that rely on weight deal 2 fewer damage, minimum 1; short range reaches long range; long range reaches very long range; low-gravity maneuvering training removes the damage penalty.

High gravity: attacks and physical actions are hindered; weapon ranges are reduced by one category; high-gravity maneuvering ignores the difficulty change but not the range reduction.

Zero gravity: physical tasks are hindered; short range reaches long range; long range reaches very long range.

These should be implemented only when an environmental state model exists. Do not hide them inside rollAttack as unconditional modifiers.

## 9. Spacecraft weapons

The science-fiction section contains a separate weapon-system model: spacecraft weapon systems are heavy weapons; each crewed weapon station can contribute an attack; targeting can disable weapons, defenses, engines, or maneuverability; target lock eases the next attack; coordinate fire provides an asset; redline attacks are risky options; and weapon-system GM intrusions have explicit malfunction consequences.

This is CRD material but belongs to a future spacecraft-combat domain, not the ordinary character weapon resolver.

## 10. Artifact weapons

The CRD contains a dedicated artifact-weapon section. Artifact weapons can operate outside the normal light/medium/heavy categories and can have level-based damage, Armor ignoring, special settings, and depletion.

These must remain distinct from ordinary crdType weapon equipment.

## 11. Mechanics that remain descriptive

Do not automate genre suitability, narrative appearance, social/legal consequences, explanations of technology, recoil descriptions unless a rule explicitly changes a task, naming/category examples, GM intrusion examples, or suggestions for adapting unlisted weapons.

Do not infer a missing category merely because the CRD says most weapons are medium.

## 12. Automation backlog derived from the CRD

### P0 — weapon attack resolution
1. Represent First-action timing for light weapons.
2. Represent Last-action timing for heavy weapons.
3. Verify and implement extreme-range hindrance at the actual attack boundary.
4. Add source-derived one-hand firing hindrance where explicitly stated.
5. Preserve category timing independently from twoHanded.

### P1 — explicit weapon effects
6. Finish runtime application of targetEffects.
7. Extend the structured special-effect model for explicit CRD weapon effects.
8. Model explicit explosive weapon properties.
9. Implement explosive target-resolution semantics.
10. Implement explosive Effort scaling exactly as specified.

### P2 — equipment interaction
11. Implement alternate weapon configurations.
12. Implement tripod/operator prerequisites once actor/equipment setup supports them.
13. Implement object/material interaction for cutsThroughMaterialsLevel.
14. Apply explicit Armor penetration during NPC damage resolution.

### P3 — cross-domain interactions
15. Connect rapidFire to ability prerequisites.
16. Connect weapon categories/families to weapon-related skills and abilities.
17. Add explicit ammunition consumption where the CRD supplies it.
18. Add environmental weapon modifiers once environmental state exists.
19. Model spacecraft weapons separately.
20. Model artifact weapons separately.

## 13. Testing requirements

Every new weapon mechanic must be tested at the appropriate layers:
- rules/unit: pure mechanic resolution;
- behavior/BDD: source rule expressed as a scenario;
- content/extraction: CRD source statement maps to structured data;
- application: attack service consumes the structured mechanic;
- document boundary: Foundry Item/Actor APIs forward it correctly;
- E2E: real Foundry gameplay verifies the observable result when game state changes.

Content tests must validate source-derived behavior without coupling business tests to exact JSON representation.

No mechanic should be added to the runtime without a CRD source statement that justifies it.