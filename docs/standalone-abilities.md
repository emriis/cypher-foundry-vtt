# Standalone ability compendiums

Abilities are standalone `Item` documents in the `abilities-en` and `abilities-fr` compendiums.

Types and Foci store `DocumentUUIDField` references to these ability Items. Focus prerequisites are represented by `system.flowchart.edges`, so an ability document does not contain Focus-specific prerequisites.

Ability identity is based on the source ability ID plus its English CRD mechanics. The displayed name is not an identifier. This deliberately allows multiple mechanical variants to share a name.

The French ability pack currently uses the English CRD content as its source. A French Character Book/Notion translation is used only when its English source is confirmed identical to the CRD; otherwise the CRD English text remains in the French pack for later manual translation.

The generated `docs/ability-name-variants.json` file records source IDs which occur with more than one mechanical variant.
