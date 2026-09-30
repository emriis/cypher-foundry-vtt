# Copilot instructions

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
  For compendium descriptions, the English CRD is the absolute authority and
  its complete text may be stored under the Cypher Open License; use a complete
  matching Character Book translation in French when available, otherwise copy
  the English text verbatim. Never guess an unresolved match or modify names,
  IDs, or mechanics to force one.
- Keep player-facing strings localized in both `lang/en.json` and
  `lang/fr.json`; validate JSON and avoid duplicate keys.
- Treat `packs/*/_source/` as editable sources and generated LevelDB packs as
  build outputs. Edit paired English and French source records directly, then
  use the documented validation and packaging workflows.
- For behavior changes, use TDD and run focused tests followed by `npm test`.
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
