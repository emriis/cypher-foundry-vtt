# PR9 — Troisième lot de 175 aptitudes : intégration et contrôles

## Base et limites

Cette branche a été créée **directement depuis `main` après fusion de PR8 (#146)**.
Les PR6, PR7 et PR8 ont approuvé 461 documents sur 1 373 : 111 compétences/descripteurs,
puis 350 aptitudes. Le troisième lot contient les **175 aptitudes suivantes dans
l'ordre canonique des fichiers** (indices 350 à 524 inclus sur 701 aptitudes),
soit de `ability.infer-thoughts` à `ability.resonant-palm`.
Le fichier immuable [`data/localization/ability-review-batch-3.json`](../data/localization/ability-review-batch-3.json)
verrouille explicitement ces 175 identités. L'audit échoue si cet inventaire diverge.
Les variantes distinctes de même nom restent des documents indépendants.

## Outillage de vérification

```bash
npm run audit:abilities-pr9
npm run audit:abilities-pr9 -- --print-pairs
npm run test:content
npm run audit:i18n
```

Le rapport `reports/ability-review-batch-3.json` produit les noms, identités,
versions intégrales des champs EN/FR, coûts, prérequis, rangs, actions, empreintes
et alertes de revue. Le script vérifie la correspondance avec le texte source
normalisé et la parité mécanique. La sélection est vérifiée contre le catalogue intégral et les deux
manifestes verrouillés antérieurs, puis confrontée au nouveau manifeste
statique PR9. Le workflow CI publie le rapport complet dans
l'artefact `pr9-abilities-comparative-review`.

**Statut éditorial des fichiers :** les 175 propositions du troisième lot sont
maintenant marquées `reviewed`. Les contrôles automatisés démontrent la cohérence
structurelle et les empreintes de source, mais ne constituent pas une preuve
d'une relecture sémantique exhaustive. La confrontation humaine de toutes les
clauses demeure un contrôle qualité indépendant. Le total est 636/1 373
entrées marquées `reviewed` ; les 737 restantes sont `proposed` et
`--require-reviewed` doit toujours refuser une release incomplète.

## Acceptation et limites

- Manifeste des 175 identités, audit bilingue, tests des variantes, contrat
  de 525 aptitudes approuvées et artefact CI intégrés.
- Révision sémantique intégrale EN/FR restant à démontrer avant de revendiquer
  une qualité de traduction équivalente à celle des PR7 et PR8.
- CI, audit, build et packaging doivent être verts avant toute fusion.

Aucun `_id`, UUID, coût, Effort, effet structuré ou texte anglais ne doit être modifié.
