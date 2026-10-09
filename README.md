# Cypher — Unofficial Foundry VTT System

An unofficial Foundry VTT system for **Cypher**, built under the Cypher Open
License.

This repository currently targets Foundry VTT V13 and V14 and is verified
against Foundry V14. The current release version is 0.2.0-alpha.1.

This project is not affiliated with Monte Cook Games or Foundry Gaming LLC.

## Project status

The broad architecture refactor is complete. The current development focus is
on closing the runtime boundary for structured CRD mechanics that are already
extracted into the compendium source.

The current CRD content layer is substantially complete for the source-backed
player and equipment families:

- Skills
- Abilities
- Types
- Descriptors, including species-style descriptors
- Foci
- Equipment
- Weapons
- Armor
- Shields
- Subtle Cyphers
- Manifest Cyphers
- Power Boost Cyphers

The W4 equipment inventory contains 259 English records paired with 259 French
records across equipment, weapons, armor, and shields.

The supplied 2026-07-29 CRD contains no creature inventory. The repository
therefore does not claim CRD creature extraction. The existing NPC/creature
Actor model is a general system capability.

The Artifact Item model exists, but Artifact extraction is source-blocked because
the supplied CRD contains no Artifact inventory.

## Architecture

The current dependency direction is:

    Foundry documents / sheets
              |
              v
    application services
              |
              v
    pure Cypher rules
              |
              v
    configuration and source data

Important boundaries:

- module/rules/ contains deterministic rules and must not depend on Foundry
  globals.
- module/applications/ contains Foundry-aware gameplay use cases.
- module/documents/ provides thin document APIs and compatibility facades.
- module/data-models/ defines Actor and Item schemas.
- module/sheets/ contains ApplicationV2 UI.
- packs/*/_source/ is the authoritative editable compendium content.
- Generated LevelDB packs are build artifacts.

See:

- docs/architecture.md
- docs/development.md
- docs/compendium-architecture.md
- docs/crd-compendium-map.md
- docs/crd-content-roadmap.md
- docs/crd-source-schema.md

## Runtime capabilities

The current system includes:

- Cypher task resolution with difficulty, steps, Effort, Edge, skills, assets,
  and special d20 results
- wound-based damage and recovery
- armor and shield behavior
- advancement and tier transitions
- XP, rerolls, and Player Intrusions
- structured Ability costs and effects
- Ability activation/deactivation and recovery-driven expiration
- active Ability modifier aggregation
- structured Ability roll-table resolution
- Type and Focus advancement benefits
- weapon attacks and core damage behavior
- structured NPC attacks against player defenses, including wound and Pool damage
- Cypher use and depletion
- bilingual French/English localization
- ApplicationV2 PC, NPC, Community, and Item sheets
- Character Builder JSON import

Structured CRD data is intentionally treated as an automation boundary. A field
being extracted does not imply that its gameplay semantics are already executed.

Current runtime work includes:

- weapon mechanics.targetEffects
- other structured weapon special mechanics
- generic Cypher variants and random ranges
- generic Cypher roll-table execution
- complete runtime verification of structured granted benefits

## Compendium source of truth

Edit only the paired English/French records under:

    packs/*/_source/

The pipeline is:

    CRD
      -> source records
      -> migration / validation
      -> deterministic pack build
      -> Foundry LevelDB packs

CRD records carry provenance under flags.cypherFoundry.crd and use stable
logical IDs independent of Foundry UUIDs.

Do not edit generated LevelDB files manually.

## Development

Install dependencies:

    npm install

Run the complete deterministic suite:

    npm test

Useful focused commands:

    npm run test:unit
    npm run test:content
    npm run test:integration
    npm run test:behavior
    npm run audit:architecture
    npm run audit:public-data
    npm run check:system-syntax
    npm run check:e2e-syntax
    npm run check:e2e-browser

Compile the compendiums:

    npm run build:packs

Build the distributable package:

    npm run package

## End-to-end tests

The E2E suite uses Playwright against a real headless Foundry installation.

    npm run test:e2e

The runner:

- packages the system before the live run
- validates system and E2E JavaScript syntax
- validates the required Playwright browser
- creates a disposable cypher-e2e-<timestamp> world
- starts Foundry headlessly
- uses one worker-scoped browser session
- logs into the Game Master once and reuses the session
- removes only generated cypher-e2e-* worlds
- never removes the user's general Foundry Data directory
- shuts down the runner-owned Foundry process

A locally activated Foundry installation is required for live E2E validation.

Foundry server logs are captured in a temporary file and stay out of the normal
console output. If the E2E run fails, the last 120 lines are printed and the
full log path is shown. To stream Foundry logs live while debugging, set
`FOUNDRY_E2E_SHOW_FOUNDRY_LOGS=true` before running the command.

## Character Builder import

The system can import a JSON export from the official Cypher Character Builder.

The importer maps the supported character content into the system's Actor and
Item models rather than copying the external data format directly.

The public compatibility API remains:

    game.cypher.importFromBuilder(jsonData)
    game.cypher.openImportDialog()

## Documentation and contribution workflow

Repository documentation is maintained in English.

Before substantial work, read:

1. CONTRIBUTING.md
2. docs/development.md
3. docs/architecture.md
4. the relevant content/model documentation

For CRD content, follow the source/provenance rules and never invent missing
source material.

## License and attribution

This project is built under the **Cypher Open License** using content from the
Cypher Reference Document. See LICENSE.txt and the official license information
at https://col.montecookgames.com.

This is an unofficial implementation and is not an official Monte Cook Games
product.
