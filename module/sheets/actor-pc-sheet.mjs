import { speciesBenefitDisplay } from "../applications/species-benefit-service.mjs";
import { promptSpeciesBenefit } from "./species-benefit-dialogs.mjs";
import { followerDisplay } from "../applications/follower-service.mjs";
import { promptFollower, promptFollowerAction } from "./follower-dialogs.mjs";
import { promptFollowerAbility, resumeFollowerAbility } from "./follower-ability-dialogs.mjs";
import { followerAbilityUses } from "../applications/follower-ability-service.mjs";
import { companionContext } from "../applications/companion-power-service.mjs";
import { companionUpgradeDisplay } from "../applications/companion-upgrade-service.mjs";
import { promptCompanionInstall, promptCompanionUpgrade, finishCompanionUpgrade, stopCompanionUpgrade, promptCompanionUpgradeCircumstances, promptAutomatonTurret } from "./companion-upgrade-dialogs.mjs";
import { companionSupportDisplay, companionRepairChoices } from "../applications/companion-support-service.mjs";
import { promptCompanionContext, promptCompanionRepair, finishCompanionRepair, cancelCompanionRepair, resumeRetainerInterception } from "./companion-dialogs.mjs";
import { cypherInventoryDisplay } from "../applications/cypher-inventory-service.mjs";
import { promptCypherAward, promptCypherDiscard, promptCypherCustody, promptCypherReconciliation } from "./cypher-dialogs.mjs";
import { projectDisplay, isProjectAuthority } from "../applications/project-service.mjs";
import { promptProject, promptProjectAction, promptResourceAward, promptBefriendPenalty } from "./project-dialogs.mjs";
import { promptAdvancementPurchase, promptAdvancementChoice, promptAdvancementReconciliation } from "./advancement-dialogs.mjs";
import { getAdvancementChoices } from "../applications/advancement-service.mjs";
import { promptGMIntrusion, promptPlayerIntrusion } from "./intrusion-dialogs.mjs";
import { equipmentHandsDisplay, promptEquipmentUse, promptHandCapacity, ensureEquipmentUse } from "./equipment-hands-dialogs.mjs";
import { environmentalDisplay, promptEnvironment, promptEnvironmentExposure, endEnvironment } from "./environment-dialogs.mjs";
import { isEnvironmentAuthority } from "../applications/environment-service.mjs";
import { promptRollOptions, promptWeaponAttackCategory, promptWeaponAbility, taskModifierFields, readTaskModifiers } from "./dialogs.mjs";
import { abilityActionLabel } from "../abilities.mjs";
import { getSuperheroicsRank } from "../applications/task-preparation.mjs";
import { promptRecoveryOptions, promptRecoveryAllocation, promptTreatment, promptHealingHand } from "./healing-dialogs.mjs";
import { getRecoverySources } from "../applications/recovery-service.mjs";
import { getHealingAbilityKind, getHealingHandCost, treatWound, useHealingHand } from "../applications/healing-service.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

import {
  chooseAbilityEffect,
  rollAbilityTable
} from "../applications/ability-service.mjs";
import {
  getFocusAbilityChoices,
  getInitialFocusAbilityChoices,
  selectFocusAbility
} from "../applications/content-service.mjs";
import {
  toggleSecondDescriptor,
  toggleSecondFocus
} from "../applications/character-service.mjs";
import { getAvailableShields, toggleEquipped } from "../applications/equipment-service.mjs";
import { getWeaponConfiguration, rollCypherTable, rollCypherVariant, toggleAttackConfiguration } from "../applications/item-service.mjs";
import { executeWeaponAbility, getWeaponAbilityKind } from "../applications/weapon-ability-service.mjs";
import { executeShieldAbility } from "../applications/shield-attack-service.mjs";
import { getShieldAbilityKind, designateShield, startShieldWork, finishShieldWork, retrieveShield, resolveShieldTurnLoss } from "../applications/shield-lifecycle-service.mjs";
import { promptShieldAbility, confirmShieldWork } from "./shield-dialogs.mjs";
import { generalEffectDisplay, toggleGuarding, clearGeneralEffect, promptGeneralCondition,
  promptCooperativeAction, promptSpecialDamage, promptDiseaseCheck } from "./general-action-dialogs.mjs";

/**
 * Foundry VTT sheet for player characters using the Cypher system.
 *
 * The PC sheet is intentionally a single playable dashboard: the most
 * frequently used character data and actions are visible together instead of
 * being hidden behind application tabs. Secondary biography and notes remain
 * collapsible at the end of the dashboard.
 */
export default class CypherPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cypher", "sheet", "actor", "pc"],
    tag: "form",
    position: { width: 1050, height: 900 },
    window: {
      resizable: true,
      title: "CYPHER.Sheet.PC"
    },
    // Template buttons declare data-action="...". Foundry routes each name to
    // the handler below, binding `this` to the sheet, even for static handlers.
    actions: {
      promptProject, promptResourceAward, promptBefriendPenalty,
      prepareBenefit: promptSpeciesBenefit, finishBenefit: promptSpeciesBenefit, chooseBenefitEnergy: promptSpeciesBenefit,
      refreshSpeciesBenefits: promptSpeciesBenefit, reviewConditionalTraining: promptSpeciesBenefit,
      promptFollower, promptFollowerAbility, resumeFollowerAbility, configureFollower: promptFollowerAction, openFollower: promptFollowerAction, syncFollower: promptFollowerAction,
      replaceFollower: promptFollowerAction, reconcileFollower: promptFollowerAction,
      promptCompanionContext, promptCompanionRepair, finishCompanionRepair, cancelCompanionRepair, resumeRetainerInterception,
      promptCompanionInstall, promptCompanionUpgrade, finishCompanionUpgrade, stopCompanionUpgrade, promptCompanionUpgradeCircumstances,
      promptAutomatonTurret,
      generateCypher: promptCypherAward, awardCypher: promptCypherAward, discardCyphers: promptCypherDiscard,
      stashCypher: promptCypherCustody, retrieveCypher: promptCypherCustody, transferCypher: promptCypherCustody, formCypher: promptCypherCustody,
      reconcileCypherTransfer: promptCypherCustody, reconcileCypherAward: promptCypherReconciliation,
      approveProject: promptProjectAction, completeProject: promptProjectAction, cancelProject: promptProjectAction,
      resumeProject: promptProjectAction, reconcileProject: promptProjectAction,
      promptEquipmentUse, promptHandCapacity,
      promptEnvironment, promptEnvironmentExposure, endEnvironment,
      toggleGuarding, clearGeneralEffect, promptGeneralCondition, promptCooperativeAction, promptSpecialDamage, promptDiseaseCheck,
      rollStat: CypherPCSheet.#onRollStat,
      rollRecovery: CypherPCSheet.#onRollRecovery,
      useCypher: CypherPCSheet.#onUseCypher,
      rollCypherTable: CypherPCSheet.#onRollCypherTable,
      rollCypherVariant: CypherPCSheet.#onRollCypherVariant,
      rollAttack: CypherPCSheet.#onRollAttack,
      useWeaponAbility: CypherPCSheet.#onUseWeaponAbility,
      useShieldAbility: CypherPCSheet.#onUseShieldAbility,
      retrieveShield: CypherPCSheet.#onRetrieveShield,
      resolveShieldTurnLoss: CypherPCSheet.#onResolveShieldTurnLoss,
      toggleAttackConfiguration: CypherPCSheet.#onToggleAttackConfiguration,
      rallyWound: CypherPCSheet.#onRallyWound,
      treatWound: CypherPCSheet.#onTreatWound,
      useHealingHand: CypherPCSheet.#onUseHealingHand,
      toggleSecondDescriptor: CypherPCSheet.#onToggleSecondDescriptor,
      toggleSecondFocus: CypherPCSheet.#onToggleSecondFocus,
      addCustomStat: CypherPCSheet.#onAddCustomStat,
      deleteCustomStat: CypherPCSheet.#onDeleteCustomStat,
      addCustomField: CypherPCSheet.#onAddCustomField,
      deleteCustomField: CypherPCSheet.#onDeleteCustomField,
      itemCreate: CypherPCSheet.#onItemCreate,
      itemEdit: CypherPCSheet.#onItemEdit,
      itemDelete: CypherPCSheet.#onItemDelete,
      toggleEquipped: CypherPCSheet.#onToggleEquipped,
      playerIntrusion: CypherPCSheet.#onPlayerIntrusion,
      gmIntrusion: async function() { await promptGMIntrusion(this.actor); },
      purchaseAdvancement: promptAdvancementPurchase,
      promptAdvancementChoice, promptAdvancementReconciliation,
      rollDefense: CypherPCSheet.#onRollDefense,
      damageArmor: CypherPCSheet.#onDamageArmor,
      repairArmor: CypherPCSheet.#onRepairArmor,
      rollDepletion: CypherPCSheet.#onRollDepletion,
      chooseAbilityEffect: CypherPCSheet.#onChooseAbilityEffect,
      rollAbilityTable: CypherPCSheet.#onRollAbilityTable,
      chooseFocusAbility: CypherPCSheet.#onChooseFocusAbility
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };

  static PARTS = {
    sheet: {
      root: true,
      template: "systems/cypher/templates/actor/pc.hbs",
      templates: [
        "systems/cypher/templates/actor/parts/header.hbs",
        "systems/cypher/templates/actor/parts/main.hbs",
        "systems/cypher/templates/actor/parts/projects.hbs",
        "systems/cypher/templates/actor/parts/followers.hbs",
        "systems/cypher/templates/actor/parts/species-benefits.hbs",
        "systems/cypher/templates/actor/parts/general-actions.hbs",
        "systems/cypher/templates/actor/parts/environment.hbs",
        "systems/cypher/templates/actor/parts/equipment-hands.hbs"
      ],
      scrollable: [".pc-dashboard"]
    }
  };

  /**
   * Prepare the complete PC dashboard context.
   *
   * @param {object} options Foundry application context options.
   * @returns {Promise<object>} Template context.
   */
  async _prepareContext(options) {
    // Context is the object Handlebars reads to render the sheet. Enriched HTML
    // and grouped Items are presentation data, not new persisted Actor fields.
    const context = await super._prepareContext(options);
    context.projects = projectDisplay(this.actor);
    context.projectAuthority = isProjectAuthority();
    context.system = this.actor.system;
    context.actor = this.actor;
    context.generalEffects = generalEffectDisplay(this.actor);
    context.generalPC = true;
    context.equipmentHands = equipmentHandsDisplay(this.actor);
    context.canSetHandCapacity = game.user.isGM;
    context.environmentAuthority = isEnvironmentAuthority();
    context.environmentalExposures = environmentalDisplay(this.actor);
    context.superheroicsStat = this.actor.flags?.cypher?.superheroicsStat ?? "";
    context.hasSuperheroics = this.actor.items.some(item => item.type === "ability" && item.system.key === "superheroics");
    context.focusAbilityPendingTier =
      this.actor.getFlag("cypher", "focusAbilityPendingTier");
    context.advancementChoices = getAdvancementChoices(this.actor).map(choice => ({ ...choice, label: game.i18n.format("CYPHER.Advancement.PendingChoice", { kind: game.i18n.localize(`CYPHER.Advancement.${choice.kind === "focus" ? "FocusChoice" : "GenreChoice"}`), tier: choice.tier }) }));
    context.advancementInterrupted = Boolean(this.actor.flags?.cypher?.advancementPending);
    context.advancementCanReconcile = game.user.isGM;
    context.config = CONFIG.CYPHER;
    context.recoveryCards = CONFIG.CYPHER.recoveryIntervals.map(key => ({ key,
      checked: Boolean(this.actor.system.recoveries[key]),
      canRoll: getRecoverySources(this.actor, key).some(source => source.remaining > 0)
    }));
    context.speciesBenefits = speciesBenefitDisplay(this.actor);
    context.followers = await followerDisplay(this.actor);
    context.followerCanManage = game.user.isGM;
    context.followerAbilityPending = followerAbilityUses(this.actor).filter(use => use.state === "pending");
    const repairable = await companionRepairChoices(this.actor);
    context.followers = context.followers.map(follower => ({ ...follower, canRepair: repairable.some(choice => choice.id === follower.id) }));
    context.companion = await companionContext(this.actor);
    context.companionSupport = companionSupportDisplay(this.actor);
    context.companionUpgrades = companionUpgradeDisplay(this.actor);
    context.cypherInventory = cypherInventoryDisplay(this.actor);
    context.cypherCanAward = game.user.isGM;
    context.items = {
      skills: this.actor.items.filter(i => i.type === "skill"),
      abilities: this.actor.items.filter(i => i.type === "ability").map(item => ({
        id: item.id, name: item.name, system: item.system,
        actionLabel: abilityActionLabel(item.system, key => game.i18n.localize(key)),
        weaponAbilityKind: getWeaponAbilityKind(item),
        shieldAbilityKind: getShieldAbilityKind(item),
        healingAbilityKind: getHealingAbilityKind(item), healingAbilityCost: getHealingHandCost(item)
      })),
      cyphers: context.cypherInventory.items,
      artifacts: this.actor.items.filter(i => i.type === "artifact"),
      equipment: this.actor.items.filter(i => i.type === "equipment"),
      attacks: this.actor.items.filter(i => i.type === "attack").map(item => ({
        id: item.id,
        name: item.name,
        system: item.system,
        activeWeaponConfiguration: getWeaponConfiguration(item)
      })),
      armor: this.actor.items.filter(i => i.type === "armor"),
      shields: this.actor.items.filter(i => i.type === "shield").map(item => ({
        id: item.id, name: item.name, system: item.system, away: item.system.inHand === false,
        workPending: item.system.repairReadyAt != null || item.system.replacementReadyAt != null,
        workHours: item.system.repairReadyAt != null || item.system.replacementReadyAt != null
          ? Math.max(0, Math.ceil(((item.system.repairReadyAt ?? item.system.replacementReadyAt) - game.time.worldTime) / 3600)) : null
      }))
    };
    context.shieldTurnLossPending = this.actor.flags?.cypher?.shieldTurnLossPending === true;
    context.shieldCanIntrude = game.user.isGM;
    context.canDeclareGMIntrusion = game.user.isGM;
    context.enrichedBiography =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.actor.system.biography,
        { relativeTo: this.actor }
      );
    context.enrichedNotes =
      await foundry.applications.ux.TextEditor.implementation.enrichHTML(
        this.actor.system.notes,
        { relativeTo: this.actor }
      );
    return context;
  }

  /* -------------------------------------------- */
  /*  Actions                                       */
  /* -------------------------------------------- */

  /**
   * Rolls a task for the selected stat after collecting roll options.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollStat(event, target) {
    const stat = target.dataset.stat;
    const difficulty = Number(target.dataset.difficulty ?? 3);
    const result = await promptRollOptions(this.actor, { difficulty, stat });
    if (!result) return;
    await this.actor.rollTask({ stat, ...result });
  }

  /**
   * Starts a recovery roll for the selected recovery interval.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollRecovery(event, target) {
    const interval = target.dataset.interval;
    const options = await promptRecoveryOptions(this.actor, interval);
    if (options) await this.actor.rollRecovery(interval, { ...options, allocate: promptRecoveryAllocation });
  }

  /** Complete treatment only after explicit duration and task choices. */
  static async #onTreatWound(event, target) {
    const options = await promptTreatment(this.actor, target.dataset.severity);
    if (options) await treatWound(this.actor, options);
  }

  /** Keep synthetic targets chosen by the dialog when invoking Healing Hand. */
  static async #onUseHealingHand(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const options = await promptHealingHand(this.actor);
    if (options) await useHealingHand(item, options);
  }

  /**
   * Uses the selected cypher item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onUseCypher(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item?.system.variants?.length) await rollCypherVariant(item);
    else await item?.useCypher();
  }

  /**
   * Rolls a structured table and consumes the selected Cypher.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollCypherTable(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    await rollCypherTable(item, target.dataset.tableId);
  }

  static async #onRollCypherVariant(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    await rollCypherVariant(item);
  }
  /** Gather both dialogs before the service may spend any resources. */
  /** Dispatch already collected shield intent; cancellation performs no service write. */
  static async #onUseShieldAbility(event, target) {
    const ability = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    if (!getShieldAbilityKind(ability)) return;
    const options = await promptShieldAbility(ability);
    if (!options) return;
    const shield = this.actor.items.get(options.shieldId);
    let result;
    if (options.operation === "create" || options.operation === "bind") {
      if (options.operation === "bind" && !shield) return;
      result = await designateShield(ability, options.operation === "bind" ? shield.id : null);
    } else if (options.operation === "retrieve") result = await retrieveShield(shield);
    else if (options.operation === "startWork") {
      if (!await confirmShieldWork()) return;
      result = await startShieldWork(shield, { resourcesConfirmed: true });
    } else if (options.operation === "finishWork") {
      if (!await confirmShieldWork(true)) return;
      result = await finishShieldWork(shield, { workCompleted: true });
    } else {
      if (options.mainAttackId && !await ensureEquipmentUse(this, this.actor.items.get(options.mainAttackId))) return;
      result = await executeShieldAbility(ability, options);
    }
    if (!result) ui.notifications.warn(game.i18n.localize("CYPHER.ShieldAbility.InvalidUse"));
  }

  static async #onRetrieveShield(event, target) {
    await retrieveShield(this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId));
  }

  static async #onResolveShieldTurnLoss(event, target) {
    await resolveShieldTurnLoss(this.actor, { gmIntrusion: target.dataset.resolution === "intrusion" });
  }

  static async #onUseWeaponAbility(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const selection = await promptWeaponAbility(this.actor, item);
    if (!selection) return;
    const weapon = this.actor.items.get(selection.weaponId);
    if (!await ensureEquipmentUse(this, weapon)) return;
    const rollOptions = await promptRollOptions(this.actor, {
      isAttack: true, weapon, isWeaponAbility: true, abilitySource: { itemId: item.id }
    });
    if (!rollOptions) return;
    await executeWeaponAbility(item, { ...selection, rollOptions,
      chooseAttackOptions: () => promptRollOptions(this.actor, {
        isAttack: true, weapon, isWeaponAbility: true, abilitySource: { itemId: item.id }
      }) });
  }


  /**
   * Rolls the depletion check for the selected item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollDepletion(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollDepletion();
  }

  /**
   * Lets the player choose one structured effect from an ability.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onChooseAbilityEffect(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const effects = item?.system.effects ?? [];
    if (!item || !effects.length) return;

    const cost = item.system.cost ?? {};
    const costChoiceField = cost.stat === "choice" ? `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Stat.Label")}</label>
        <select name="costStat">
          ${(cost.options ?? []).map(stat =>
            `<option value="${stat}">${game.i18n.localize(`CYPHER.Stat.${stat}`)}</option>`
          ).join("")}
        </select>
      </div>` : "";

    const selection = await foundry.applications.api.DialogV2.prompt({
      window: { title: item.name },
      content: `<fieldset class="cypher-ability-effects">
        <legend>${game.i18n.localize("CYPHER.Ability.ChooseEffect")}</legend>
        ${effects.map((effect, index) => `
          <label class="cypher-ability-effect-option">
            <input type="radio" name="effectId" value="${effect.id}" ${index === 0 ? "checked" : ""}/>
            <strong>${effect.name}</strong>
            <span>${effect.description ?? ""}</span>
            ${effect.effort ? `<em>${game.i18n.localize("CYPHER.Ability.Effort")}: ${effect.effort}</em>` : ""}
          </label>
        `).join("")}
      </fieldset>
      ${costChoiceField}`,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => ({
          effectId: button.form.querySelector("input[name=effectId]:checked")?.value ?? null,
          costStat: button.form.costStat?.value ?? null
        })
      }
    });
    if (!selection?.effectId) return;

    await chooseAbilityEffect(item, selection.effectId, {
      costStat: selection.costStat
    });
  }

  /**
   * Rolls an inline ability table and posts the matching result to chat.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollAbilityTable(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
    const tableId = target.dataset.tableId;
    const table = item?.system.rollTables?.find(candidate => candidate.id === tableId);
    if (!item || !table) return;

    await rollAbilityTable(item, tableId);
  }

  /**
   * Prompts for the single Focus ability made available by a tier advancement.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onChooseFocusAbility(event, target) {
    const actor = this.actor;
    const pendingTier = actor.getFlag("cypher", "focusAbilityPendingTier");
    const focus = actor.getFlag("cypher", "appliedFocusGraph");
    if (!pendingTier || !focus) return;

    const abilities = getFocusAbilityChoices(actor);
    if (!abilities.length) return;

    const abilityId = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CYPHER.FocusSelection.ChooseAbilityTitle") },
      content: `<p>${game.i18n.format("CYPHER.FocusSelection.ChooseAbilityPrompt", { tier: pendingTier })}</p>
        <div class="form-group"><label>${game.i18n.localize("CYPHER.FocusSelection.ChooseAbility")}</label>
          <select name="abilityId">${abilities.map(ability => `<option value="${ability.id}">${ability.name}</option>`).join("")}</select>
        </div>`,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => button.form.abilityId.value
      }
    });
    if (abilityId) {
      const ability = abilities.find(candidate => candidate.id === abilityId);
      const weaponSkillCategory = ability?.chooseWeaponAttackCategory
        ? await promptWeaponAttackCategory()
        : null;
      if (ability?.chooseWeaponAttackCategory && !weaponSkillCategory) return;
      await selectFocusAbility(actor, abilityId, weaponSkillCategory);
    }
  }

  /**
   * Collects attack roll options and delegates the roll to the selected attack item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollAttack(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;
    if (!await ensureEquipmentUse(this, item)) return;
    const targets = Array.from(game.user.targets ?? []);
    const objectTarget = targets.length === 1 && targets[0].actor?.type === "object" ? targets[0].actor : null;
    const result = await promptRollOptions(this.actor, {
      difficulty: 3, isAttack: true, weapon: item, objectTarget
    });
    if (!result) return;
    await item.rollAttack({ ...result, ...(objectTarget ? { target: objectTarget } : {}) });
  }

  static async #onToggleAttackConfiguration(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    await toggleAttackConfiguration(item);
  }

  /**
   * Collects defense options and resolves a Block or Dodge roll.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRollDefense(event, target) {
    const defenseType = target.dataset.defenseType; // "block" or "dodge"
    const maxDifficulty = this.actor.system.maxDifficulty ?? 10;
    const stat = defenseType === "block" ? "might" : "speed";
    const maxEffort = Math.min(6, this.actor.system.effort ?? 1) + getSuperheroicsRank(this.actor, stat);

    // Only equipped, unbroken shields can contribute to a Block.
    const shields = defenseType === "block"
      ? getAvailableShields(this.actor)
      : [];
    const shieldOptions = shields.map(s => `<option value="${s.id}">${foundry.utils.escapeHTML(s.name)}</option>`).join("");

    const skillOptions = this.actor.items.filter(i => i.type === "skill")
      .map(i => `<option value="${i.id}">${i.name} (${game.i18n.localize(`CYPHER.SkillLevel.${i.system.level}`)})</option>`).join("");

    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Defense.IncomingSeverity")}</label>
        <select name="incomingSeverity">
          <option value="minor">${game.i18n.localize("CYPHER.Wound.minor")}</option>
          <option value="moderate">${game.i18n.localize("CYPHER.Wound.moderate")}</option>
          <option value="major">${game.i18n.localize("CYPHER.Wound.major")}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.Difficulty")} (${game.i18n.localize("CYPHER.Defense.AttackerTarget")})</label>
        <input type="number" name="difficulty" value="3" min="0" max="${maxDifficulty}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.LinkedSkill")}</label>
        <select name="skillItemId">
          <option value="">${game.i18n.localize("CYPHER.Roll.NoSkill")}</option>
          ${skillOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.EffortLevels")} (${game.i18n.format("CYPHER.Roll.MaxEffortHint", { max: maxEffort })})</label>
        <input type="number" name="effort" value="0" min="0" max="${maxEffort}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Roll.AssetSteps")}</label>
        <input type="number" name="assets" value="0" min="0" max="2"/>
      </div>
      ${taskModifierFields(this.actor, { stat, defenseType })}
      ${shields.length ? `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Shield.UseShield")}</label>
        <select name="shieldItemId">
          <option value="">${game.i18n.localize("CYPHER.Shield.NoneReduceInstead")}</option>
          ${shieldOptions}
        </select>
      </div>` : ""}`;

    const result = await foundry.applications.api.DialogV2.prompt({
      rejectClose: false,
      window: { title: game.i18n.localize(defenseType === "block" ? "CYPHER.Defense.Block" : "CYPHER.Defense.Dodge") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Roll.Roll"),
        callback: (event, button) => {
          const form = button.form;
          return {
            ...readTaskModifiers(form),
            incomingSeverity: form.incomingSeverity.value,
            difficulty: Number(form.difficulty.value),
            effortLevels: Number(form.effort.value),
            assetSteps: Number(form.assets.value),
            skillItemId: form.skillItemId.value || null,
            shieldItemId: form.shieldItemId?.value || null
          };
        }
      }
    });

    if (!result) return;
    await this.actor.rollDefense(defenseType, result);
  }

  /**
   * Applies one point of damage to the actor's equipped armor.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onDamageArmor(event, target) {
    await this.actor.damageArmor(1);
  }

  /**
   * Confirms and repairs the actor's equipped armor.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRepairArmor(event, target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Armor.Repair") },
      content: `<p>${game.i18n.localize("CYPHER.Armor.ConfirmRepair")}</p>`
    });
    if (confirmed) await this.actor.repairArmor();
  }

  /**
   * Prompts for a narrative request; acceptance and XP settlement belong to the GM service.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onPlayerIntrusion(event, target) {
    await promptPlayerIntrusion(this.actor);
  }

  /**
   * Attempts to rally the selected wound severity.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onRallyWound(event, target) {
    const severity = target.dataset.severity;
    await this.actor.rallyWound(severity);
  }

  /**
   * Toggles the optional second descriptor.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onToggleSecondDescriptor(event, target) {
    const enabled = this.actor.system.hasSecondDescriptor;
    await toggleSecondDescriptor(this.actor, !enabled);
  }

  /**
   * Toggles the optional second focus.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onToggleSecondFocus(event, target) {
    const enabled = this.actor.system.hasSecondFocus;
    await toggleSecondFocus(this.actor, !enabled);
  }

  /**
   * Prompts for and adds a player-defined stat.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onAddCustomStat(event, target) {
    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Stat.CustomName")}</label>
        <input type="text" name="label" placeholder="${game.i18n.localize("CYPHER.Stat.CustomNamePlaceholder")}"/>
      </div>`;

    const label = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CYPHER.Stat.AddCustom") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => button.form.label.value
      }
    });

    if (label) await this.actor.addCustomStat(label);
  }

  /**
   * Confirms and removes the selected custom stat.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onDeleteCustomStat(event, target) {
    const id = target.closest("[data-stat-id]").dataset.statId;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Confirm.Delete") },
      content: `<p>${game.i18n.localize("CYPHER.Stat.ConfirmDeleteCustom")}</p>`
    });
    if (confirmed) await this.actor.deleteCustomStat(id);
  }

  /**
   * Prompts for and adds a player-defined custom field.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onAddCustomField(event, target) {
    const content = `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.CustomField.Label")}</label>
        <input type="text" name="label" placeholder="${game.i18n.localize("CYPHER.CustomField.LabelPlaceholder")}"/>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.CustomField.Type")}</label>
        <select name="fieldType">
          <option value="text">${game.i18n.localize("CYPHER.CustomField.text")}</option>
          <option value="number">${game.i18n.localize("CYPHER.CustomField.number")}</option>
          <option value="checkbox">${game.i18n.localize("CYPHER.CustomField.checkbox")}</option>
        </select>
      </div>`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CYPHER.CustomField.Add") },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => ({
          label: button.form.label.value,
          fieldType: button.form.fieldType.value
        })
      }
    });

    if (result?.label) await this.actor.addCustomField(result.label, result.fieldType);
  }

  /**
   * Confirms and removes the selected custom field.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onDeleteCustomField(event, target) {
    const id = target.closest("[data-field-id]").dataset.fieldId;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Confirm.Delete") },
      content: `<p>${game.i18n.localize("CYPHER.CustomField.ConfirmDelete")}</p>`
    });
    if (confirmed) await this.actor.deleteCustomField(id);
  }

  /**
   * Creates a new embedded item of the requested type.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onItemCreate(event, target) {
    const type = target.dataset.type;
    const name = game.i18n.format("CYPHER.Item.New", { type: game.i18n.localize(`TYPES.Item.${type}`) });
    await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
  }

  /**
   * Opens the selected embedded item's sheet.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onItemEdit(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    item?.sheet.render(true);
  }

  /**
   * Confirms and deletes the selected embedded item.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onItemDelete(event, target) {
    const li = target.closest("[data-item-id]");
    const item = this.actor.items.get(li.dataset.itemId);
    if (!item) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CYPHER.Confirm.Delete") },
      content: `<p>${game.i18n.format("CYPHER.Confirm.DeleteItem", { name: item.name })}</p>`
    });
    if (confirmed) await item.delete();
  }

  /**
   * Toggles an item's equipped state and enforces the single-equipped-armor rule.
   *
   * @param {PointerEvent} event Action event.
   * @param {HTMLElement} target Action target element.
   */
  static async #onToggleEquipped(event, target) {
    const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
    if (!item) return;
    if (!await toggleEquipped(item)) await this.render({ force: true });
  }

  /* -------------------------------------------- */
  /*  Drag and drop                                 */
  /* -------------------------------------------- */

  /**
  * Intercepts a dropped Descriptor and applies its benefits instead of embedding it as a
  * normal item. CypherActor#applyDescriptor creates or updates the actor data that remains.
   *
   * @override
   */
  async _onDropItem(event, data) {
    const item = await Item.implementation.fromDropData(data);
    if (item?.type === "descriptor") {
      await CypherPCSheet.#applyDroppedDescriptor(this.actor, item);
      return;
    }
    if (item?.type === "type") {
      await CypherPCSheet.#applyDroppedType(this.actor, item);
      return;
    }
    if (item?.type === "focus") {
      await CypherPCSheet.#applyDroppedFocus(this.actor, item);
      return;
    }
    return super._onDropItem(event, data);
  }

  /**
   * Applies a dropped Focus after requiring exactly two tier-1 ability choices.
   *
   * @param {Actor} actor PC actor receiving the Focus.
   * @param {Item} item Focus compendium item.
   */
  static async #applyDroppedFocus(actor, item) {
    if (actor.type !== "pc") {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
      return;
    }
    if (actor.getFlag("cypher", "appliedFocusId")) {
      ui.notifications.warn(game.i18n.localize("CYPHER.FocusSelection.AlreadyApplied"));
      return;
    }

    const tierOneAbilities = await getInitialFocusAbilityChoices(item);
    const choices = tierOneAbilities.map(ability => `
      <label class="checkbox"><input type="checkbox" name="abilityId" value="${ability.id}"/> ${ability.name}</label>`).join("");
    const selectedIds = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format("CYPHER.FocusSelection.ApplyTitle", { name: item.name }) },
      content: `<p>${game.i18n.format("CYPHER.FocusSelection.ApplyPrompt", { name: item.name })}</p>
        <p>${game.i18n.localize("CYPHER.FocusSelection.ChooseTwo")}</p>${choices}`,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => [...button.form.querySelectorAll("input[name=abilityId]:checked")].map(input => input.value)
      }
    });
    if (!selectedIds) return;
    if (selectedIds.length !== 2) {
      ui.notifications.warn(game.i18n.localize("CYPHER.FocusSelection.ChooseExactlyTwo"));
      return;
    }
    const weaponSkillCategories = {};
    for (const abilityId of selectedIds) {
      const ability = tierOneAbilities.find(candidate => candidate.id === abilityId);
      if (!ability?.chooseWeaponAttackCategory) continue;
      const category = await promptWeaponAttackCategory();
      if (!category) return;
      weaponSkillCategories[abilityId] = category;
    }
    await actor.applyFocus(item, selectedIds, weaponSkillCategories);
  }

  static async #applyDroppedType(actor, item) {
    if (actor.type !== "pc") {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
      return;
    }
    const statOptions = item.system.statOptions ?? [];
    const skillOptions = (item.system.skillOptions ?? []).filter(skill => skill?.trim());
    const statField = item.system.edgeChoice && statOptions.length > 1 ? `
      <div class="form-group"><label>${game.i18n.localize("CYPHER.Type.ChooseEdgeStat")}</label>
        <select name="stat">${statOptions.map(stat => `<option value="${stat}">${game.i18n.localize(`CYPHER.Stat.${stat}`)}</option>`).join("")}</select>
      </div>` : "";
    const skillField = skillOptions.length ? `
      <div class="form-group"><label>${game.i18n.localize("CYPHER.Type.ChooseSkill")}</label>
        <select name="skillName">${skillOptions.map(skill => `<option value="${skill}">${skill}</option>`).join("")}</select>
      </div>` : "";
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format("CYPHER.Type.ApplyTitle", { name: item.name }) },
      content: `<p>${game.i18n.format("CYPHER.Type.ApplyPrompt", { name: item.name })}</p>${statField}${skillField}`,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => ({ stat: button.form.stat?.value ?? statOptions[0], skillName: button.form.skillName?.value })
      }
    });
    if (result) await actor.applyType(item, result);
  }

  static async #applyDroppedDescriptor(actor, item) {
    if (actor.type !== "pc") {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
      return;
    }

    const statOptions = item.system.statOptions ?? [];
    const skillOptions = (item.system.skillOptions ?? []).filter(s => s?.trim());

    const statField = statOptions.length > 1 ? `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Descriptor.ChooseStat")}</label>
        <select name="stat">
          ${statOptions.map(s => `<option value="${s}">${game.i18n.localize(`CYPHER.Stat.${s}`)}</option>`).join("")}
        </select>
      </div>` : "";

    const skillSelectOptions = skillOptions.map(s => `<option value="${s}">${s}</option>`).join("");
    const skillField = skillOptions.length ? `
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Descriptor.ChooseSkill")}</label>
        <select name="skillChoice">
          ${skillSelectOptions}
          <option value="__other__">${game.i18n.localize("CYPHER.Descriptor.SkillCustomOption")}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYPHER.Descriptor.SkillCustomLabel")}</label>
        <input type="text" name="skillCustom" placeholder="${game.i18n.localize("CYPHER.Descriptor.SkillCustomLabel")}"/>
      </div>` : "";

    const content = `
      <p>${game.i18n.format("CYPHER.Descriptor.ApplyPrompt", { name: item.name })}</p>
      ${statField}
      ${skillField}`;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.format("CYPHER.Descriptor.ApplyTitle", { name: item.name }) },
      content,
      ok: {
        label: game.i18n.localize("CYPHER.Confirm.Add"),
        callback: (event, button) => {
          const form = button.form;
          const skillChoice = form.skillChoice?.value;
          const skillName = (!skillChoice || skillChoice === "__other__") ? form.skillCustom?.value : skillChoice;
          return {
            stat: form.stat?.value ?? statOptions[0],
            skillName
          };
        }
      }
    });

    await actor.applyDescriptor(item, result);
  }
}
