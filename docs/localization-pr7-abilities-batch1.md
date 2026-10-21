# PR7 — Revue française des 175 premières aptitudes du CRD

## Périmètre, source et statut

Première des quatre vagues de revue des aptitudes du **Cypher Reference
Document anglais du 29 juillet 2026**.

- **175 aptitudes sur 701**, de `ability.a-bit-of-magic` à
  `ability.divine-radiance` inclus, dans l'ordre canonique du
  [manifeste de revue](../data/localization/ability-review-batch-1.json).
- **175 propositions éditoriales** sont désormais `reviewed` après
  confrontation de leurs champs anglais et français.
- **526 autres aptitudes** restent `proposed` et sont réservées aux
  PR 8 à 10. Les 58 compétences et 53 descripteurs validés en PR6
  restent `reviewed`.
- **286 documents sur 1 373** sont donc validés éditorialement.
  Le mode de publication `--require-reviewed` reste volontairement fermé
  jusqu'à la fin de toutes les familles.

L'autorité sur les règles demeure le CRD anglais. Tous les textes français
se trouvent exclusivement dans `translations/fr/abilities/a-l/`. Les
`sourceHash` de chaque champ, `logicalId`, `_id`, UUID, rangs, coûts
structurés, prérequis et effets ne sont pas modifiés par la revue.

## Méthode et traçabilité

```bash
npm run audit:abilities-pr7
npm run audit:i18n
npm run audit:terminology
npm run test:content
npm run build:packs
```

`scripts/audit-ability-batch-1.mjs` normalise EN/FR dans un checkout
jetable, apparie les 175 identités du manifeste, valide l'inventaire
des champs, les empreintes source, les expressions numériques,
la structure des tableaux/HTML et la parité des champs mécaniques.
Il enregistre sous `reports/ability-review-batch-1.json`
les **textes complets anglais et français face à face**, leur provenance,
leurs coûts et les avertissements de clauses à vérifier. Cet artefact,
`pr7-abilities-comparative-review`, est disponible depuis la CI.
L'option locale `--print-pairs` permet d'imprimer les paires complètes
pour un contrôle éditorial ciblé sans altérer les sources.

Le premier audit a relevé **42 aptitudes avec 51 alertes indicatives**.
Le détecteur signale intentionnellement certaines prépositions anglaises
comme `for` (qui n'expriment pas nécessairement une durée) ou des
conditions rendues implicitement en français. Il sert à orienter une
relecture humaine, **pas** à déclarer qu'une règle manque ou qu'une
traduction est approuvée. La comparaison des 175 textes a également
vérifié les passages sans alerte.

## Distinctions de règles préservées

- **A Bit of Magic** : le choix des cyphers à faible/moyenne puissance,
  les dépenses en Intellect (3, 5 et 7), le changement à la récupération
  de dix heures et l'accès à la puissance avancée au rang 6.
- **Arc Spray** : deux entrées de rang et d'origine distincts ;
  chaque attaque est résolue séparément contre trois cibles adjacentes.
- **Basic Necromancy** : deux variantes contradictoires en apparence
  conservent leurs limitations respectives concernant la réanimation
  après destruction et les corps déjà animés ; elles ne sont jamais
  regroupées sous un même identifiant.
- **Danger Instinct** : une variante prévoit le déplacement automatique ;
  l'autre permet de choisir de se déplacer.
- **Defend and Respond** : la limite d'une activation **par tour**
  est distincte de celle d'une activation **par round**.
- **Animal Shape / Beast Form** : transformations, formes hybrides,
  handicaps, bonus de caractéristiques, capacités de parole,
  restrictions d'Intellect et règles de récupération restent complets.
- **Automaton** : les différentes améliorations conservent leurs actions,
  catégories d'armure, Santé, dégâts, portée, durées et règles de combat.
- **Divine Radiance** : deux options structurées (`Blessing` et
  `Turn Undead`), leurs textes, leur Effort et les limites au rang 3
  sont tous conservés. Les attaques supplémentaires demandent toujours
  des actions supplémentaires distinctes.
- **Craft Device / Control Electric Device / Colossal** :
  épuisement `1 sur 1d6`, tests de sécurité/portée,
  blessures ignorées, cibles qui touchent automatiquement et
  limites d'Effort restent tels que spécifiés.

Ces cas font l'objet de tests ciblés dans
`tests/content/reviewed-abilities-pr7-rules.test.mjs`. Le contrat
`tests/content/reviewed-ability-batch-1.test.mjs` protège en outre
les 175 identités, les 526 non validées, la parité mécanique, les
descriptions complètes et les 111 traductions approuvées en PR6.

## Corrections de rédaction, sans changement de mécanique

Les principaux ajustements portent sur :

- les **expressions épicènes** dans les textes et intitulés :
  `Instinct de pilotage`, `Conception dédiée au piratage`,
  `Tactiques déloyales`, ainsi que des formulations neutres pour les
  attaques par surprise, les talents et les personnages alliés ;
- le terme « avantage » dans un contexte de **surprise**,
  remplacé par un bénéfice non mécanique, afin de ne pas confondre
  cette expression courante avec l'`Avantage` (`Edge`)
  défini par le glossaire ;
- **Cool Water**, qui fournit uniquement de l'eau potable en
  quantité suffisante pour cinq créatures pendant une journée :
  il ne procure pas automatiquement la nourriture ou d'autres
  ressources ;
- des formulations de **récupération de Réserve** et des
  localisations d'unités (`3,5 m` au lieu de `3.5 m`) ;
- les descriptions des effets de **Divine Radiance**
  et des aptitudes de données.

Aucune capacité n'est introduite ni supprimée, aucune relance
supplémentaire, coût, difficulté, catégorie de projectile ou condition
n'est inventé.

## Limites et prochain lot

Les noms des Focus et des Types cités dans la prose de certaines
aptitudes doivent encore être harmonisés avec leurs propres traductions
lors de PR11. Ne pas en déduire que leurs textes sont approuvés dès PR7.
Le chantier des mécanismes exécutables dans Foundry est indépendant de
la revue éditoriale. La CI couvre la structure, la compilation et le
texte ; elle ne remplace pas les tests E2E dans une instance réelle
Foundry v14.

**PR8** reprendra depuis le `main` fusionné et poursuivra
le manifeste des aptitudes restantes, sans rouvrir ni modifier
les identifiants canoniques de PR7.
