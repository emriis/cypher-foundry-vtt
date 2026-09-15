import { CYPHER } from "./config.mjs";

/**
 * Maps a character exported by the official Cypher Character Builder to this
 * system's Foundry data model.
 *
 * The Builder export uses a different data structure from this system, so the
 * importer translates source data into actor and item documents.
 */

/* -------------------------------------------- */
/* Entry point */
/* -------------------------------------------- */

/**
 * Imports Character Builder JSON and creates a corresponding PC Actor.
 *
 * @param {object} jsonData Character Builder export data.
 * @returns {Promise<Actor|null>} The created actor, or `null` when validation
 *   fails or actor creation does not succeed.
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
/* Actor data */
/* -------------------------------------------- */

export function buildActorData(jsonData) {
  const src = jsonData.system ?? {};
  const basic = src.basic ?? {};
  const pools = src.pools ?? {};
  const rawItems = Array.isArray(jsonData.items) ? jsonData.items : [];

  const wounds = parseWoundsFromNotes(src.notes ?? "");

  // The Builder's "Species" field maps to the second CRD descriptor because
  // the species trait package is mechanically equivalent to a descriptor.
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
      // The export has no equivalent of Genre, so keep all genre-dependent
      // fields available for imported values and manual adjustment.
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
/* Wounds */
/* -------------------------------------------- */

// Keep the label-to-fraction gap wide enough for checkbox placeholders while
// bounding it so a match cannot consume the following wound severity.
const WOUND_PATTERNS = {
  minor: /(?:minor|mineure?s?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i,
  moderate: /(?:moderate|mod[ée]r[ée]es?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i,
  major: /(?:major|majeures?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i
};

/**
 * Parses wound values from the export's free-form HTML notes.
 *
 * Each severity is parsed independently. A missing match falls back to the
 * configured default maximum for that severity.
 *
 * @param {string} notesHtml Raw notes HTML from the Character Builder export.
 * @returns {object} Parsed wound values keyed by severity.
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
/* Species to second descriptor */
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
/* Freely usable pseudo-skills */
/* -------------------------------------------- */

const FREELY_USE_RE = /^Freely Use\s+(.+?)\s+(Weapons?|Armor)$/i;

function isIgnoredPseudoSkill(name) {
  // Ignore the Builder's Initiative pseudo-skill because this system handles
  // initiative as a normal Speed roll.
  return /^Initiative$/i.test(name);
}

function isFreelyUseSkill(name) {
  return FREELY_USE_RE.test(name);
}

/**
 * Extracts pseudo-skills that grant free use of weapon or armor categories.
 *
 * @param {Array<object>} rawItems Character Builder item data.
 * @returns {{weaponCats: Set<string>, armorCats: Set<string>}} Free-use categories.
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
/* Skills */
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
/* Abilities */
/* -------------------------------------------- */

function mapCostStat(pool) {
  const key = String(pool ?? "").toLowerCase();
  if (key === "might" || key === "speed" || key === "intellect") return key;
  return "none";
}

/**
 * Parses an ability cost from the Builder export.
 *
 * Values such as `1+` store the base integer in the numeric field while the
 * complete source description remains available on the imported item.
 */
function parseCostAmount(cost) {
  if (typeof cost === "number") return Math.max(0, cost);
  const parsed = parseInt(String(cost ?? "0"), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

/* -------------------------------------------- */
/* Attacks */
/* -------------------------------------------- */

function mapAttackType(typeText) {
  const key = String(typeText ?? "").toLowerCase();
  if (key.includes("light")) return "light";
  if (key.includes("heavy")) return "heavy";
  return "medium";
}

const RANGED_NAME_RE = /\b(bow|arc|gun|pistol|rifle|crossbow|bolt|arrow|arbal[eè]te|fusil|blaster)\b/i;

/**
 * Resolves the stat associated with an imported attack.
 *
 * Uses the explicit Builder value when available, then a name-based ranged
 * weapon heuristic, and finally Might.
 */
function mapAttackStat(rollButtonPool, name) {
  const key = String(rollButtonPool ?? "").toLowerCase();
  if (key === "might" || key === "speed") return key;
  if (RANGED_NAME_RE.test(String(name ?? ""))) return "speed";
  return "might";
}

/* -------------------------------------------- */
/* Generic item mapping */
/* -------------------------------------------- */

/**
 * Converts Character Builder items into this system's Foundry item data.
 *
 * Supported source types are `skill`, `ability`, `equipment`, and `attack`.
 * Unsupported types are skipped and reported as warnings. Each item is
 * isolated so one malformed item does not abort the entire import.
 *
 * @param {Array<object>} rawItems Character Builder item data.
 * @param {{weaponCats: Set<string>, armorCats: Set<string>}} freely Free-use categories.
 * @returns {{items: Array<object>, warnings: Array<string>}} Mapped items and warnings.
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
              // The export does not specify the skill's linked stat; leave it
              // unset so it can be adjusted manually after import.
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
/* Import UI */
/* -------------------------------------------- */

/**
 * Opens a file picker for a Character Builder JSON export and starts the import.
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
 * Registers the Character Builder import button in the Actors directory.
 *
 * Registration is best-effort because Foundry's sidebar DOM can vary between
 * versions. The importer functions remain available to macros independently.
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
