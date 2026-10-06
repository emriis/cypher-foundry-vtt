# CRD Equipment Model Audit

This audit is the starting contract for W4. It compares the current Foundry
item models with the equipment mechanics explicitly described by the
2026-07-29 Cypher Reference Document.

The CRD remains authoritative. This document records model requirements and
gaps; it does not invent additional game rules.

## 1. Core equipment rules

| Family | CRD-backed requirements | Current model | Status |
| --- | --- | --- | --- |
| General equipment | level, price category, quantity, weight; some items use depletion | quantity, level, priceCategory, weight, depletion, equipped, description | **Covered** |
| Weapons / attacks | light/medium/heavy category, damage, range, extreme-range handling, weapon family/category, price | attackType, damage, range, extremeRange, weaponFamily, attackSkillCategory, priceCategory, properties, freelyUsable | **Covered** |
| Armor | light/medium/heavy category, free-use state, damaged armor reducing block benefit | category, freelyUsable, blockEaseDamage, equipped, priceCategory, description | **Covered** |
| Shields | independent wound track: 3 minor, 2 moderate, 1 major; broken after major wound | wounds with max/current values, equipped, derived broken state | **Covered** |
| Cyphers | one-use nature, type, power level where applicable, identification/internal state | cypherType, powerLevel, identified, internal, depleted, description | **Mostly covered** |
| Artifacts | level/form, identification, reusable depletion including never-depletes | level, form, identified, depletionDie, depletionThreshold, depleted, description | **Covered** |
| Oddities | descriptive item content | description | **Covered** |

## 2. Model gaps to resolve before extraction

### 2.1 Depletion ranges

The CRD describes artifact depletion as a range such as `1 in 1d6` or
`1–3 in 1d20`, plus `—` for artifacts that never deplete. The current
artifact model stores one `depletionThreshold`, which is sufficient for the
single-value case but cannot represent a multi-value depletion range.

The same issue applies to any equipment or artifact source that uses a
depletion range rather than a single threshold.

**Required extension:** represent the lower and upper depletion bounds while
preserving the existing single-value behavior as the normalized case.

### 2.2 Cypher level semantics

The current Cypher model stores `level` as a free-form string and separately
stores `powerLevel`. The CRD explicitly states that manifest cyphers are level
6 effects, while power levels (low through ultra) are a separate classification.
Other cypher forms do not require an implicit numeric effect level.

**Resolution:** `level` is now a nullable numeric field, while `powerLevel`
remains a separate categorical field. Legacy textual levels migrate to numbers
and empty legacy values migrate to null. Source extraction must assign level 6
to manifest cyphers where the CRD identifies them as such; it must not derive
power level from numeric level.

### 2.3 Weapon properties

The attack model already has a generic `properties` array. Before extracting
the equipment catalogue, each CRD weapon table must be audited to determine
whether any property has mechanics that need a dedicated structured field
rather than remaining an opaque label.

### 2.4 General equipment depletion

The CRD explicitly allows some ordinary equipment to use depletion instead of
a fixed quantity. The existing general equipment model supports this, but the
extraction contract must preserve both representations and must not infer
depletion for ordinary quantity-based items.

## 3. Extraction rules

1. Keep `priceCategory` abstract; do not invent currency amounts.
2. Preserve equipment level independently from price category.
3. Preserve weapon category independently from weapon family.
4. Preserve ranged maximum range and extreme-range behavior separately.
5. Preserve depletion as structured data whenever the CRD supplies it.
6. Do not convert descriptive notes into mechanics without a source-backed
   rule.
7. Keep English and French records mechanically identical.
8. Attach CRD provenance to every extracted source record.
9. Add representative fidelity fixtures before declaring a family complete.
10. Never edit compiled LevelDB packs directly.

## 4. Next implementation step

The depletion-range extension is complete. The next W4 step is to validate the
remaining equipment/cypher model semantics against the full CRD tables before
bulk extraction. Cypher effect level and power level are now represented as
separate structured fields. Full inventory extraction follows only after these
model contracts are green.
