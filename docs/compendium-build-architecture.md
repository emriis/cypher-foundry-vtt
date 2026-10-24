# EN canonical content and French compendium compilation

Every Foundry document uses the English CRD source as its rule/identity authority,
and `translations/fr/` as its *only* French editorial prose authority.
The build derives French Items and JournalEntries in memory from normalized
English records, remaps compendium references from `-en` to `-fr`, then
applies the reviewed source-hashed French text. Folder display labels are kept
in `translations/fr/_folders.json`, matched against the English folder names.

```text
packs/*-en/_source/ + translations/fr/
      -> temporary normalized English catalogue
      -> derived FR documents + source-hashed translations
      -> Foundry LevelDB packs (EN and FR)
      -> dist/system.zip
```

`npm run package` rebuilds the UI dictionaries and all fourteen LevelDB
packs, then creates the Foundry ZIP. `npm run package:release` requires all
French translations to be reviewed. `npm run package:archive` assembles an
archive from **already** compiled packs, needed for preview/E2E builds.

There are no tracked `packs/*-fr/_source` documents. The canonical English
CRD source tree is the only authored rule/structure surface; source audits and
tests derive French counterparts in memory. Historical two-language migration is
reserved for explicitly constructed legacy fixtures (`--legacy-bilingual`).

The installation ZIP excludes all `_source` directories. Existing world-owned
Item copies are not automatically updated by reinstalling compendium databases.


## Regression guarantees

CI checks the derived French catalogue without authored French source files,
verifies all 14 LevelDB databases and complete strict translation coverage, and
ensures the installable ZIP omits all `_source` directories. Live Foundry
v14/Playwright acceptance remains a separate licensed-environment step.
