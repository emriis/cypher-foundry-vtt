import { CYPHER } from "./config.mjs";

/**
 * Import d'un personnage exporté depuis le Character Builder officiel de Cypher
 * (le même format que le module Foundry tiers "cyphersystem"). La structure de
 * données de cet export est entièrement différente de celle de ce système —
 * ce fichier fait donc office de mappeur/traducteur, pas d'un simple chargement.
 *
 * Import of a character exported from the official Cypher Character Builder
 * (the same format used by the third-party Foundry module "cyphersystem").
 * That export's data structure is entirely different from this system's own —
 * this file is therefore a mapper/translator, not a simple loader.
 */

/* -------------------------------------------- */
/*  Point d'entrée / Entry point                  */
/* -------------------------------------------- */

/**
 * Importe les données JSON exportées par le Character Builder et crée un
 * nouvel Acteur PJ correspondant dans ce système.
 * Imports the JSON data exported by the Character Builder and creates a
 * matching new PC Actor in this system.
 *
 * @param {object} jsonData Le JSON tel qu'exporté par le Character Builder / The JSON as exported by the Character Builder
 * @returns {Promise<Actor|null>}
 */
export async function importFromBuilder(jsonData) {
  if (!jsonData || typeof jsonData !== "object") {
    ui.notifications.error(game.i18n.localize("CYPHER.Import.ParseError"));
    return null;
  }
  if (jsonData.type !== "pc") {
    ui.notifications.error(game.i18n.localize("CYPHER.Import.OnlyPC"));
    return null;
  }

  const rawItems = Array.isArray(jsonData.items) ? jsonData.items : [];

  const actorData = buildActorData(jsonData);
  const actor = await Actor.create(actorData);
  if (!actor) return null;

  const freely = extractFreelyUsableCategories(rawItems);
  const { items, warnings } = mapItems(rawItems, freely);

  if (items.length) await actor.createEmbeddedDocuments("Item", items);

  if (warnings.length) {
    console.warn("Cypher | Avertissements d'import / Import warnings :", warnings);
    ui.notifications.warn(game.i18n.format("CYPHER.Import.WarningsCount", { count: warnings.length }));
  }

  ui.notifications.info(game.i18n.format("CYPHER.Import.Success", { name: actor.name }));
  actor.sheet.render(true);
  return actor;
}

/* -------------------------------------------- */
/*  Données de l'acteur / Actor data              */
/* -------------------------------------------- */

export function buildActorData(jsonData) {
  const src = jsonData.system ?? {};
  const basic = src.basic ?? {};
  const pools = src.pools ?? {};
  const rawItems = Array.isArray(jsonData.items) ? jsonData.items : [];

  const wounds = parseWoundsFromNotes(src.notes ?? "");

  // Dans l'export du Character Builder, le champ "Species" correspond en réalité
  // au second descripteur du CRD (le paquet de traits qu'une espèce comme Humain
  // ou, ici, Dragonfolk confère est mécaniquement identique à un descripteur).
  // In the Character Builder export, the "Species" field actually corresponds
  // to the CRD's second descriptor (the trait package a species like Human or,
  // here, Dragonfolk grants is mechanically identical to a descriptor).
  const descriptor2 = extractSpeciesAsDescriptor(rawItems);

  const statBlock = (pool) => ({
    pool: {
      value: Number(pool?.value ?? 8),
      max: Number(pool?.max ?? 8)
    },
    edge: Number(pool?.edge ?? 0)
  });

  const freely = extractFreelyUsableCategories(rawItems);

  return {
    name: jsonData.name?.trim() || game.i18n.localize("CYPHER.Import.DefaultName"),
    type: "pc",
    system: {
      descriptor: basic.descriptor ?? "",
      type: basic.type ?? "",
      focus: basic.focus ?? "",
      // Aucun équivalent de "Genre" dans l'export : on déverrouille tous les
      // champs (Type/Foyer/Espèce/Profession/Rang) plutôt que d'en cacher qui
      // pourraient contenir des données importées. Ajustable ensuite à la main.
      // No "Genre" equivalent in the export: unlock every field (Type/Focus/
      // Species/Profession/Rank) instead of hiding any that might hold
      // imported data. Adjustable by hand afterward.
      genre: "custom",
      hasSecondDescriptor: !!descriptor2,
      descriptor2: descriptor2 ?? "",
      tier: Number(basic.tier) || 1,
      effort: Number(basic.effort) || 1,
      xp: Number(basic.xp) || 0,
      stats: {
        might: statBlock(pools.might),
        speed: statBlock(pools.speed),
        intellect: statBlock(pools.intellect)
      },
      wounds: {
        minor: wounds.minor,
        moderate: wounds.moderate,
        major: wounds.major
      },
      cypherLimit: Number(src.equipment?.cypherLimit) || 2,
      canFreelyUseAllWeapons: freely.weaponCats.size >= 3,
      canFreelyUseAllArmor: freely.armorCats.size >= 3,
      biography: src.description ?? "",
      notes: src.gmNotes ?? ""
    }
  };
}

/* -------------------------------------------- */
/*  Blessures / Wounds                            */
/* -------------------------------------------- */

// La limite entre le libellé et la fraction doit être assez large pour
// couvrir plusieurs cases à cocher ("[--] [--] [--] ..."), mais bornée pour
// ne pas déborder sur la sévérité suivante.
// The gap between the label and the fraction must be wide enough to cover
// several checkbox placeholders ("[--] [--] [--] ..."), but bounded so it
// doesn't bleed into the next severity.
const WOUND_PATTERNS = {
  minor: /(?:minor|mineure?s?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i,
  moderate: /(?:moderate|mod[ée]r[ée]es?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i,
  major: /(?:major|majeures?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i
};

/**
 * Parsing tolérant des blessures depuis le texte libre HTML des notes de
 * l'export (ex. "Minor: [--][--][--] 0/5"). Analysé sévérité par sévérité :
 * si une sévérité échoue à parser, elle retombe individuellement sur 3/0 au
 * lieu de faire échouer tout le bloc — plus robuste face aux variations de
 * mise en forme (langue, espacement, cases à cocher différentes...).
 * Tolerant parsing of wounds from the export's free HTML notes text (e.g.
 * "Minor: [--][--][--] 0/5"). Parsed severity by severity: if one severity
 * fails to parse, it individually falls back to 3/0 instead of failing the
 * whole block — more robust against formatting variation (language, spacing,
 * different checkbox styles...).
 */
export function parseWoundsFromNotes(notesHtml) {
  const text = String(notesHtml ?? "").replace(/<[^>]+>/g, " ");
  const result = {};

  for (const severity of CYPHER.woundSeverities) {
    const match = text.match(WOUND_PATTERNS[severity]);
    if (match) {
      result[severity] = { current: Number(match[1]), max: Number(match[2]) };
    } else {
      result[severity] = { current: 0, max: CYPHER.defaultWoundMax[severity] };
      console.warn(`Cypher | Import : blessures "${severity}" introuvables dans les notes, repli sur ${CYPHER.defaultWoundMax[severity]}/0.`, notesHtml);
    }
  }

  return result;
}

/* -------------------------------------------- */
/*  Espèce → second descripteur / Species → second descriptor */
/* -------------------------------------------- */

const GRANTED_FROM_RE = /Granted from ([^<]+)/i;
const GRANTED_FROM_SPECIES_RE = /Granted from Species:\s*([^<]+)/i;

export function extractSpeciesAsDescriptor(rawItems) {
  for (const item of rawItems) {
    const desc = item?.system?.description ?? "";
    const match = desc.match(GRANTED_FROM_SPECIES_RE);
    if (match) return match[1].trim();
  }
  return null;
}

function extractGrantedFrom(desc) {
  const match = String(desc ?? "").match(GRANTED_FROM_RE);
  return match ? match[1].trim() : "";
}

/* -------------------------------------------- */
/*  Compétences "Utilisation libre" / "Freely Use" pseudo-skills */
/* -------------------------------------------- */

const FREELY_USE_RE = /^Freely Use\s+(.+?)\s+(Weapons?|Armor)$/i;

function isIgnoredPseudoSkill(name) {
  // "Initiative" est exportée comme pseudo-compétence par le Character Builder ;
  // ce système n'a pas d'objet équivalent (l'initiative est un jet de Vitesse
  // classique), donc on l'ignore silencieusement plutôt que de créer un objet
  // Compétence "Initiative" qui n'aurait pas de sens ici.
  // "Initiative" is exported as a pseudo-skill by the Character Builder; this
  // system has no equivalent item (initiative is just a normal Speed roll),
  // so it's silently ignored instead of creating a nonsensical "Initiative"
  // Skill item.
  return /^Initiative$/i.test(name);
}

function isFreelyUseSkill(name) {
  return FREELY_USE_RE.test(name);
}

/**
 * Repère les pseudo-compétences "Freely Use Light/Medium/Heavy/All
 * Weapons/Armor" pour déterminer, catégorie par catégorie, quelles armes et
 * armures importées doivent être marquées "utilisable librement" (freelyUsable).
 * Finds the "Freely Use Light/Medium/Heavy/All Weapons/Armor" pseudo-skills to
 * determine, category by category, which imported weapons and armor should be
 * flagged as freely usable.
 */
export function extractFreelyUsableCategories(rawItems) {
  const weaponCats = new Set();
  const armorCats = new Set();

  for (const item of rawItems) {
    if (item?.type !== "skill") continue;
    const match = String(item.name ?? "").match(FREELY_USE_RE);
    if (!match) continue;

    const catsText = match[1].toLowerCase();
    const cats = /armor/i.test(match[2]) ? armorCats : weaponCats;

    if (/\ball\b/.test(catsText)) {
      cats.add("light"); cats.add("medium"); cats.add("heavy");
      continue;
    }
    if (/\blight\b/.test(catsText)) cats.add("light");
    if (/\bmedium\b/.test(catsText)) cats.add("medium");
    if (/\bheavy\b/.test(catsText)) cats.add("heavy");
  }

  return { weaponCats, armorCats };
}

/* -------------------------------------------- */
/*  Compétences / Skills                          */
/* -------------------------------------------- */

const SKILL_LEVEL_MAP = {
  "inability": "inability",
  "none": "none",
  "trained": "trained",
  "specialized": "specialized",
  "expert": "expert"
};

function mapSkillLevel(rating) {
  const key = String(rating ?? "trained").toLowerCase();
  return SKILL_LEVEL_MAP[key] ?? "trained";
}

/* -------------------------------------------- */
/*  Aptitudes / Abilities                         */
/* -------------------------------------------- */

function mapCostStat(pool) {
  const key = String(pool ?? "").toLowerCase();
  if (key === "might" || key === "speed" || key === "intellect") return key;
  return "none";
}

/**
 * Le coût d'une aptitude peut être exprimé "1+" dans l'export (coût de base +
 * Effort supplémentaire optionnel). Seul l'entier de base est conservé dans
 * le champ numérique ; le "+" reste visible dans le texte de description
 * (déjà complet), donc aucune information n'est réellement perdue — et cela
 * n'affecte en rien la dépense d'Effort réelle lors des jets, qui passe par
 * la boîte de dialogue de jet, indépendante de ce champ d'affichage.
 * An ability's cost can be written "1+" in the export (base cost + optional
 * extra Effort). Only the base integer is kept in the numeric field; the "+"
 * remains visible in the description text (already complete), so no real
 * information is lost — and this has no bearing on actual Effort spending
 * during rolls, which goes through the roll dialog, independent of this
 * display field.
 */
function parseCostAmount(cost) {
  if (typeof cost === "number") return Math.max(0, cost);
  const parsed = parseInt(String(cost ?? "0"), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/* -------------------------------------------- */
/*  Attaques / Attacks                            */
/* -------------------------------------------- */

function mapAttackType(typeText) {
  const key = String(typeText ?? "").toLowerCase();
  if (key.includes("light")) return "light";
  if (key.includes("heavy")) return "heavy";
  return "medium";
}

const RANGED_NAME_RE = /\b(bow|arc|gun|pistol|rifle|crossbow|bolt|arrow|arbal[eè]te|fusil|blaster)\b/i;

/**
 * L'export du Character Builder ne précise pas toujours la statistique liée
 * à une arme. Quand la donnée existe (system.settings.rollButton.pool), elle
 * est utilisée directement ; sinon, repli sur une heuristique simple basée
 * sur le nom, puis sur "Puissance" par défaut si rien ne correspond.
 * The Character Builder export doesn't always specify a weapon's linked stat.
 * When the data exists (system.settings.rollButton.pool) it's used directly;
 * otherwise, fall back to a simple name-based heuristic, then to "Might" by
 * default if nothing matches.
 */
function mapAttackStat(rollButtonPool, name) {
  const key = String(rollButtonPool ?? "").toLowerCase();
  if (key === "might" || key === "speed") return key;
  if (RANGED_NAME_RE.test(String(name ?? ""))) return "speed";
  return "might";
}

/* -------------------------------------------- */
/*  Mapping générique des objets / Generic item mapping */
/* -------------------------------------------- */

/**
 * Convertit les objets de l'export du Character Builder en objets Foundry
 * pour ce système. Chaque objet est traité indépendamment (try/catch) afin
 * qu'un objet imprévu n'interrompe pas tout l'import — il est alors ignoré et
 * signalé dans les avertissements retournés.
 *
 * Types actuellement pris en charge : skill, ability, equipment, attack.
 * Les types cypher/artifact/armor/shield/oddity ne sont pas encore mappés,
 * faute d'échantillon d'export les contenant à ce jour — ils sont ignorés
 * avec un avertissement plutôt que mappés au hasard.
 *
 * Converts the Character Builder export's items into this system's Foundry
 * items. Each item is handled independently (try/catch) so an unexpected
 * item doesn't abort the whole import — it's skipped and reported in the
 * returned warnings instead.
 *
 * Currently supported types: skill, ability, equipment, attack.
 * cypher/artifact/armor/shield/oddity types aren't mapped yet, for lack of an
 * export sample containing them so far — they're skipped with a warning
 * rather than guessed at.
 */
export function mapItems(rawItems, freely) {
  const created = [];
  const warnings = [];

  for (const item of rawItems) {
    try {
      const name = item?.name ?? game.i18n.localize("CYPHER.Item.New");
      const desc = item?.system?.description ?? "";
      const basic = item?.system?.basic ?? {};

      switch (item?.type) {
        case "skill": {
          if (isIgnoredPseudoSkill(name) || isFreelyUseSkill(name)) continue;
          created.push({
            name,
            type: "skill",
            system: {
              // L'export ne précise pas la Caractéristique liée à la compétence ;
              // "none" par défaut, à corriger à la main si besoin.
              // The export doesn't specify the skill's linked stat;
              // defaults to "none", adjust by hand if needed.
              stat: "none",
              level: mapSkillLevel(basic.rating),
              description: desc
            }
          });
          break;
        }

        case "ability": {
          created.push({
            name,
            type: "ability",
            system: {
              source: extractGrantedFrom(desc),
              tier: 1,
              enabler: false,
              cost: {
                stat: mapCostStat(basic.pool),
                amount: parseCostAmount(basic.cost)
              },
              action: "none",
              description: desc
            }
          });
          break;
        }

        case "equipment": {
          created.push({
            name,
            type: "equipment",
            system: {
              quantity: Number(basic.quantity) || 1,
              weight: "light",
              depletionDie: "none",
              description: desc
            }
          });
          break;
        }

        case "attack": {
          const attackType = mapAttackType(basic.type);
          created.push({
            name,
            type: "attack",
            system: {
              attackType,
              range: "immediate",
              damage: Number(basic.damage) || CYPHER.weaponDamage[attackType] || 2,
              stat: mapAttackStat(item.system?.settings?.rollButton?.pool, name),
              freelyUsable: freely.weaponCats.has(attackType),
              equipped: false,
              description: desc
            }
          });
          break;
        }

        default:
          warnings.push(game.i18n.format("CYPHER.Import.UnsupportedType", { name, type: item?.type ?? "?" }));
      }
    } catch (err) {
      warnings.push(game.i18n.format("CYPHER.Import.ItemFailed", { name: item?.name ?? "?", error: err.message }));
    }
  }

  return { items: created, warnings };
}

/* -------------------------------------------- */
/*  Interface : bouton + boîte de dialogue de choix de fichier            */
/*  UI: button + file-picking dialog                                      */
/* -------------------------------------------- */

/**
 * Ouvre une boîte de dialogue permettant de choisir un fichier JSON exporté
 * du Character Builder, puis lance l'import.
 * Opens a dialog to pick a JSON file exported from the Character Builder,
 * then runs the import.
 */
export async function openImportDialog() {
  const content = `
    <div class="form-group">
      <label>${game.i18n.localize("CYPHER.Import.PickFile")}</label>
      <input type="file" name="file" accept=".json,application/json"/>
    </div>
    <p class="cypher-import-hint">${game.i18n.localize("CYPHER.Import.Hint")}</p>`;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("CYPHER.Import.Title") },
    content,
    ok: {
      label: game.i18n.localize("CYPHER.Import.Button"),
      callback: async (event, button) => {
        const file = button.form.file?.files?.[0];
        if (!file) {
          ui.notifications.warn(game.i18n.localize("CYPHER.Import.NoFile"));
          return;
        }
        let jsonData;
        try {
          jsonData = JSON.parse(await file.text());
        } catch (err) {
          console.error("Cypher | Échec de la lecture du fichier d'import :", err);
          ui.notifications.error(game.i18n.localize("CYPHER.Import.ParseError"));
          return;
        }
        await importFromBuilder(jsonData);
      }
    }
  });
}

/**
 * Ajoute un bouton "Importer (Character Builder)" dans l'en-tête de la barre
 * latérale Acteurs. Best-effort : si la structure DOM de la barre latérale
 * change d'une version de Foundry à l'autre, le bouton peut ne pas apparaître
 * — dans ce cas, `game.cypher.importFromBuilder(data)` et
 * `game.cypher.openImportDialog()` restent utilisables depuis une macro.
 * Adds an "Import (Character Builder)" button to the Actors sidebar header.
 * Best-effort: if the sidebar's DOM structure changes between Foundry
 * versions, the button may not appear — in that case,
 * `game.cypher.importFromBuilder(data)` and `game.cypher.openImportDialog()`
 * remain usable from a macro.
 */
export function registerImportButton() {
  Hooks.on("renderActorDirectory", (app, html) => {
    const container = html instanceof HTMLElement ? html : html?.[0];
    if (!container || container.querySelector(".cypher-import-button")) return;

    const target = container.querySelector(".header-actions")
      ?? container.querySelector(".directory-header")
      ?? container;
    if (!target) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cypher-import-button";
    button.innerHTML = `<i class="fa-solid fa-file-import"></i> ${game.i18n.localize("CYPHER.Import.Button")}`;
    button.addEventListener("click", () => openImportDialog());
    target.appendChild(button);
  });
}
