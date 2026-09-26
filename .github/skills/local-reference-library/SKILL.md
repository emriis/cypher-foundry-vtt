---
name: local-reference-library
description: 'Use when adding, organizing, preserving, or consulting local-only reference files in docs/local/, including branch-switch issues, Windows junctions, symlinks, and agent access.'
---

# Local reference library workflow

Use this workflow for user-provided references kept outside version control and
made available to this checkout through `docs/local/`. These files are private
to the local environment; they are not available to other clones or CI.

## Procedure

1. Confirm the repository root and inspect `docs/local/` only as needed. Check
   whether the path is ignored with `git check-ignore -v -- docs/local` and
   whether it is a link before changing anything.
2. Never stage, commit, delete, move, or overwrite local reference files unless
   the user explicitly asks. If the folder must survive branch switches, keep
   its contents in a stable directory outside the repository and link
   `docs/local/` to it. Do not merge into an existing external directory
   without inspecting it and obtaining approval.
3. On Windows, a junction can preserve the expected workspace-relative path.
   Only after confirming the destination does not exist and the user has
   approved moving the current folder, use PowerShell from the repository
   root:

   ```powershell
   $repoLocal = Join-Path (Get-Location) 'docs\local'
   $stableLocal = Join-Path $env:USERPROFILE 'cypher-foundry-vtt-local'
   if (Test-Path $stableLocal) { throw "Destination already exists: $stableLocal" }
   Move-Item $repoLocal $stableLocal
   New-Item -ItemType Junction -Path $repoLocal -Target $stableLocal
   ```

   On macOS or Linux, after the same checks and approval, use a symbolic link:

   ```sh
   mv docs/local "$HOME/cypher-foundry-vtt-local"
   ln -s "$HOME/cypher-foundry-vtt-local" docs/local
   ```

4. Verify the link target, that expected files can be listed through
   `docs/local/`, and that Git still ignores the path. For example, on Windows
   use `Get-Item docs/local | Format-List LinkType,Target`; on macOS or Linux
   use `readlink docs/local`. Then check `git status --short --ignored --
   docs/local`.
5. Before switching to an unfamiliar branch, check whether it tracks anything
   under `docs/local/` with `git ls-tree -r --name-only <branch> -- docs/local`.
   Ordinary branch switches do not normally remove unrelated ignored files,
   but branch conflicts or cleanup commands can remove the link. Commands such
   as `git clean -fdX` and `git clean -fdx` can delete ignored paths; never run
   them without an explicit request and a reviewed preview.
6. For a project task, consult only the relevant local references. If the
   target is missing or inaccessible, say so rather than guessing or silently
   substituting a different source. Do not copy substantial copyrighted
   reference text into tracked files; follow the repository's license guidance
   and prefer original summaries.

## Completion checks

- The local references remain outside version control.
- `docs/local/` resolves to the intended external directory and is ignored by
  Git.
- The agent names the local references it relied on and distinguishes them
  from sources available to CI or other contributors.