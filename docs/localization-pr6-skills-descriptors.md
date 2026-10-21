# PR6 — Compétences et descripteurs (CRD EN → FR)

## Périmètre et autorité

Les **58 compétences** et **53 descripteurs**, y compris les **20 espèces**
présentes dans le CRD du 29 juillet 2026, ont été confrontés à leurs
définitions anglaises. Chaque traduction est stockée uniquement dans
`translations/fr/skills/` ou `translations/fr/descriptors/`, avec son
`sourceHash` anglais inchangé et le statut `reviewed`. La compilation
ne s'appuie jamais sur l'ancien texte de `packs/*-fr/_source/`.

Les 33 descripteurs ordinaires et les 20 espèces conservent les bonus de
Réserve, choix de compétences, avantages structurés, exceptions aux
intrusions du MJ, notes et restrictions de contexte. La traduction modifie
**uniquement** la présentation. Les mécaniques et identifiants demeurent
issus du CRD anglais normalisé.

Les autres familles ne sont **pas** approuvées en PR6 : leurs statuts,
conditions et textes devront être revus au cours des PR suivantes.

## Choix éditoriaux

- Les instructions à la deuxième personne utilisent `vous`, avec
  des formulations épicènes. Dans les libellés de descripteurs
  adjectivaux, le point médian est réservé aux adjectifs n'ayant pas de
  forme épicène fidèle au sens du CRD (`Attirant·e`, `Impétueux·se`,
  `Curieux·se`, etc.).
- L'attribution `Trained in X or Y` s'exprime en général par
  « Vous gagnez un entraînement dans l’une des compétences suivantes :
  X ou Y ». Les **options** restent des choix ; aucun entraînement
  supplémentaire n'est implicitement accordé.
- Les espèces ayant un entraînement fixe conservent ce caractère fixe.
  L'espèce **Naron** conserve indépendamment `Charme ou Tromperie`
  (choix) et `Analyse des intentions` (octroi fixe).
- `Rang`, `Réserve`, `Avantage`, `Atout`, `pas`, `degré de gravité` et
  `intrusion du MJ` suivent le lexique normatif de PR5.
- Les termes de catégories d'armes `light`, `medium` et `heavy`
  désignent des **catégories de règles**, non des poids d'équipement.
  Le type d'attaque et les conditions sont conservés dans les
  descriptions en plus des propriétés structurées.
- Les descriptions qui reprennent des exemples et encadrés anglais
  (notamment `Disguise`, `Engineering`, `Scavenging` et les notes de
  `Orc` sur les Types alternatifs, sorts et vision nocturne) restent
  complètes. PR6 ne « corrige » pas une formulation inhabituelle
  du CRD par une règle inventée.

## Coexistence des traductions

La PR3 conservait des libellés anglais dans les documents dont la
traduction n'était pas `reviewed`. À partir de PR6, une compétence
`reviewed` possède un nom français, même si un Type/Focus qui l'utilise
n'a pas encore été approuvé. Le compilateur tient donc désormais compte
du **statut du document parent** :

- parent non traduit : il garde le libellé anglais exact du CRD ;
- parent revu ou affiché en prévisualisation : ses références
  textuelles de compétences doivent correspondre **exactement** aux
  noms de compétences sélectionnés.

Cette distinction ne renomme jamais les IDs, UUID, références
structurées ou tableaux de règles.

## Contrats de validation

```bash
npm run test:content
npm run audit:i18n
npm run audit:terminology
npm run build:packs
```

Le test `tests/content/reviewed-skills-descriptors.test.mjs` vérifie les
**111 correspondances** de la famille, leur statut de revue,
leur complétude, la fidélité de leurs empreintes-source anglaises,
leur parité mécanique et la matérialisation des deux packs FR.
Il protège notamment les exemples de l'Aarak, le couple de compétences
du Naron, la perte de tour optionnelle du Stelan et les sections de
référence de l'Orc. Un autre scénario teste le mélange d'une
compétence revue et d'un descripteur encore en anglais.

Le contrôle structurel ne prouve pas, à lui seul, que toute nuance
d'une traduction est parfaite. La comparaison éditoriale avec le
texte anglais est une responsabilité distincte et n'autorise jamais
des changements de règles. Les traductions restantes sont conservées
au statut `proposed` jusqu'à leur propre revue.
