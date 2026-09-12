# Cypher — Système Foundry VTT (non-officiel) / Unofficial Foundry VTT System

## 🇫🇷 À propos

Ce système est construit à partir du **Cypher Reference Document (CRD)** publié par
Monte Cook Games sous la **Cypher Open License** (https://col.montecookgames.com), qui autorise
la création de jeux compatibles réutilisant les règles et le contenu du CRD. Pensez à respecter
les conditions d'attribution de cette licence si vous distribuez ce système publiquement.

Ceci n'est **pas** un produit officiel de Monte Cook Games.

### Audit d'architecture (corrections appliquées)

Un audit complet a été fait contre les recommandations officielles de développement de système
Foundry VTT (V13/V14). Bugs réels trouvés et corrigés :

- **`primaryTokenAttribute`/`secondaryTokenAttribute`** dans `system.json` pointaient vers
  `pools.might`/`pools.speed`, un chemin qui n'existe pas dans le schéma réel
  (`stats.might.pool`) — les barres de jeton (vie/vitesse) ne pouvaient pas fonctionner.
- **`data-action="onEditImage"`** sur les portraits de personnage/objet — ce n'est pas le nom
  d'action réel de Foundry (`editImage`), le clic sur le portrait ne faisait donc rien.
- **Perte de données silencieuse sur les tableaux (`ArrayField`)** : les statistiques
  personnalisées, les champs libres, et les emplacements d'avancement utilisaient des champs de
  formulaire ne couvrant pas tous les sous-champs de chaque élément (ex. `id`/`label` absents).
  Comme Foundry remplace un `ArrayField` **en bloc** à chaque soumission (jamais fusionné élément
  par élément), et que la fiche soumet le formulaire entier à chaque changement
  (`submitOnChange: true`), ces champs non représentés auraient été silencieusement effacés au
  moindre autre changement sur la fiche — par exemple, un emplacement d'avancement déjà acheté
  aurait pu redevenir "non acheté". Corrigé avec des champs cachés dédiés qui préservent ces
  valeurs à chaque soumission.
- Renommage cohérent **Cypher System → Cypher** dans tout le projet (identifiant du système,
  dossier, chemins de templates, classes CSS, espace de noms des flags), suite à la mise à jour
  du nom du jeu par Monte Cook Games pour cette édition.

Limite connue : ces corrections ont été validées par relecture systématique du code et vérification
face à la documentation officielle de l'API Foundry, mais **n'ont pas été testées dans une
instance Foundry réelle**. Un premier lancement en jeu reste recommandé avant toute utilisation
en table.

### Audit comparatif face à dnd5e (référence officielle)

Le système `dnd5e` (foundryvtt/dnd5e sur GitHub) sert de référence pour les bonnes pratiques
d'architecture. Comparaison faite, adoptions retenues :

- **`compatibility.maximum` retiré** du manifeste : dnd5e ne fixe pas de plafond de version,
  pour ne pas bloquer artificiellement le système dès qu'une nouvelle version de Foundry sort
  sans incompatibilité réelle connue.
- **Flag `hotReload`** ajouté : permet à Foundry de recharger CSS/templates/langue à la volée
  pendant le développement, sans redémarrer le monde.
- **Scaffold de migration de schéma** (`module/migration.mjs`), suivant le modèle exact de
  dnd5e (version stockée par acteur, comparée à `needsMigrationVersion`/
  `compatibleMigrationVersion` du manifeste, exécutée au hook `ready`). Le schéma a déjà changé
  plusieurs fois pendant le développement (blessures, armure, artefacts) — sans ce filet, tout
  monde de jeu créé avant un futur changement de schéma garderait des données orphelines.
- **Exports groupés (`_module.mjs`)** par dossier (`data-models/`, `documents/`, `sheets/`),
  suivant le motif `import * as X from "./module/X/_module.mjs"` de dnd5e, au lieu d'importer
  chaque classe individuellement dans `cypher.mjs` — plus lisible et qui passe mieux à l'échelle
  à mesure que le système grossit.

Différences volontairement **non adoptées**, propres à un système de la taille de dnd5e et hors
de propos pour un projet de cette envergure : dossier `canvas/` (intégrations avancées de scène),
`dice/` avec sous-classes de jets dédiées, pipeline de build LESS/SCSS, système de rendu
d'enrichisseurs de texte personnalisés, et enregistrement de contenu tiers via des modules.

### Ce que contient cette V1

- Manifeste `system.json` compatible Foundry VTT **V13 et V14** (V14 vérifiée).
- Modèles de données (DataModel) pour :
  - Acteurs : Personnage joueur (PC), PNJ, Communauté
  - Objets : Compétence, Capacité, Cypher, Artefact, Curiosité, Équipement, Arme (Attaque), Armure
- Feuilles de personnage en **ApplicationV2** (le framework recommandé, AppV1 sera retiré en V16).
- Localisation complète **français / anglais** (`lang/fr.json`, `lang/en.json`) — tout le texte de
  l'interface passe par `game.i18n`, aucun texte n'est codé en dur.
- Mécaniques automatisées (conformes au CRD fourni — système par **Blessures**, pas par
  "réserve à 0") :
  - Jets de tâche complets (difficulté, pas, effort, Marge, compétences, atouts), avec les
    résultats spéciaux 1/17/18/19/20 (intrusion du MJ, bonus de dégâts, effet mineur/majeur,
    remboursement du coût au 20 naturel).
  - Coût d'Effort correct : 3 points le premier niveau, 2 points chaque niveau suivant, Marge
    déduite une seule fois sur le total.
  - **Suivi de blessures** (mineure/modérée/majeure, 3 cases chacune par défaut) avec
    débordement en cascade et handicap cumulatif (modérée pleine = -1 pas ; chaque blessure
    majeure = -1 pas supplémentaire ; 3 blessures majeures = mort), synchronisé avec des statuts
    de jeton ("Handicapé"/"Mort").
  - Armure des PJ à la bonne mécanique : facilite le Blocage / handicape l'Esquive selon la
    catégorie (légère/moyenne/lourde), avec gestion de l'utilisation libre.
  - Récupérations avec retrait de blessures selon la durée (10 min = mineures, 1h = une
    modérée, 10h = toutes les modérées).
  - Ralliement (dépense de Puissance pour retirer une blessure mineure/modérée).
  - Utilisation des cyphers en un clic, jets d'attaque avec dégâts par catégorie d'arme
    (légère 2 / moyenne 4 / lourde 6).
- **Système de conception (design system)** documenté dans [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) :
  jetons de couleur/typographie/espacement réutilisables, contrastes WCAG AA vérifiés,
  compatibilité thème clair/sombre de Foundry, anneaux de focus clavier, cibles cliquables
  minimales — à réutiliser tel quel pour toute nouvelle feuille ou application du système.

### Ce qu'il reste à faire (volontairement laissé pour la V2)

Vous avez choisi de commencer **sans compendiums**. Prochaines étapes suggérées :
1. Tester la fiche de personnage en jeu, ajuster le layout/CSS selon vos goûts.
2. Une fois la base validée, on pourra construire les **compendiums bilingues** (Types, Foyers,
   Descripteurs, Capacités, Créatures, Cyphers, Artefacts...) à partir du CRD, avec une paire de
   packs EN/FR par catégorie (ex. `types-fr`, `types-en`), en respectant la Cypher Open License.
3. Ajouter des macros compendium pour automatiser des actions répétitives (application de dégâts
   de groupe, gestion des intrusions du MJ, etc.).
4. Ajouter une feuille PNJ dédiée avec calcul automatique du nombre cible (niveau × 3).

### Installation locale (pour tester)

1. Copiez le dossier `cypher` dans le dossier `Data/systems/` de vos données utilisateur
   Foundry VTT.
2. Lancez Foundry VTT (V13 ou V14), créez un monde avec le système "Cypher".
3. Dans les paramètres du monde, choisissez la langue Français ou English.

---

## 🇬🇧 About

This system is built from the **Cypher Reference Document (CRD)** published by Monte Cook Games
under the **Cypher Open License** (https://col.montecookgames.com), which permits building
compatible games that reuse CRD rules and content. Follow that license's attribution requirements
if you distribute this system publicly.

This is **not** an official Monte Cook Games product.

### What's in this V1

- `system.json` manifest compatible with Foundry VTT **V13 and V14** (verified against V14).
- DataModels for PC/NPC/Community actors and Skill/Ability/Cypher/Artifact/Oddity/Equipment/
  Attack/Armor items.
- **ApplicationV2** character sheets (the recommended framework going forward).
- Full **French/English** localization — no hardcoded UI strings.
- Automated mechanics matching the actual CRD rules — a **Wound**-based system, not a
  "pool hits 0" damage track:
  - Full task rolls (difficulty, steps, Effort, Edge, skills, assets), with special results on
    natural 1/17/18/19/20 (GM intrusion, damage bonus, minor/major effect, cost refund on a
    natural 20).
  - Correct Effort cost: 3 points for the first level, 2 for each additional level, Edge
    discounted once on the total.
  - **Wound tracking** (minor/moderate/major, 3 boxes each by default) with cascading overflow
    and stacking hindrance (moderate full = -1 step; each major wound = another -1 step; 3 major
    wounds = death), synced to token statuses ("Hindered"/"Dead").
  - PC armor using the correct mechanic: eases Block / hinders Dodge by category
    (light/medium/heavy), accounting for freely-usable armor.
  - Recoveries that remove wounds based on duration (10 min = minors, 1 hour = one moderate,
    10 hours = all moderates).
  - Rallying (spend Might to remove a minor/moderate wound).
  - One-click cypher use, attack rolls with damage by weapon category (light 2/medium 4/heavy 6).
- Optional **second descriptor** and **second focus** fields (CRD-sanctioned via the Human
  species option and the "Second Focus" superhero advancement) — hidden by default, added/removed
  with a "+"/"-" toggle on the header.
- **Custom stats**: add any number of additional Pool/Edge stats beyond Might/Speed/Intellect
  (e.g. Luck, Faith, Willpower for a homebrew genre). They work in task rolls exactly like the
  three core stats (Effort, Edge discount, wound hindrance all apply the same way).
- **Resource Points** tracker in the header, per the CRD's advancement/goals rules.
- **Genre-aware character creation**, matching the CRD's actual per-genre rules:
  - A **Genre** selector (Real World / Fantasy / Sci-Fi / Superhero / Unspecified) drives which
    fields the header shows.
  - **Real World**: no Type/Focus — the sheet switches to **Descriptor + Profession**, per the
    CRD ("the main thing that makes a character a real-world character is you don't start with a
    focus"). A hint reminds the GM/player of the default inability with medium/heavy weapons.
  - **Fantasy / Sci-Fi**: standard Descriptor+Type+Focus line, plus an optional **Species**
    field (Human, Elf, Cyborg, etc. — left blank by the system, populate however your table likes).
  - **Superhero**: adds **Rank (1-5)** and **Power Shifts** (12 CRD categories — Accuracy,
    Dexterity, Strength, etc. — each capped at 3, exactly as written: "no more than three in any
    one category"). Superhero characters can also **rally to remove a major wound** (10 Might,
    correctly gated to this genre only — every other genre still can't), and task difficulty in
    the roll dialog goes up to **15** instead of 10, per the "impossible tasks" rule for this genre.
  - **Custom (all fields)**: a fifth genre option that unlocks every genre-specific field at
    once — Type/Focus, Species, Profession, and the Rank/Power Shifts block all become visible
    together, so you can freely mix and match whichever pieces fit your own character concept.
- **Custom Fields**: an open-ended list, independent of genre, for adding literally anything the
  system doesn't already model — a text field, a number field, or a checkbox, each with your own
  label (e.g. "Reputation", "Debt", "Ally", "Radiation Level"...). Add or remove as many as you like.
- **Full XP economy** (a new **Advancement** tab), matching the CRD:
  - **Reroll (1 XP)**: a button appears under any task/attack roll in chat, right after the roll —
    spends 1 XP and posts the better of the original and new d20.
  - **Player Intrusion (1 XP)**: a button + prompt to describe how the situation is altered in the
    character's favor, posted to chat.
  - **Lucky Shot (1 XP)**: available directly in the attack roll dialog — attacks blind, hindered
    by 4 steps automatically.
  - **Full character advancement**: 4 slots per tier (Increasing Capabilities / Moving Toward
    Perfection / Extra Effort / Skill, or an "Other" substitute — Recovery/Focus/Armor/Weapons/
    Genre), each costing 4 XP. Buying a slot applies its mechanical effect automatically (Pool
    distribution dialog, Edge+1 on a chosen stat, Effort+1 capped at 6, upgrading or adding a
    Skill item, etc.) and grants a Resource Point. Once all 4 slots are bought, the character
    **automatically advances a tier**, the slots reset, and a chat message reminds about the free
    Focus ability (and Genre ability at tiers 3/6/9...).
  - Weapon proficiency is now tracked (`freelyUsable` on Attack items): an unfamiliar weapon
    hinders the attack by 1 step, unless the "Other: Weapons" advancement was bought.
  - Recovery rolls now include any permanent recovery bonus from advancement.
- **Block & Dodge**, matching the CRD's actual wording ("blocking an attack (a Might task),
  dodging an attack (a Speed task)"):
  - Two buttons next to Armor — **Block** (Might, eased by the worn armor's category) and
    **Dodge** (Speed, hindered by it) — open the usual roll dialog plus a dropdown for the
    incoming wound's severity (set by the GM based on the attacker).
  - A **successful Block reduces the wound's severity by one step** (major→moderate→minor→none);
    a **successful Dodge avoids the wound entirely**; a **failed defense inflicts the wound
    as-is**. This is applied automatically to the Wounds track.
  - Built on top of the same roll engine as every other task, so Effort, Edge, assets, special
    results (17-20), and the chat reroll button all work identically for defense rolls.
- **Shields**, matching the CRD's dedicated "Armor and Shields" rules:
  - A new **Shield** item type, usable by any character regardless of Type (unlike armor).
  - Shields have their **own wound track** — 3 minor / 2 moderate / 1 major by default, distinct
    from the character's own wounds — with the same cascading overflow logic.
  - On a **successful Block**, the roll dialog lets you choose an equipped, unbroken shield: if
    selected, the shield **absorbs the entire wound** instead of the usual one-step reduction.
    A shield taking its major wound is automatically marked **broken** and stops protecting.
- **Damageable armor**, per the CRD's exact wording ("reducing how much it eases your block
  tasks (but not affecting how much it hinders your dodge tasks)"):
  - A **Damage (GM intrusion)** button next to Armor reduces its Block-easing bonus by 1 step
    per click, capped so it can't go below 0. The **Dodge hindrance is never touched**, matching
    the asymmetry the CRD specifies.
  - A damaged-armor banner appears on the sheet, and the effective Block bonus is shown alongside
    the original base value.
  - A **Repair Armor** button (with confirmation) clears all accumulated damage.
- **Bugfix**: an unfamiliar armor's Speed hindrance (per the CRD: "it hinders all your Speed
  tasks") was computed but never actually subtracted from anything except explicit Dodge rolls.
  It's now correctly applied to every Speed-stat task roll (Dodge excluded to avoid double-
  counting, since Dodge already folds it in directly).
- **Artifact depletion rolls**, per the CRD's actual mechanic ("you roll the die in the depletion
  stat... if your roll is in the depletion range... that is its last use"):
  - Artifacts (and optionally Equipment, for CRD items like a medical bag or aspirin that use
    depletion instead of a fixed quantity) now have a structured **depletion die + threshold**
    instead of free text, plus a **Depletion Roll** button (🎲) in the inventory.
  - Rolling it always lets the item work this use; if the roll falls at or under the threshold,
    the item is marked **depleted** for future uses.
  - The chat reroll button (1 XP) works on depletion rolls too, per the CRD's explicit mention
    that XP can reroll "a recovery or an artifact depletion roll."
- **Unified armor**: the actor-level "active armor" state and the Armor items in inventory are
  no longer two disconnected things. The character's armor (category, Block/Dodge modifiers,
  and damage) is now **fully derived from whichever Armor item is checked "Equipped"** in
  inventory — there's nothing left to edit redundantly on the Main tab, just a live summary.
  Damage to the Block bonus now lives on the Armor item itself (so switching armor also switches
  its damage state, which makes sense — a fresh suit of armor isn't dented just because your old
  one was). Only one Armor item can be Equipped at a time: checking one automatically unequips
  any other, enforced both from the sheet and at the document level (so it holds even if you
  toggle "Equipped" directly from an Armor item's own sheet).
- **Design system** documented in [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md): reusable color/
  typography/spacing tokens, WCAG AA-verified contrast, Foundry light/dark theme compatibility,
  keyboard focus rings, minimum click targets — reuse as-is for any new sheet or application in
  this system.

### Suggested next steps

See the French section above — same roadmap: playtest the sheet, then build bilingual
compendium pairs (Types, Foci, Descriptors, Abilities, Creatures, Cyphers, Artifacts...) under the
Cypher Open License, add automation macros, and a dedicated NPC sheet.
