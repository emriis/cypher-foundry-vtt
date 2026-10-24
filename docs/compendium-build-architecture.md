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

Do not write French prose into `packs/*-fr/_source`. These historical shells
remain in the checkout *only* because the legacy source-migration and authoring
test suite still consult them; **pack compilation no longer uses them**.
A follow-up migration removes those shells after rewriting their remaining
normalization and test contracts.

The installation ZIP excludes all `_source` directories. Existing world-owned
Item copies are not automatically updated by reinstalling compendium databases.
