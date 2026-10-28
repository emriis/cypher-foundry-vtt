import { refreshFollowerOwnerSheet } from "./module/sheets/follower-dialogs.mjs";
import * as speciesBenefitService from "./module/applications/species-benefit-service.mjs";
import * as followerService from "./module/applications/follower-service.mjs";
import * as followerAbilityService from "./module/applications/follower-ability-service.mjs";
import * as cypherInventoryService from "./module/applications/cypher-inventory-service.mjs";
import * as cypherGenerationService from "./module/applications/cypher-generation-service.mjs";
import * as projectService from "./module/applications/project-service.mjs";
import { refreshProjectSheets } from "./module/sheets/project-dialogs.mjs";
import * as objectService from "./module/applications/object-service.mjs";
import { renderTaskRetryControls } from "./module/sheets/task-retry-controls.mjs";
import * as taskRetryService from "./module/applications/task-retry-service.mjs";

import { renderIntrusionControls } from "./module/sheets/intrusion-dialogs.mjs";
import * as intrusionService from "./module/applications/intrusion-service.mjs";
import { attachRoundControls, refreshRoundPanels, closeRoundPanel } from "./module/sheets/round-flow-panel.mjs";
/**
 * Foundry VTT entry point for the Cypher system.
 *
 * Registers system configuration, custom documents, data models, sheets,
 * Handlebars helpers, world migrations, and document-level rules hooks.
 *
 * The other modules own the details: data models define saved fields,
 * documents implement rules, and sheets connect player actions to those rules.
 * This file is the wiring layer that tells Foundry which implementation to use.
 */
import { CYPHER } from "./module/config.mjs";
import { promptRecoveryAllocation } from "./module/sheets/healing-dialogs.mjs";
import { resolveDocumentReference } from "./module/applications/reference-resolver.mjs";

import * as documents from "./module/documents/_module.mjs";
import * as models from "./module/data-models/_module.mjs";
import * as sheets from "./module/sheets/_module.mjs";
import { importFromBuilder, openImportDialog, registerImportButton } from "./module/import.mjs";
import { enforceSingleEquippedArmor } from "./module/applications/equipment-service.mjs";
import { stampDefenseRevisions } from "./module/applications/defense-history.mjs";
import { stampAttackHealthRevision } from "./module/applications/attack-history.mjs";
import { promptSpecialEffect, promptInitiativeOptions } from "./module/sheets/dialogs.mjs";
import { skipUnyieldingShieldTurn } from "./module/applications/shield-lifecycle-service.mjs";
import { enforceSpecialDamageHealing } from "./module/applications/special-damage-healing.mjs";
import { stampGeneralTurnRevision } from "./module/applications/general-effect-service.mjs";

Hooks.on("updateCombat", skipUnyieldingShieldTurn);

// Persist attribution invalidation with the same healing/manual Actor update.
Hooks.on("preUpdateActor", stampDefenseRevisions);
Hooks.on("preUpdateActor", stampAttackHealthRevision);
Hooks.on("preUpdateActor", objectService.stampObjectRevision);
Hooks.on("preUpdateActor", enforceSpecialDamageHealing);
Hooks.on("preUpdateCombat", stampGeneralTurnRevision);

Hooks.on("updateWorldTime", refreshProjectSheets);

Hooks.once("init", () => {
  console.log("Cypher | Initialisation / Initializing");

  // Publish shared configuration and macro entry points before sheets are opened.
  // Exposed for macro use, even if the sidebar button fails to find its
  // anchor point on a given Foundry version.
  game.cypher = { speciesBenefits: speciesBenefitService, followers: { ...followerService, ...followerAbilityService }, cyphers: { ...cypherInventoryService, ...cypherGenerationService }, CYPHER, importFromBuilder, openImportDialog, promptInitiativeOptions, objects: objectService, projects: projectService, taskRetries: taskRetryService, intrusions: intrusionService };
  CONFIG.CYPHER = CYPHER;

  registerImportButton();

  // Replace Foundry's generic Actor and Item documents with the system versions.
  /* -------------------------------------------- */
  /*  Document classes                              */
  /* -------------------------------------------- */
  CONFIG.Actor.documentClass = documents.CypherActor;
  CONFIG.Item.documentClass = documents.CypherItem;
  CONFIG.Combat.documentClass = documents.CypherCombat;

  /* -------------------------------------------- */
  /*  Data models                                  */
  /* -------------------------------------------- */
  CONFIG.Actor.dataModels = {
    pc: models.CypherPCData,
    npc: models.CypherNPCData,
    object: models.CypherObjectData,
    community: models.CypherCommunityData
  };

  CONFIG.Item.dataModels = {
    skill: models.CypherSkillData,
    ability: models.CypherAbilityData,
    cypher: models.CypherCypherData,
    artifact: models.CypherArtifactData,
    equipment: models.CypherEquipmentData,
    armor: models.CypherArmorData,
    attack: models.CypherAttackData,
    shield: models.CypherShieldData,
    descriptor: models.CypherDescriptorData,
    type: models.CypherTypeData,
    focus: models.CypherFocusData
  };

  /* -------------------------------------------- */
  /*  Sheets                                       */
  /* -------------------------------------------- */
  // A sheet is the user interface for one document type; each actor type gets its own layout.
  const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "cypher", sheets.CypherPCSheet, {
    types: ["pc"],
    makeDefault: true,
    label: "CYPHER.Sheet.PC"
  });

  DocumentSheetConfig.registerSheet(foundry.documents.Actor, "cypher", sheets.CypherObjectSheet, {
    types: ["object"], makeDefault: true, label: "CYPHER.Object.sheet"
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
  // Foundry v14 exposes CONFIG.statusEffects as an ID-indexed Proxy.
  // Assigning by ID replaces an existing core entry safely and avoids
  // mutating the Proxy as if it were the legacy status-effect array.
  CONFIG.statusEffects.hindered = {
    id: "hindered",
    name: "CYPHER.Wound.HinderedStatus",
    img: CYPHER.statusIcons.hindered
  };
  CONFIG.statusEffects.dead = {
    id: "dead",
    name: "CYPHER.Wound.DeadStatus",
    img: CYPHER.statusIcons.dead
  };
});

Hooks.once("ready", () => {
  console.log("Cypher | Prêt / Ready");
});

// Combat hooks refresh local presentation only. Expiration is evaluated by the
// effect service; rendering must never update Actor flags or reopen a sheet.
function refreshNPCWeaponEffectSheets() {
  // Foundry does not await hook callbacks; retain failures in developer logs.
  sheets.CypherNPCSheet.refreshWeaponEffects().catch(error => {
    console.error("Cypher | Failed to refresh NPC weapon effects", error);
  });
}
Hooks.on("updateCombat", (_combat, changes) => {
  if (["turn", "round", "active"].some(key => Object.hasOwn(changes, key))
    || changes.flags?.cypher?.turnRevisions) refreshNPCWeaponEffectSheets();
});
Hooks.on("createCombat", combat => {
  if (combat.active) refreshNPCWeaponEffectSheets();
});
Hooks.on("deleteCombat", refreshNPCWeaponEffectSheets);

/** Refresh only existing general-effect sheets at turn boundaries; preparation never writes flags. */
function refreshGeneralEffectSheets(combat) {
  const actors = new Set([...(game.actors ?? []), ...(combat?.combatants ?? []).map(entry => entry.actor)]);
  for (const actor of actors) {
    if (!actor?.flags?.cypher?.generalEffects?.length) continue;
    for (const app of Object.values(actor.apps ?? {})) {
      if (app.rendered) app.render().catch(error => console.error("Cypher | Failed to refresh general effects", error));
    }
  }
}
Hooks.on("updateCombat", (combat, changes) => {
  if (["turn", "round", "active"].some(key => Object.hasOwn(changes, key))) refreshGeneralEffectSheets(combat);
});
Hooks.on("deleteCombat", refreshGeneralEffectSheets);

/**
 * Ensures that only one armor item is equipped on an actor at a time.
 * This document-level safeguard applies regardless of which sheet changed the item.
 */
Hooks.on("updateItem", async (item, changes, options, userId) => {
  if (item.type !== "armor" || !item.actor) return;
  if (changes.system?.equipped !== true) return;
  if (userId !== game.user.id) return;

  await enforceSingleEquippedArmor(item);
});

/**
 * Adds a one-click XP reroll action to eligible task roll messages owned by the actor.
 */
Hooks.on("renderChatMessageHTML", async (message, html) => {
  const rerollable = message.getFlag("cypher", "rerollable");
  if (!rerollable) return;

  const actorUuid = message.getFlag("cypher", "actorUuid");
  const actor = actorUuid ? await resolveDocumentReference(actorUuid, "pc")
    : game.actors.get(message.getFlag("cypher", "actorId"));
  if (!actor?.isOwner) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cypher-reroll-button";
  button.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> ${game.i18n.localize("CYPHER.XP.Reroll")} (${CYPHER.xpCosts.reroll} PX)`;
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    button.disabled = true;
    try {
      await actor.rerollMessage(message, { allocateRecovery: promptRecoveryAllocation, chooseSpecialEffect: promptSpecialEffect });
    } finally {
      // A rejected request or failed write must not leave the UI permanently blocked.
      button.disabled = false;
    }
  });

  const container = html instanceof HTMLElement ? html : html[0];
  container?.querySelector(".message-content")?.appendChild(button);
});

// Fresh attempts own separate costs and action slots; sheets own their controls.
Hooks.on("renderChatMessageHTML", (message, html) => {
  renderTaskRetryControls(message, html).catch(error => console.error("Cypher | Task retry controls failed", error));
});

// Execution phases are presented separately from rolled initiative scores.
Hooks.on("renderCombatTracker", attachRoundControls);
Hooks.on("updateCombat", refreshRoundPanels);
Hooks.on("updateActor", refreshRoundPanels);
Hooks.on("deleteCombat", closeRoundPanel);

// Requests cross clients through persisted chat; only the elected GM settles XP.
Hooks.on("renderChatMessageHTML", (message, html) => {
  renderIntrusionControls(message, html).catch(error => console.error("Cypher | Intrusion card rendering failed", error));
});
function resumeAuthorizedIntrusionShares() {
  if (!game.ready) return;
  intrusionService.resumeIntrusionShares().catch(error => console.error("Cypher | Intrusion settlement remains pending", error));
}
Hooks.once("ready", resumeAuthorizedIntrusionShares);
Hooks.on("userConnected", resumeAuthorizedIntrusionShares);
Hooks.on("createChatMessage", message => {
  if (intrusionService.getIntrusion(message)?.kind === "choice") resumeAuthorizedIntrusionShares();
});


Hooks.on("updateActor", followerService.onFollowerTierUpdate);

Hooks.on("updateActor", refreshFollowerOwnerSheet);
