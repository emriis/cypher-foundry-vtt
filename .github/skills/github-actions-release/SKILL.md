---
name: github-actions-release
description: Use when editing GitHub Actions, diagnosing CI failures, or preparing and validating a Foundry system release.
---

# GitHub Actions and release workflow

Start by reading `docs/development.md`, `CONTRIBUTING.md`, and the current
workflow files in `.github/workflows/`. Do not infer checks or release behavior
that is not defined there.

## CI diagnosis

- Identify the exact workflow run, job, and failed step; inspect its logs before
  changing code. Separate test failures from YAML/trigger errors, runner or
  shell assumptions, permissions, unavailable tools, and artifact problems.
- Reproduce the smallest relevant check locally, then run `npm test` when code
  or tests changed. Fix the root cause and report checks that remain unverified.
- Preserve intended event triggers, runner versions, job dependencies, and
  artifact paths. Grant only the permissions required by each workflow.
- Never print or expose secrets. Do not make untrusted pull-request code able
  to access privileged secrets or write tokens.

## Current repository pipeline

- `.github/workflows/test.yml` runs on branch pushes and pull requests with
  Node.js 22 and `npm test`.
- `.github/workflows/release.yml` runs for `v*` tags, runs tests, checks that
  the tag matches `system.json`'s version, packages via
  `scripts/package.ps1`, and publishes `dist/system.json` and
  `dist/system.zip` as GitHub Release assets.
- `npm run package` invokes the PowerShell packager. It validates the manifest
  version and pinned download URL, stages runtime files, creates the archive,
  and checks that `system.json` is at its root.
- CI does not currently promise linting, type checking, live Foundry testing,
  or compendium rebuilds unless the workflow is explicitly updated to add them.

## Release safety

For a requested release, verify the manifest version and version-pinned download
URL, tests, package contents, and matching `v<version>` tag. Do not create tags,
publish releases, or change release/version metadata unless explicitly asked.
Do not claim publication succeeded unless the GitHub release and its assets
were actually verified.

Branch protection and required checks are GitHub repository settings, not
workflow YAML. Explain when those settings require an administrator rather than
pretending a workflow change enabled them.
