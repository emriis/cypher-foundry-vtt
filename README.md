# Cypher — Foundry VTT System (Unofficial)

> An unofficial Foundry VTT game system for **Cypher** (Monte Cook Games), built under the
> [Cypher Open License](https://col.montecookgames.com) using content from the Cypher Reference
> Document (CRD). Not affiliated with or endorsed by Monte Cook Games.

## Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Features](#features)
  - [Core rules engine](#core-rules-engine)
  - [Character creation](#character-creation)
  - [Experience & advancement](#experience--advancement)
  - [Combat](#combat)
  - [Design system](#design-system)
- [Importing from the official Character Builder](#importing-from-the-official-character-builder)
- [Descriptor compendiums (FR/EN)](#descriptor-compendiums-fren)
- [Architecture notes](#architecture-notes)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

See [`CHANGELOG.md`](CHANGELOG.md) for release history and [`CONTRIBUTING.md`](CONTRIBUTING.md)
for coding conventions and the contribution process.

## Requirements

- Foundry VTT **V13 or V14** (verified against V14.360).
- No external dependencies.

## Installation

1. Copy the `cypher` folder into your Foundry `Data/systems/` directory, **or** install via the
   manifest URL:
   ```
   https://github.com/emriis/cypher-foundry-vtt/releases/latest/download/system.json
   ```
2. Launch Foundry VTT and create a world using the **Cypher** system.
3. In the world settings, pick French or English — the system is fully localized.

## Features

### Core rules engine

A **Wound**-based implementation of the CRD's actual task-resolution rules, not a simplified
"pool hits 0" damage track:

- Full task rolls — difficulty, steps, Effort, Edge, skills, and assets — with the special
  results on a natural 1, 17, 18, 19, and 20 (GM intrusion, damage bonus, minor/major effect,
  and cost refund on a natural 20).
- Correct Effort cost: 3 points for the first level, 2 for each additional level, with Edge
  discounted once against the total (never per level).
- **Wound tracking** (minor/moderate/major, 3 boxes each by default) with cascading overflow
  and stacking hindrance: a full moderate track hinders by 1 step, each major wound hinders by
  a further step, and a third major wound is death. This state is synced to token status icons
  ("Hindered" / "Dead").
- Armor that eases Block and hinders Dodge by category (light/medium/heavy), correctly
  accounting for armor the character isn't trained to use freely.
- Recoveries that remove wounds by duration (10 min → minor wounds, 1 hour → one moderate
  wound, 10 hours → all moderate wounds).
- Rallying: spend Might to remove a minor or moderate wound.
- One-click cypher use, and attack rolls with damage scaled by weapon category (light 2 /
  medium 4 / heavy 6).
- **Block & Dodge** as two dedicated actions next to Armor. A successful Block reduces wound
  severity by one step; a successful Dodge avoids the wound entirely; a failed defense applies
  the wound as-is. Effort, Edge, assets, and the 17–20 special results all apply identically to
  defense rolls.
- **Shields**, usable by any character regardless of Type, with their own 3/2/1 wound track. On
  a successful Block, the roll dialog lets you have an equipped shield absorb the wound
  entirely instead of reducing it by one step.
- **Damageable armor**: a GM-intrusion action reduces an armor's Block bonus by one step per
  use (Dodge hindrance is never affected, matching the CRD), with a Repair action to clear it.
- **Artifact depletion rolls**: a structured depletion die + threshold (instead of free text),
  with a one-click roll that always lets the item work this once, but marks it depleted if the
  roll falls at or under the threshold.

### Character creation

- **Genre-aware character sheet** matching the CRD's per-genre rules. A Genre selector (Real
  World / Fantasy / Sci-Fi / Superhero / Unspecified / Custom) drives which header fields are
  shown:
  - **Real World**: no Type/Focus — the sheet shows Descriptor + Profession instead, with a
    reminder of the default inability with medium/heavy weapons.
  - **Fantasy / Sci-Fi**: the standard Descriptor + Type + Focus line, plus an optional
    Species field.
  - **Superhero**: adds Rank (1–5) and Power Shifts (the 12 CRD categories, each capped at 3).
    Superhero characters can rally to remove a major wound (10 Might), and task difficulty in
    the roll dialog goes up to 15 instead of 10, per that genre's "really impossible tasks" rule.
  - **Custom**: unlocks every genre-specific field at once, for freely mixing pieces from
    different genres.
- Optional **second descriptor** and **second focus** fields (CRD-sanctioned via the Human
  species option and the Superhero "Second Focus" advancement).
- **Custom stats**: add any number of Pool/Edge stats beyond Might/Speed/Intellect (e.g. Luck,
  Faith, Willpower for a homebrew genre) — they work identically to the core three in task rolls.
- **Custom fields**: an open-ended list of text/number/checkbox fields for anything the data
  model doesn't already cover (reputation, debts, allies, radiation level, etc.).
- A **Resource Points** tracker in the header, per the CRD's advancement/goals rules.

### Experience & advancement

- **Reroll** (1 XP): a button under any roll in chat spends 1 XP and posts the better of the
  original and new d20.
- **Player Intrusion** (1 XP): a button and prompt to describe how the situation is altered in
  the character's favor, posted to chat.
- **Lucky Shot** (1 XP): available in the attack roll dialog — attacks blind, automatically
  hindered by 4 steps.
- **Full character advancement**: 4 slots per tier — Increasing Capabilities, Moving Toward
  Perfection, Extra Effort, Skill, or an "Other" substitute (Recovery/Focus/Armor/Weapons/Genre)
  — each costing 4 XP. Buying a slot applies its mechanical effect automatically (Pool
  distribution, +1 Edge on a chosen stat, +1 Effort capped at 6, a new or upgraded Skill item,
  etc.) and grants a Resource Point. Once all 4 slots are bought, the character automatically
  advances a tier, slots reset, and a chat message reminds about the free Focus ability (and
  Genre ability at tiers 3/6/9…).
- Weapon proficiency is tracked on Attack items (`freelyUsable`): an unfamiliar weapon hinders
  the attack by 1 step, unless the "Other: Weapons" advancement was purchased.

### Combat

Covered above under [Core rules engine](#core-rules-engine) — task rolls, wounds, armor, Block
& Dodge, and shields are all part of the same unified roll engine.

### Design system

Documented in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md): reusable color, typography, and spacing
tokens; WCAG AA–verified contrast; Foundry light/dark theme compatibility; keyboard focus
rings; and minimum click targets. Reuse it as-is for any new sheet or application in this
system.

## Importing from the official Character Builder

An **"Import (Character Builder)"** button appears in the Actors sidebar
(`module/import.mjs`) to create a PC directly from a `.json` file exported by the
[official Character Builder](https://tools.cypher-rpg.com/builder) (same format as the
third-party Foundry module `cyphersystem`). The export's data structure differs entirely from
this system's own, so the importer is a real mapper, not a direct load:

| Export field | How it's handled |
|---|---|
| Wounds | Parsed via tolerant regex from the free-text notes field (e.g. `Minor: ... 0/5`). A severity that fails to parse falls back individually to 3/0 rather than aborting the import. |
| Genre | No equivalent in the export — set to **Custom**, which unlocks every field. Adjust by hand afterward. |
| "Species" | Actually maps to the CRD's **second descriptor** (a mechanically-benefited species grants the same kind of trait package as a descriptor). |
| `Freely Use ...` pseudo-skills | Not imported as Skill items — used only to set `freelyUsable` on matching weapons/armor. The `Initiative` pseudo-skill is dropped (no equivalent here). |
| Ability cost `"1+"` | Stored as the base integer (`1`); the full description (which mentions the extra Effort) is preserved, and has no bearing on Effort spent at roll time (handled independently by the roll dialog). |

Supported item types: Skills, Abilities, Equipment, Weapons (Attacks). **Not yet mapped**:
Cyphers, Artifacts, Armor, Shields, Oddities — these are skipped with a warning (shown in-game
and in the console) rather than guessed at, for lack of a sample export containing them. If you
have one, please share it to extend the mapper.

If the sidebar button fails to find its anchor point on a given Foundry version (button
placement is best-effort, since the sidebar DOM isn't guaranteed stable across versions), the
same functionality remains available from a macro:

```js
await game.cypher.openImportDialog();
// or, with data already parsed:
await game.cypher.importFromBuilder(jsonData);
```

## Descriptor compendiums (FR/EN)

The first batch of bilingual compendiums, ahead of Types and Foci: **33 CRD Descriptors** as a
new `descriptor` item type (`module/data-models/item-descriptor.mjs`), packaged into two
LevelDB compendiums (`descriptors-fr`, `descriptors-en`).

A Descriptor is deliberately **not** a persistent item. Dropping it onto a PC sheet
(`CypherPCSheet#_onDropItem`) opens a dialog to pick the stat (when the Descriptor offers more
than one, e.g. Gloomy) and the skill (from the listed options, or free text to cover the CRD's
"...or similar" wording), then applies the effect directly via `CypherActor#applyDescriptor`:

- +2 (or the configured amount) to the chosen Pool;
- a new trained Skill item, or an existing skill of the same name advanced one step (same
  progression logic as character advancement: inability cancelled, trained → specialized, …);
- the Descriptor's name written to `system.descriptor`, already surfaced in the header's
  character sentence;
- a chat message summarizing the grant.

Flavor text for each entry is an original rewrite, not a reproduction of CRD text — only the
mechanical data (Pool bonus, skill choices) follows the CRD, as the Cypher Open License allows.

To regenerate the source JSON:

```
python3 scripts/generate-descriptors.py
```

To recompile the sources into a loadable LevelDB pack, see
[Rebuilding compendium packs](CONTRIBUTING.md#rebuilding-compendium-packs) in
`CONTRIBUTING.md`.

## Architecture notes

An audit was run against Foundry's official system-development recommendations (V13/V14) and,
comparatively, against `dnd5e` (foundryvtt/dnd5e) as a reference for architectural best
practice. Real bugs found and fixed:

- **`primaryTokenAttribute` / `secondaryTokenAttribute`** in `system.json` pointed at
  `pools.might` / `pools.speed`, a path that doesn't exist in the actual schema
  (`stats.might.pool`) — token bars (HP/speed) couldn't have worked.
- **`data-action="onEditImage"`** on character/item portraits — not Foundry's actual action
  name (`editImage`), so clicking a portrait did nothing.
- **Silent data loss on array fields**: custom stats, custom fields, and advancement slots used
  form fields that didn't cover every sub-field of each array element (e.g. missing `id`/
  `label`). Since Foundry replaces an `ArrayField` **wholesale** on every submission (never
  merged element-by-element), and the sheet submits the entire form on every change
  (`submitOnChange: true`), any unrepresented field would have been silently wiped on the next
  unrelated change — for instance, an already-purchased advancement slot could have reverted to
  "not purchased." Fixed with dedicated hidden fields that preserve these values across every
  submission.
- Consistent renaming from **Cypher System → Cypher** throughout the project (system id,
  folder, template paths, CSS classes, flag namespace), following Monte Cook Games' name change
  for this edition.

Practices adopted from `dnd5e`:

- **No `compatibility.maximum`** in the manifest, so the system isn't artificially blocked by a
  new Foundry release with no known real incompatibility.
- **`hotReload` flag**, so Foundry can reload CSS/templates/language files during development
  without restarting the world.
- **Migration scaffold** (`module/migration.mjs`), following dnd5e's exact model: a per-actor
  stored version, compared against the manifest's `needsMigrationVersion` /
  `compatibleMigrationVersion`, run on the `ready` hook. The schema has already changed several
  times during development (wounds, armor, artifacts) — without this, any world created before
  a future schema change would end up with orphaned data.
- **Grouped exports (`_module.mjs`)** per folder (`data-models/`, `documents/`, `sheets/`),
  following dnd5e's `import * as X from "./module/X/_module.mjs"` pattern, instead of importing
  each class individually into `cypher.mjs` — more readable and scales better as the system grows.

Deliberately **not** adopted, as out of scope for a project this size: a dedicated `canvas/`
folder (advanced scene integrations), a `dice/` folder with dedicated roll subclasses, a
LESS/SCSS build pipeline, custom text-enricher rendering, and third-party content registration
via modules.

**Known limitation**: these fixes were validated by systematic code review against Foundry's
official API documentation, but **have not been tested inside a live Foundry instance**. A
first in-game launch is strongly recommended before table use.

## Roadmap

1. Playtest the character sheet in a live game; adjust layout/CSS as needed.
2. Extend the same pattern (generator item + bilingual compendium) to **Types** and **Foci**,
   sourced from the CRD under the Cypher Open License.
3. Add compendium macros for repetitive actions (group damage application, GM intrusion
   handling, etc.).
4. Add a dedicated NPC sheet with automatic target-number calculation (level × 3).

## Contributing

Contributions are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for coding conventions
(including the English-only JSDoc convention), the compendium-pack build procedure, and the PR
process.

## License

This system is built from the Cypher Reference Document (CRD), published by Monte Cook Games
under the [Cypher Open License](https://col.montecookgames.com), which permits building
compatible games that reuse CRD rules and content. Follow that license's attribution
requirements if you distribute this system publicly. See [`LICENSE.txt`](LICENSE.txt).
