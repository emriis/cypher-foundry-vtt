# PR8 — Revue des aptitudes, deuxième lot (175 documents)

## Autorité, inventaire et état

- Source de référence : **Cypher Reference Document anglais du 29 juillet 2026**.
- Périmètre : les **175 aptitudes** dont les identités canoniques vont de
  `ability.drain-life` à `ability.incredible-velocity`, recensées dans
  [le manifeste immuable](../data/localization/ability-review-batch-2.json).
- Les **175 textes éditoriaux** de `translations/fr/abilities/a-l/` ont
  été comparés champ par champ avec les descriptions et la mécanique
  anglaises avant le passage au statut `reviewed`.
- Les **175 traductions de PR7**, les **58 compétences** et les
  **53 descripteurs/espèces** restent `reviewed` : **461 documents
  français validés sur 1 373** (33,6 %).
- Les **351 aptitudes restantes** et les **561 autres entrées**
  demeurent en attente de leur propre revue. La compilation stricte
  `--require-reviewed` reste bloquante tant que l'inventaire complet
  n'a pas été validé.

Les champs de règle structurés demeurent canoniques : aucun changement de
`logicalId`, `_id`, rang, coût, Effort, famille d'arme, catégorie
d'action, effet, UUID ou dépendance. Les deux versions de chaque
entrée conservent les mêmes identifiants. Le texte français n'est
jamais repris de `packs/*-fr/_source/`.

## Vérification et provenance

```bash
npm run audit:abilities-pr8
npm run audit:i18n
npm run audit:terminology
npm run test:content
npm run build:packs
```

Le script `scripts/audit-ability-batch-2.mjs` crée une copie
temporaire normalisée, vérifie les paires EN/FR et produit le rapport
`reports/ability-review-batch-2.json`. Celui-ci contient les textes
anglais et français complets, leurs empreintes source, les coûts,
les actions, les rangs et des indices des clauses à contrôler.
La CI publie l'artefact `pr8-abilities-comparative-review`.
L'option `--print-pairs` expose les 175 comparaisons complètes
lorsque la relecture détaillée est nécessaire.

L'audit initial a relevé **42 documents signalés et 47 avertissements**
de formulation. Un détecteur lexical peut signaler un terme hors
contexte, tel que `for` ou `if`, sans qu'il y ait de problème
dans la traduction. Tous les documents du lot ont été comparés ;
ces avertissements sont des pistes de contrôle, non une preuve
de fidélité ou d'omission.

## Détails et exceptions des règles conservés

- **Earthshake** : première variante avec dégâts 6, ou 3 même en
  cas d'échec, sur des jets distincts ; seconde variante avec dégâts
  7 ou 13 sans jet et une action lente.
- **Dual Wield** : l'attaque supplémentaire et son incompatibilité
  avec la séquence « action réflexe puis action » restent explicites.
- **Effort** : variantes distinctes et limites d'Effort inchangées,
  y compris les coûts supplémentaires et les restrictions
  de *Bad Medicine*.
- **Expert Combatant** : l'accès à la spécialisation au rang 2 et
  au niveau expert au rang 6 ne confère pas automatiquement la
  compétence. L'avancement normal demeure obligatoire.
- **Flamboyant Swordplay / Gut Ripper** : les deux choix d'effet,
  la perte éventuelle de dégâts et la plage d'intrusion du MJ
  sont préservés, sans modification de leurs valeurs.
- **Font of Healing / Recovery, Healing Hand** : distinction
  entre soins de blessures, récupération de Réserve, coûts
  croissants, délai de renouvellement et exception de Santé
  du PNJ propre à une variante de `Healing Hand`.
- **Idol** : rituel, épuisement `1–2 sur 1d6`, invocation de
  *Bestial Fury*, blessures supplémentaires, guérison et
  suppression des affections spirituelles jusqu'au niveau 5.
- **HUD** : vision, trois modes alternatifs, niveaux d'Effort
  requis et matériaux traversés selon leur niveau.
- **Improved Machine Companion** : conserver distinctes la
  variante qui permet de garder un compagnon de niveau inférieur,
  et celle qui mentionne explicitement un compagnon de niveau 3.
- **Improved Apportation** : le tableau aléatoire anglais et
  ses résultats de niveaux 3, 4 et 5 sont reproduits tels quels,
  sans chercher à réinterpréter le plafond de la description.
- **Incredible Velocity** : séquence d'actions, entraves et
  vitesse maximale sont inchangées.
- **Grandiose Illusion, Granite Wall, Gargantuan** : tailles,
  portées, protections, restrictions, concentrations et niveaux
  d'Effort sont conservés.

Les distinctions ci-dessus sont notamment protégées par
`tests/content/reviewed-abilities-pr8-rules.test.mjs`.
Le contrat `tests/content/reviewed-ability-batch-2.test.mjs`
vérifie les **350 documents des PR7+PR8**, la conservation de
la revue PR6, l'intégrité des champs, des empreintes et de
la compilation. Le contrat historique PR7 a été rendu
compatible avec l'approbation de lots supplémentaires, sans
autoriser une régression des 175 approbations de PR7.

## Corrections éditoriales

Après comparaison des passages EN/FR :

- **Go for the Eyes** : `gouging` (blesser/griffer un œil)
  ne doit pas être transformé en « arracher l'œil » ;
  correction explicite.
- **Gentle Warmth** : `up to 30°F (15°C) warmer` décrit
  **une augmentation de température**, non une température finale.
- **Expert** et **Flex Skill** : reformulation des bénéfices
  d'entraînement et de spécialisation avec un vocabulaire neutre
  sans modifier le rang ou le prérequis.
- **Font of Healing / Font of Recovery**, **Healing Beacon**,
  **Endurance**, **Incredible Health** et **Improved Follower** :
  précision de la terminologie des bénéficiaires, de la
  récupération, de la Santé et des modifications de compagnons.
- **Fire Servant**, **Ice Armor**, **Idol** : précision
  des sujets d'action et des conditions de proximité, avec
  conservation stricte des chiffres et choix du CRD.

## Portée de l'acceptation

La certification de ce lot concerne le contenu éditorial et
la préservation des mécanismes structurés, **pas** l'exécution
automatique de chaque effet dans Foundry. Les autres Types,
Focus, équipements, cyphers et Journals attendent leurs
lots de traduction. Les noms de Types/Focus mentionnés
dans certaines aptitudes seront confrontés à leurs propres
traductions pendant la PR11.

La PR suivante repartira de `main` **après fusion de PR8**
et traitera le lot 3 des aptitudes.
