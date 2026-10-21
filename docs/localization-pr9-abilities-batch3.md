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

## Clauses et variantes surveillées

- `Infer Thoughts` : cible de niveau 4 ou moins, lecture sans jet, perception
  continue seulement tant qu'elle est visible et audible, Effort sur le plafond.
- `Inspire Action` et `Inspiring Performance` : action supplémentaire de
  l'allié distincte d'une action normale ; nombre d'alliés, Effort, durée de
  concentration et bonus de récupération de la prestation conservés.
- `Inspiring Ease` et `Master Entertainer` : récupération de dix heures,
  suspension avec la distance, une ou deux tâches facilitées selon l'aptitude.
- `Moon Shape` : condition lunaire, réserves, Avantages, intrusion du MJ,
  retour à la normale et pénalités de faim distincts.
- `Mind Reading`, `Machine Companion`, `Jump Attack`, `Prepare Spell`,
  `Quarry`, `No Need for Weapons` : variantes indépendantes conservées.
- `Onslaught`, `Magnetize`, `Psychokinetic Attack`, `Recompile Machine` :
  modes alternatifs, dommages, portées, plafonds et jets distincts.
- `Resonant Palm` : lien de dix jours, un transfert de blessure sans réduction
  ou une attaque à distance, et rupture du lien après utilisation.

## Contrôles et limites

La CI vérifie le manifeste, la complétude des champs, la fraîcheur des empreintes,
la parité des données structurées, les 525 aptitudes au statut `reviewed`, les
111 entrées antérieures, les 737 propositions restantes, les règles sensibles
et la génération des artefacts. Le rapport CI est conservé pour une relecture
indépendante. La validation d'une traduction reste une décision éditoriale :
aucun automate ne peut démontrer à lui seul l'identité complète du sens.


Aucun `_id`, UUID, coût, Effort, effet structuré ou texte anglais ne doit être modifié.
