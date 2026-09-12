# Cypher — Design System

## 🇫🇷 Système de conception

Ce document décrit les jetons de conception (variables CSS) définis dans `css/cypher.css`,
pensés pour être **réutilisés tels quels** dans toute nouvelle feuille, application ou
compendium du système — il suffit de rester dans le périmètre `.cypher.sheet` (ou d'étendre
cette classe à tout nouvel élément) pour hériter automatiquement de la palette, de la
typographie et des correctifs d'accessibilité.

### Pourquoi ce système existe

Un audit de l'ancienne feuille de style (couleurs codées en dur, aucun état de focus clavier,
aucune adaptation au thème sombre) a révélé plusieurs problèmes concrets d'accessibilité,
détaillés ci-dessous avec leurs corrections. Toute nouvelle interface doit repartir de ces
jetons plutôt que de coder de nouvelles couleurs en dur.

### 1. Couleurs (jetons)

Toutes les couleurs de texte ont été vérifiées avec la formule de luminance relative WCAG
(contraste minimum visé : **4.5:1** pour le texte normal, niveau AA).

| Jeton | Thème clair | Thème sombre | Usage | Contraste vérifié |
|---|---|---|---|---|
| `--cypher-color-bg-sheet` | `#fffdfa` | `#211a14` | Fond général de la fiche | — |
| `--cypher-color-bg-card` | `#f7f0e4` | `#2f2620` | Fond des blocs (stats, emplacements) | — |
| `--cypher-color-bg-card-alt` | `#e3f0e3` | `#24361f` | Fond des blocs "acheté/actif" | — |
| `--cypher-color-text` | `#2a1e14` | `#f0e6d8` | Texte principal | 16.5:1 / 13.9:1 |
| `--cypher-color-text-muted` | `#5b4a3a` | `#c2b3a0` | Texte secondaire, indices | 7.2:1 / ~9.6:1 |
| `--cypher-color-accent` | `#8a5a2c` | `#c9a15a` | Liens, icônes, bordures actives | 5.8:1 / 7.1:1 |
| `--cypher-color-success` | `#2f7a2f` | `#6fcf6f` | Réussite, gains | 5.4:1 |
| `--cypher-color-danger` | `#a11f1f` | `#ef8a8a` | Échec, suppression, blessure majeure | 7.7:1 |
| `--cypher-color-info` | `#2f5a8a` | `#8ec1f2` | Modificateurs d'armure | 7.1:1 |
| `--cypher-focus-ring` | `#2f5a8a` | `#8ec1f2` | Anneau de focus clavier | — |

**Règle d'or : ne jamais coder une couleur en dur.** Toute nouvelle règle doit utiliser
`var(--cypher-color-xxx)`, jamais une valeur hexadécimale directe — c'est ce qui permet
l'adaptation automatique au thème sombre de Foundry (classe `.theme-dark` posée par le cœur
du logiciel sur la fenêtre de la fiche).

### 2. Corrections d'accessibilité appliquées

- **Opacité remplacée par des couleurs dédiées** : les objets "épuisés" utilisaient
  `opacity: 0.5`, ce qui faisait chuter le contraste du texte à environ **3.2:1** — sous le
  seuil AA. Remplacé par `var(--cypher-color-text-muted)` (contraste garanti ≥ 7:1) combiné
  à un texte barré (signal non-coloré, redondant avec la couleur).
- **Anneau de focus clavier** : ajouté sur tous les éléments interactifs
  (`a`, `button`, `input`, `select`, `textarea`, `prose-mirror`) via `:focus-visible` —
  totalement absent auparavant, bloquant pour la navigation au clavier.
- **Cible cliquable minimale** : les icônes seules (édition, suppression, bascules +/-) ont
  désormais une zone cliquable d'au moins `28px` (`--cypher-target-size`), au lieu de la
  taille brute de l'icône FontAwesome (~14px), pour réduire les clics manqués — en particulier
  au tactile.
- **Aucune information portée uniquement par la couleur** : réussite/échec sont toujours
  accompagnés du mot "Réussite"/"Échec" ; les bannières Handicapé/Mort ont une icône
  (`fa-triangle-exclamation`/`fa-skull`) en plus de la couleur ; les blessures modérées/majeures
  ont un accent de bordure en complément du libellé textuel, jamais à sa place.
- **`prefers-reduced-motion` respecté** : toute transition/animation future est désactivée
  automatiquement si l'utilisateur a demandé la réduction des animations au niveau système.

### 3. Typographie

| Jeton | Valeur | Usage |
|---|---|---|
| `--cypher-font-family` | Signika + repli système complet | Police de toute la fiche (cohérente avec l'interface native de Foundry) |
| `--cypher-font-size-xs` | `0.72rem` | Indices, notes de bas de bloc |
| `--cypher-font-size-sm` | `0.8rem` | Texte secondaire, libellés de colonne |
| `--cypher-font-size-base` | `0.9rem` | Texte courant |
| `--cypher-font-size-md` | `1rem` | Titres de bloc (`h3`) |
| `--cypher-font-size-lg` | `1.2rem` | Valeurs de réserve (Puissance/Vitesse/Intelligence) |
| `--cypher-font-size-xl` | `1.4rem` | Nom du personnage |

Toutes les tailles sont en `rem`, donc elles suivent le réglage d'échelle de police de
l'utilisateur dans les paramètres d'accessibilité de Foundry (et du navigateur).

### 4. Espacement

Échelle à 5 crans, à utiliser systématiquement plutôt que des valeurs en pixels arbitraires :

`--cypher-space-xs` (2px) · `--cypher-space-sm` (4px) · `--cypher-space-md` (8px) ·
`--cypher-space-lg` (12px) · `--cypher-space-xl` (16px)

### 5. Comment réutiliser ce système

Pour toute nouvelle feuille (PNJ enrichie, future fiche de Suiveur, application de
compendium...) :

1. Ajoutez la classe `cypher` (et `sheet` si c'est une fiche de document) à la racine de
   l'application dans `DEFAULT_OPTIONS.classes`.
2. N'écrivez **aucune** couleur, taille de police ou espacement en dur — utilisez
   systématiquement `var(--cypher-xxx)`.
3. Pour un nouveau bloc "carte" (façon stat-block), reprenez le motif déjà établi :
   `background: var(--cypher-color-bg-card); border: 1px solid var(--cypher-color-border-faint); border-radius: var(--cypher-radius-md);`
4. Pour un nouveau bouton/icône cliquable isolé, ajoutez-le à la liste de sélecteurs de la
   règle de cible cliquable minimale (section "Accessibilité transverse" du CSS), ou reprenez
   directement `min-width/min-height: var(--cypher-target-size)`.
5. Testez visuellement votre ajout dans les deux thèmes (clair et sombre) avant de livrer —
   c'est le principal piège : une couleur qui fonctionne en clair peut devenir illisible en
   sombre si elle n'est pas passée par un jeton.

---

## 🇬🇧 Design System

This document describes the design tokens (CSS variables) defined in `css/cypher.css`,
meant to be **reused as-is** in any new sheet, application, or compendium tool in this
system — staying within the `.cypher.sheet` scope (or extending that class to any new
element) automatically inherits the palette, typography, and accessibility fixes.

### Why this system exists

An audit of the previous stylesheet (hardcoded colors, no keyboard focus state, no dark-theme
support) revealed several concrete accessibility problems, detailed below along with their
fixes. Any new interface should build from these tokens rather than hardcoding new colors.

### 1. Colors (tokens)

All text colors were verified using the WCAG relative luminance formula (target minimum
contrast: **4.5:1** for normal text, AA level).

| Token | Light theme | Dark theme | Usage | Verified contrast |
|---|---|---|---|---|
| `--cypher-color-bg-sheet` | `#fffdfa` | `#211a14` | Sheet-wide background | — |
| `--cypher-color-bg-card` | `#f7f0e4` | `#2f2620` | Card blocks (stats, slots) | — |
| `--cypher-color-bg-card-alt` | `#e3f0e3` | `#24361f` | "Bought/active" block background | — |
| `--cypher-color-text` | `#2a1e14` | `#f0e6d8` | Primary text | 16.5:1 / 13.9:1 |
| `--cypher-color-text-muted` | `#5b4a3a` | `#c2b3a0` | Secondary text, hints | 7.2:1 / ~9.6:1 |
| `--cypher-color-accent` | `#8a5a2c` | `#c9a15a` | Links, icons, active borders | 5.8:1 / 7.1:1 |
| `--cypher-color-success` | `#2f7a2f` | `#6fcf6f` | Success, gains | 5.4:1 |
| `--cypher-color-danger` | `#a11f1f` | `#ef8a8a` | Failure, delete, major wound | 7.7:1 |
| `--cypher-color-info` | `#2f5a8a` | `#8ec1f2` | Armor modifiers | 7.1:1 |
| `--cypher-focus-ring` | `#2f5a8a` | `#8ec1f2` | Keyboard focus ring | — |

**Golden rule: never hardcode a color.** Any new rule must use `var(--cypher-color-xxx)`,
never a direct hex value — this is what enables automatic adaptation to Foundry's dark theme
(the `.theme-dark` class core applies to the sheet window).

### 2. Accessibility fixes applied

- **Opacity replaced with dedicated colors**: "depleted" items used `opacity: 0.5`, dropping
  text contrast to roughly **3.2:1** — below the AA threshold. Replaced with
  `var(--cypher-color-text-muted)` (guaranteed ≥ 7:1 contrast) combined with strikethrough
  text (a non-color signal, redundant with the color).
- **Keyboard focus ring**: added to every interactive element (`a`, `button`, `input`,
  `select`, `textarea`, `prose-mirror`) via `:focus-visible` — entirely absent before,
  a blocker for keyboard navigation.
- **Minimum click target**: icon-only controls (edit, delete, +/- toggles) now have a click
  area of at least `28px` (`--cypher-target-size`), instead of the FontAwesome icon's raw size
  (~14px), reducing missed clicks — especially on touch devices.
- **No information conveyed by color alone**: success/failure are always paired with the word
  "Success"/"Failure"; the Hindered/Dead banners have an icon (`fa-triangle-exclamation`/
  `fa-skull`) in addition to color; moderate/major wounds get a border accent as a complement
  to the text label, never a replacement for it.
- **`prefers-reduced-motion` respected**: any future transition/animation is automatically
  disabled if the user has requested reduced motion at the system level.

### 3. Typography

| Token | Value | Usage |
|---|---|---|
| `--cypher-font-family` | Signika + full system fallback | Font for the whole sheet (consistent with Foundry's native UI) |
| `--cypher-font-size-xs` | `0.72rem` | Hints, block footnotes |
| `--cypher-font-size-sm` | `0.8rem` | Secondary text, column labels |
| `--cypher-font-size-base` | `0.9rem` | Body text |
| `--cypher-font-size-md` | `1rem` | Block headings (`h3`) |
| `--cypher-font-size-lg` | `1.2rem` | Pool values (Might/Speed/Intellect) |
| `--cypher-font-size-xl` | `1.4rem` | Character name |

All sizes are in `rem`, so they follow the user's font-scale setting in Foundry's (and the
browser's) accessibility settings.

### 4. Spacing

A 5-step scale, to be used consistently instead of arbitrary pixel values:

`--cypher-space-xs` (2px) · `--cypher-space-sm` (4px) · `--cypher-space-md` (8px) ·
`--cypher-space-lg` (12px) · `--cypher-space-xl` (16px)

### 5. How to reuse this system

For any new sheet (an enriched NPC sheet, a future Follower sheet, a compendium
application...):

1. Add the `cypher` class (and `sheet` if it's a document sheet) to the application's root
   in `DEFAULT_OPTIONS.classes`.
2. Write **no** hardcoded color, font size, or spacing value — always use
   `var(--cypher-xxx)`.
3. For a new "card" block (stat-block style), reuse the established pattern:
   `background: var(--cypher-color-bg-card); border: 1px solid var(--cypher-color-border-faint); border-radius: var(--cypher-radius-md);`
4. For a new standalone clickable icon/button, add it to the minimum-click-target selector
   list (the "Cross-cutting accessibility" section of the CSS), or directly reuse
   `min-width/min-height: var(--cypher-target-size)`.
5. Visually test your addition in both themes (light and dark) before shipping — that's the
   main pitfall: a color that works in light mode can become unreadable in dark mode if it
   didn't go through a token.
