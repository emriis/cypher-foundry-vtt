<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
follows [Semantic Versioning](https://semver.org/) on a best-effort basis while pre-1.0.

## [Unreleased]

### Added

- Defined the common CRD source-record contract for stable logical identifiers,
  bilingual pairing, and provenance, with pure validation helpers and tests.
- Documented the CRD source schema and structural-transformation rules.

- Established a strict CRD fidelity and French localization policy requiring source-faithful transcription, stable provenance, and automated consistency checks.

- Defined the Foundry-first architecture and conversion map for the 2026 Cypher Reference Document compendiums.

### Changed

- Compendium builds now discover authored bilingual pack source directories automatically instead of maintaining a hard-coded pack list.

- Completed the Phase 8 architecture refactor: dependency rules are now enforced by an automated static audit, Foundry E2E executable discovery is isolated and tested, concrete remaining dependency violations were corrected, and the architecture/development documentation now records the stable application, document, sheet, rules, migration, import, content, and test boundaries.
