# Référentiel terminologique et écriture inclusive — PR 5

Ce document définit la méthode éditoriale française commune aux interfaces,
aux compendiums et aux futurs Journals. Le **CRD anglais du 29 juillet 2026**
reste la seule autorité pour les mécaniques, leurs limites et les exemples.
Les décisions françaises sont identifiées par leur statut dans
`data/localization/glossary-fr.json` : **ce fichier JSON est la source
normative unique pour les termes**. Les anciennes tables des documents
d'historique restent des instantanés et n'ont pas autorité concurrente.

## Niveaux de décision

| Statut | Signification | Conséquence |
| --- | --- | --- |
| `confirmed` | Terme validé explicitement par l'utilisateur et consigné antérieurement | Ne pas modifier sans nouvelle décision |
| `established` | Usage déjà stabilisé dans l'interface ou l'historique éditorial du projet | Utilisation courante, à revalider si une décision contraire survient |
| `proposed` | Traduction de travail, non approuvée sémantiquement | Utilisable en brouillon, à faire confirmer avant finalisation |

Ces statuts de **termes** sont distincts des statuts
`translations/fr/**/…json` : un terme `confirmed` ne fait jamais passer un
document `proposed` au statut `reviewed`. Une traduction complète doit
toujours être confrontée au passage CRD intégral.

## Distinctions mécaniques incontournables

Le glossaire versionné couvre 42 entrées, dont les classifications d'action et
les familles de mécaniques principales. Il décrit explicitement leurs limites
contextuelles. Les distinctions suivantes doivent être préservées :

- **Edge = Avantage** : réduction d'une dépense dans une réserve ; ne crée pas
  de « jet avec avantage » à deux dés.
- **Asset = Atout** : facilitation d'une tâche ; ne se confond pas avec Avantage.
- **Might = Puissance**, **Speed = Célérité**, **Intellect = Intellect** :
  caractéristiques ; **Power = Pouvoir** désigne la catégorie pertinente
  d'amplificateur de puissance, **Intelligence** une autre catégorie.
- **Tier = Rang** pour la progression ordinaire, **Rank = Degré de puissance**
  dans le contexte du Type superhéros, **Level = Niveau** pour les PNJ.
- **Step = Pas** pour la difficulté ; parler d'un **degré de gravité** pour les
  blessures. Faciliter et entraver vont dans des sens opposés.
- **Effort = Effort** : distinguer les niveaux appliqués, leur coût initial,
  leur coût additionnel et le montant payé après Avantage.
- **First action = Action réflexe**, **Action = Action**, **Last action = Action lente**
  lorsqu'il s'agit de la *classe d'activation*. « Your first action in combat »
  peut simplement désigner « votre première action du combat » : ne jamais
  créer implicitement d'actions supplémentaires ou de « réactions ».
- **Enabler = Aptitude passive** : classification d'activation, qui n'implique
  ni durée infinie, ni gratuité, ni usage illimité.
- **Rally = Se reprendre**, **Focus = Focus**, **Cypher = Cypher** dans les
  contextes décrits par leur entrée. Ne pas modifier les clés techniques.

Les noms de mécaniques ne sont pas forcément des expressions à substituer dans
**toute** phrase anglaise. Par exemple « edge of the wall » ne parle pas
d'Edge, ni « action » d'une catégorie d'activation hors contexte.

## Convention inclusive et lisibilité

1. **Préférence aux tournures épicènes** : « vous », « votre personnage »,
   « la personne qui joue », « les personnages », « l'équipe », « le MJ » ;
   reformuler une instruction sans imposer un genre grammatical à la personne.
2. **Vous** pour les consignes de fiche et l'interface. Les libellés d'actions
   prennent de préférence l'infinitif ; les messages décrivent le résultat
   sans perdre le sujet, la condition, la portée ou les ressources consommées.
3. **Point médian (·) uniquement si nécessaire**, quand une expression épicène
   fidèle au CRD serait artificielle ou ambiguë. Utiliser les accords adaptés,
   éviter les parenthèses « (e) », les barres obliques de genre et l'empilement
   de points médians qui nuit à la lisibilité.
4. **Respect des personnages et exemples** : conserver tout genre explicite,
   toute identité, toute relation et tout pronom du passage anglais ; les
   heuristiques de contrôle ne justifient jamais une neutralisation qui
   changerait les faits du CRD.
5. **Respect de la mécanique** : conserver l'intégralité des coûts, maxima,
   unités, durées, prérequis, cibles, alternatives, exceptions, « seulement »,
   « à moins que », tableaux et exemples. Pas de paraphrase simplificatrice.
6. **Présentation** : ponctuation française cohérente, apostrophes
   typographiques, espaces avant la ponctuation double, majuscules modérées,
   sigles et placeholders inchangés. Conserver les balises HTML et les liens
   structurés, sans convertir les champs d'identité.
7. **Aucune inférence de règle** : un choix de vocabulaire ne doit jamais
   changer `system.key`, `logicalId`, `_id`, les enum, les UUID, les données
   mécaniques ou le comportement de Foundry.

Exemples de reformulation éditoriale (illustrations de style, **pas** de
passages cités du CRD) :

| À relire | Préférer selon le contexte |
| --- | --- |
| « Chaque joueur doit choisir… » | « Choisissez… » |
| « Le joueur qui rate son jet… » | « Si vous échouez à votre jet… » |
| « Il ou elle dépense… » | « Le personnage dépense… » |
| « Un personnage avec un avantage aux jets… » | Vérifier si le CRD parle d'un **Atout**, d'une **facilitation** ou d'**Avantage** au coût des réserves |

## Validation et contrôle humain

```bash
npm run audit:terminology
npm run check:lang
npm run audit:i18n
```

`audit:terminology` vérifie :

- l'unicité des entrées, les statuts et champs requis du glossaire ;
- les libellés mécaniques **explicitement liés à des clés d'interface** :
  un écart bloque la CI, avec la clé et le terme attendu ;
- les textes dans les 8 domaines FR de `lang/src/fr/` et les propositions
  `translations/fr/` : compte et classe les formulations potentiellement
  genrées, ainsi que certains faux amis mécaniques.

Les alertes de prose sont **informatives** et demandent une relecture humaine.
Elles ne font jamais échouer la CI pour des passages ambigus, des citations ou
des documents encore `proposed` ; seule l'incohérence d'un libellé mécanique
dont la clé est explicitement vérifiée est bloquante. Le rapport
`reports/terminology-fr.json` (ignoré par Git) est publié comme artefact
`french-terminology-review` de la CI. Il n'écrit ni dans les traductions,
ni dans les packs EN/FR, ni dans les mondes Foundry.

L'ajout d'un concept, ou la promotion de son statut, doit comporter un
contexte et une source de décision. Un simple changement d'expression dans
une proposition ne vaut ni mise à jour du glossaire, ni revue intégrale.
