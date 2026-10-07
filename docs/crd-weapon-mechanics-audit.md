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
- primary range: implemented;
- explicit extreme range: implemented;
- extreme-range hindrance: must be verified in attack resolution;
- melee/thrown semantics: currently descriptive rather than independently represented.

The last point should only become structured if the source data gives a mechanically reliable distinction. Do not infer melee merely from a weapon name.

## 2. Explicit weapon properties found in equipment

### Two-handed use

The CRD explicitly describes heavy weapons and specific medium weapons such as a quarterstaff as requiring two hands. mechanics.twoHanded is therefore valid.

A medium weapon can explicitly require two hands without becoming a heavy weapon. twoHanded must remain independent from attackType.

### One-handed firing hindrance

The CRD explicitly lists weapons for which an attack is hindered when fired with one hand, including rifles and shotguns.

Missing structured mechanic: a source-derived one-hand attack hindrance flag. It must not be inferred from twoHanded.

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

## 3. Special weapons

### Stunstick

The CRD explicitly states: no damage; level 2 or lower loses the next action; level 3 or higher is hindered by two steps for a round or two.

Structured target-effect extraction is implemented. Runtime application remains outstanding.

### Explosive weapons

The CRD has a dedicated rule for bombs, grenades, missiles, and similar explosives: they affect multiple targets in an area; affected creatures can require separate attack rolls; the GM may simplify this; success normally applies listed damage; failure typically applies smaller damage; grenades can be thrown a short distance; launchers can deliver them at range; Effort adds 2 damage per level instead of 3; PCs caught in the area make block or dodge rolls instead of the attacker making attack rolls.

The word typically matters: the system must not encode failed explosive attacks as universally dealing 1 damage. Individual explosive entries must provide their own explicit failure effect when one exists.

Missing structured mechanics include explosive/area identity, area size, delivery mode, explicitly stated failure effect, explosive Effort scaling, and the PC defense mode.

## 4. Explicit special effects on weapon attacks

The CRD contains weapon/armament descriptions with effects beyond ordinary damage, including Might defense follow-ups, stun/loss of next action, hindering, damage-track changes, burning, restraint/grappling, electrical damage, and Armor penetration.

These are source-specific mechanics. They must never be inferred from names such as taser, grenade, laser, or firearm.

The extraction layer must preserve the actual mechanical statement before runtime automation. targetEffects is only the first example and is not expressive enough for every explicit weapon effect in the CRD.

## 5. Ammunition and weapon use

The CRD science-fiction armaments section explicitly describes ammunition handling as three campaign choices: exact tracking, abstracted upkeep, or no tracking.

This is not a universal weapon property. The system must not invent magazine sizes or ammunition counts, and depletion must not be repurposed as ammunition.

Abilities that consume attacks worth of ammunition or power belong to ability runtime.

## 6. Weapon-related abilities

The CRD contains weapon-dependent abilities including Spray, Arc Spray, firearm additional attacks, Special Shot, Sniper, weapon-specific Lethal Capability, weapon mastery, knife/axe/whip/bow attacks, projectile interception, and abilities that modify ranged or melee damage.

These are not intrinsic weapon mechanics. The architecture should connect weapon source capabilities to ability prerequisites/effects rather than hard-code abilities into weapon attack resolution.

## 7. Environment and genre rules affecting weapons

The CRD explicitly contains weapon modifiers for low gravity, high gravity, and zero gravity.

Low gravity: heavy weapons that rely on weight deal 2 fewer damage, minimum 1; short range reaches long range; long range reaches very long range; low-gravity maneuvering training removes the damage penalty.

High gravity: attacks and physical actions are hindered; weapon ranges are reduced by one category; high-gravity maneuvering ignores the difficulty change but not the range reduction.

Zero gravity: physical tasks are hindered; short range reaches long range; long range reaches very long range.

These should be implemented only when an environmental state model exists. Do not hide them inside rollAttack as unconditional modifiers.

## 8. Spacecraft weapons

The science-fiction section contains a separate weapon-system model: spacecraft weapon systems are heavy weapons; each crewed weapon station can contribute an attack; targeting can disable weapons, defenses, engines, or maneuverability; target lock eases the next attack; coordinate fire provides an asset; redline attacks are risky options; and weapon-system GM intrusions have explicit malfunction consequences.

This is CRD material but belongs to a future spacecraft-combat domain, not the ordinary character weapon resolver.

## 9. Artifact weapons

The CRD contains a dedicated artifact-weapon section. Artifact weapons can operate outside the normal light/medium/heavy categories and can have level-based damage, Armor ignoring, special settings, and depletion.

These must remain distinct from ordinary crdType weapon equipment.

## 10. Mechanics that remain descriptive

Do not automate genre suitability, narrative appearance, social/legal consequences, explanations of technology, recoil descriptions unless a rule explicitly changes a task, naming/category examples, GM intrusion examples, or suggestions for adapting unlisted weapons.

Do not infer a missing category merely because the CRD says most weapons are medium.

## 11. Automation backlog derived from the CRD

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

## 12. Testing requirements

Every new weapon mechanic must be tested at the appropriate layers:
- rules/unit: pure mechanic resolution;
- behavior/BDD: source rule expressed as a scenario;
- content/extraction: CRD source statement maps to structured data;
- application: attack service consumes the structured mechanic;
- document boundary: Foundry Item/Actor APIs forward it correctly;
- E2E: real Foundry gameplay verifies the observable result when game state changes.

Content tests must validate source-derived behavior without coupling business tests to exact JSON representation.

No mechanic should be added to the runtime without a CRD source statement that justifies it.