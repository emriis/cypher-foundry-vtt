# Final bilingual release and Foundry acceptance

## Automated release gate

The strict bilingual release candidate is built from the canonical English CRD-derived source and all 1,373 French editorial proposals. The CI job **Strict bilingual release candidate and verified Foundry archive** runs:

```sh
npm run audit:localization-integrity
npm run build:packs -- --require-reviewed
npm run test:build
npm run package
node scripts/verify-package.mjs
```

The job then rebuilds the archive and checks byte-for-byte reproducibility. The generated, installable `dist/system.zip` and `dist/system.json` are published as the **foundry-bilingual-release-candidate** CI artifact. This workflow does not increment the version, tag or publish a GitHub release; that remains the maintainer's decision. It does not modify any authored source, translation or rule logic.

## Final acceptance in FoundryVTT

This final acceptance requires a licensed FoundryVTT v14 installation and is **not claimed to have passed in GitHub CI**. Use the generated archive from the same commit as the passing release-candidate job (or build locally using the strict command). Install or update the `cypher` system in a separate test environment, then check the following:

1. Confirm the system loads in Foundry v14, both English and French localization menus work, and the 14 bilingual compendium packs are visible and non-empty.
2. Inspect the seven French Rules Journals: titles, content, navigation, paragraph structure, cross-links, accented characters, source completeness.
3. Check examples from all 701 Abilities, 58 Skills, 53 Descriptors, 55 Types, 42 Foci, 457 equipment/cypher entries and seven Rules Journals; for final **complete fidelity certification**, extend the comparison to every source-backed field, sentence, condition, exception and example against its canonical English passage.
4. Compare duplicate-title Abilities with distinct identities and typed effects. Verify all equipment categories, weapon categories, armor/shield rules, starting Type equipment and Focus choices are legible and link to the intended abilities.
5. Test character creation and tier progression with French and English Types, Foci, Descriptors, skills and abilities; validate references, costs, Edge/Effort, wounds, attacks, armor, shields, and Cypher usage.
6. Run `npm run test:e2e` on a licensed local Foundry install (or `npm run test:e2e-debug` to include Foundry server logs), review the resulting worlds and ensure only test worlds are cleaned. GitHub's ordinary CI checks test code but does not replace live Foundry E2E.
7. Record discrepancies with the exact compendium, document logical ID, English reference, current French text, expected correction and reproduction steps. Correct those defects in dedicated follow-up commits without altering CRD mechanics.

## Acceptance boundaries

The **1,373/1,373** status means source-bound proposals are marked `reviewed` and meet the automated structural gate. It is not a human semantic proof. The source-backed Rules Journals are selected CRD excerpts and not necessarily the full Player Guide, GM Guide or index. Feature-completeness of Foundry automation and prose completeness are separate workstreams. Do not describe this gate as full gameplay or full-CRD coverage.
