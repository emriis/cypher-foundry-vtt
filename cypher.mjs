/**
 * Foundry VTT entry point for the Cypher system.
 *
 * Registers system configuration, custom documents, data models, sheets,
 * Handlebars helpers, world migrations, and document-level rules hooks.
 */
import { CYPHER } from "./module/config.mjs";

import * as documents from "./module/documents/_module.mjs";
import * as models from "./module/data-models/_module.mjs";
import * as sheets from "./module/sheets/_module.mjs";
import { migrateWorld } from "./module/migration.mjs";
import { importFromBuilder, openImportDialog, registerImportButton } from "./module/import.mjs";

Hooks.once("init", () => {
  console.log("Cypher | Initialisation / Initializing");

  // Exposed for macro use, even if the sidebar button fails to find its
  // anchor point on a given Foundry version.
  game.cypher = { CYPHER, importFromBuilder, openImportDialog };
  CONFIG.CYPHER = CYPHER;

  registerImportButton();

  /* -------------------------------------------- */
  /*  Document classes                              */
  /* -------------------------------------------- */
  CONFIG.Actor.documentClass = documents.CypherActor;
  CONFIG.Item.documentClass = documents.CypherItem;

  /* -------------------------------------------- */
  /*  Data models                                  */
  /* -------------------------------------------- */
  CONFIG.Actor.dataModels = {
    pc: models.CypherPCData,
    npc: models.CypherNPCData,
    community: models.CypherCommunityData
  };

  CONFIG.Item.dataModels = {
    skill: models.CypherSkillData,
    ability: models.CypherAbilityData,
    cypher: models.CypherCypherData,
    artifact: models.CypherArtifactData,
    oddity: models.CypherOddityData,
    equipment: models.CypherEquipmentData,
    armor: models.CypherArmorData,
    attack: models.CypherAttackData,
    shield: models.CypherShieldData
  };

  /* -------------------------------------------- */
  /*  Sheets                                       */
  /* -------------------------------------------- */
  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "cypher", sheets.CypherPCSheet, {
    types: ["pc"],
    makeDefault: true,
    label: "CYPHER.Sheet.PC"
  });

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "cypher", sheets.CypherNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "CYPHER.Sheet.NPC"
  });

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "cypher", sheets.CypherCommunitySheet, {
    types: ["community"],
    makeDefault: true,
    label: "CYPHER.Sheet.Community"
  });

  DocumentSheetConfig.registerSheet(foundry.documents.Item, "cypher", sheets.CypherItemSheet, {
    makeDefault: true,
    label: "CYPHER.Sheet.Item"
  });

  /* -------------------------------------------- */
  /*  World settings                               */
  /* -------------------------------------------- */
  // Stored schema version for migration; hidden from the configuration UI.
  game.settings.register("cypher", "schemaVersion", {
    scope: "world",
    config: false,
    type: String,
    default: "0.0.0"
  });

  /* -------------------------------------------- */
  /*  Handlebars helpers                           */
  /* -------------------------------------------- */
  Handlebars.registerHelper("concat", (...args) => {
    args.pop();
    return args.join("");
  });
  Handlebars.registerHelper("ifEquals", function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });
  Handlebars.registerHelper("ifNotEquals", function (a, b, options) {
    return a !== b ? options.fn(this) : options.inverse(this);
  });
  Handlebars.registerHelper("gt", (a, b) => a > b);

  /* -------------------------------------------- */
  /*  Custom status effects                        */
  /* -------------------------------------------- */
  CONFIG.statusEffects.push(
    {
      id: "hindered",
      name: "CYPHER.Wound.HinderedStatus",
      img: CYPHER.statusIcons.hindered
    },
    {
      id: "dead",
      name: "CYPHER.Wound.DeadStatus",
      img: CYPHER.statusIcons.dead
    }
  );
});

Hooks.once("ready", async () => {
  console.log("Cypher | Prêt / Ready");
  await migrateWorld();
});

/**
 * Ensures that only one armor item is equipped on an actor at a time.
 * This document-level safeguard applies regardless of which sheet changed the item.
 */
Hooks.on("updateItem", async (item, changes, options, userId) => {
  if (item.type !== "armor" || !item.actor) return;
  if (changes.system?.equipped !== true) return;
  if (userId !== game.user.id) return;

  const others = item.actor.items.filter(i => i.type === "armor" && i.id !== item.id && i.system.equipped);
  if (others.length) {
    await item.actor.updateEmbeddedDocuments("Item", others.map(i => ({ _id: i.id, "system.equipped": false })));
  }
});

/**
 * Adds a one-click XP reroll action to eligible task roll messages owned by the actor.
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const rerollable = message.getFlag("cypher", "rerollable");
  if (!rerollable) return;

  const actor = game.actors.get(message.getFlag("cypher", "actorId"));
  if (!actor?.isOwner) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cypher-reroll-button";
  button.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${game.i18n.localize("CYPHER.XP.Reroll")} (${CYPHER.xpCosts.reroll} PX)`;
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    button.disabled = true;
    await actor.rerollMessage(message);
  });

  const container = html instanceof HTMLElement ? html : html[0];
  container?.querySelector(".message-content")?.appendChild(button);
});
