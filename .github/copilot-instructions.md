# Copilot instructions

- Follow `docs/code-comments.md` for beginner-readable explanations and accurate
  JSDoc. Update comments with behavior, document side effects and important
  ordering, and remove stale/duplicate claims. Review meaning, not line counts.

- Use `AGENTS.md` for shared architecture, command side effects, and task scope.
  Codex discovery entrypoints are in `.agents/skills/`; existing detailed
  procedures remain in `.github/skills/`.

- Read `README.md`, `CONTRIBUTING.md`, and `docs/development.md` before
  substantial work; check `docs/local/` for relevant user-provided references.
  `docs/local/` is ignored by Git and is not available to other clones or CI.
  Treat it as user-owned private data: it may be a junction or symlink to storage
  outside the repository. Preserve the path and target; never add, stage, force-
  add, move, replace, or delete its contents or link unless explicitly asked.
  Do not run cleanup commands that remove ignored files (such as `git clean -fdX`
  or `git clean -fdx`) without explicit approval. If it is missing or
  inaccessible, report that rather than recreating or replacing it.
- Follow the repository's existing Foundry VTT V13/V14 architecture and the
  Cypher Open License notices. Do not guess at version-sensitive Foundry APIs.
  The supplied CRD is the sole authority for rules and all compendium content.
  Its complete text may be stored under the Cypher Open License. French wording
  must faithfully render the CRD; other books cannot supply different content
  or mechanics. Never guess an unresolved match or modify names, IDs, or rules
  to force one. Follow `docs/crd-source-schema.md` for this source contract.
- Author player-facing strings in matching `lang/src/en/` and `lang/src/fr/`
  domain files. Compile `lang/en.json` and `lang/fr.json` with `build:lang`;
  `check:lang` rejects collisions, missing keys, stale bundles and changed
  variables. Follow `docs/localization.md` for terminology and source-guarded
  French compendium proposals. Translated display names never determine IDs.
- Treat `packs/*/_source/` as editable sources and generated LevelDB packs as
  build outputs. Edit paired English and French source records directly, then
  use the documented validation and packaging workflows.
- For behavior changes, use TDD and run focused tests followed by `npm test`.
  `npm test` normalizes sources only in a temporary checkout. Explicit
  `migrate:packs`, `build:packs`, and `package` commands mutate this checkout;
  use them here only when authoring or artifact changes are intended.
  Report checks that were not run, including any required live-Foundry
  verification.
- Before preparing a commit with runtime-affecting changes, follow
  `.github/skills/foundry-live-validation/SKILL.md`: verify the exact local
  Foundry version in a disposable world using this checkout, and update
  `system.json` `compatibility.verified` only after a successful live test on a
  newer version. If live testing is unavailable or fails, leave it unchanged
  and report the gap; cancel unreviewed or non-reversible migrations.
- Do not assume CI runs checks that are absent from `.github/workflows/`.
  Preserve least-privilege permissions and never expose secrets in logs or
  untrusted pull-request code.
- Make narrow, complete changes; preserve unrelated working-tree changes and
  never create or publish a release unless explicitly requested.
