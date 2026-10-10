# Ability weapon prerequisite resolution

## Contract

`weaponPrerequisites` stores source-backed conditions on an Ability. Each
entry has a `kind`, an `alternativeGroup`, and an optional `value`:

- Requirements sharing a group are alternatives (OR).
- Separate groups are cumulative (AND).
- Contextual facts such as thrown weapons being carried or within reach must be
  explicitly supplied by the application layer.
- Unknown or malformed requirement kinds fail closed.
- Weapon names, descriptive `properties` text, and prose are never parsed to
  infer mechanics.

## CRD contracts covered

- **Spray**: accepts a rapid-fire weapon, or multiple thrown weapons carried by
  the character or within reach. Its separate attack, ammunition/power use, and
  reduced damage behavior are not implemented by this prerequisite resolver.
- **Arc Spray**: requires a rapid-fire weapon. It does not inherit Spray's
  thrown-weapon alternative.

The resolver only answers eligibility. It does not execute an ability, consume
resources, determine reach, or make attack rolls. Those behaviors need separate
source-backed application contracts and tests.
