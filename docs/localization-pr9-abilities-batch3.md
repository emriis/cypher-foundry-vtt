# PR9 — Troisième lot de 175 aptitudes : préparation de la revue

## Base et limites

Cette branche a été créée **directement depuis `main` après fusion de PR8 (#146)**.
Les PR6, PR7 et PR8 ont approuvé 461 documents sur 1 373 : 111 compétences/descripteurs,
puis 350 aptitudes. Le troisième lot contient les **175 aptitudes suivantes dans
l'ordre canonique des fichiers** (indices 350 à 524 inclus sur 701 aptitudes).
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
normalisé et la parité mécanique. La sélection est déterministe à partir du
catalogue intégral et des deux manifestes verrouillés antérieurs.

**Cette préparation ne prétend pas que les 175 traductions ont été relues.**
Chaque entrée doit être confrontée manuellement au CRD anglais, y compris les
conditions, exceptions, cibles, durées, choix, exemples, tableaux et variantes.
Un statut `reviewed` exige cette vérification : le script ne promeut jamais
automatiquement un brouillon. Les familles non validées restent `proposed`,
et `--require-reviewed` doit continuer à refuser une release incomplète.

## À réaliser avant de considérer la PR9 achevée

- Examiner intégralement les 175 paires et corriger les textes français ambigus.
- Verrouiller leurs 175 identités dans un manifeste statique une fois l'examen terminé.
- Faire passer **uniquement** ces traductions contrôlées à `reviewed`.
- Ajouter les tests de règles sensibles, le contrat de 525 aptitudes revues et
  l'artefact CI de comparaison, puis valider tests, audit, build et packaging.

Aucun `_id`, UUID, coût, Effort, effet structuré ou texte anglais ne doit être modifié.
