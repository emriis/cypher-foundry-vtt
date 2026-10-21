/**
 * Apply the CRD paid-reroll contract to structured chat metadata.
 * Validate metadata/source before XP, keep the appropriate result, and carry
 * that result forward so another paid reroll compares against the current best.
 */
import { CYPHER } from "../config.mjs";
import { resolveRerollPlan, selectRerollValue } from "../rules/rerolls.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { runActorAction, runActorActions } from "./action-guard.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { defaultRecoveryAllocation, recoveryPoolUpdates } from "../rules/recovery-points.mjs";
import { getRecoveryPools } from "./recovery-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { removeWound } from "./wound-removal.mjs";
import { reconcileDefenseConsequences } from "./defense-consequence-service.mjs";
import { reconcileAttackConsequences } from "./attack-consequence-service.mjs";
import { resolveInitiativeScore } from "../rules/initiative.mjs";
import { resolveInitiativeOwner, persistInitiative, initiativeMessageOptions } from "./initiative-history.mjs";
import { isShieldBroken } from "../rules/wounds.mjs";
import { shieldSurvivesMajor, shieldOwnerItems } from "../rules/shield-abilities.mjs";
import { applyRuleEffect } from "./rule-effect-consequence.mjs";

async function describeChoice(item, flags, value) {
  if (flags.rollType === "cypherVariant") {
    const variant = item.system.variants?.find(entry => value >= entry.rollMin && value <= entry.rollMax);
    return variant ? `${variant.name} (${variant.powerLevel})` : game.i18n.localize("CYPHER.Ability.NoRollTableResult");
  }
  const table = item.system.rollTables?.find(entry => entry.id === flags.tableId);
  const result = table?.results?.find(entry => value >= entry.min && value <= entry.max);
  return result?.description ?? game.i18n.localize("CYPHER.Ability.NoRollTableResult");
}

/**
 * Reroll an accepted message without treating a table as a d20 task.
 * Document writes are not atomic across Actors/Items. Errors propagate, retain
 * accepted costs, and release the local guard; no stale state is rolled back.
 * Reconcile tracked attack/defense contributions without replaying action costs
 * or refreshing effects that have already run their original duration.
 * @param {Actor} actor PC paying XP, potentially for another player's roll.
 * @param {ChatMessage} message Original message or a prior reroll message.
 * @param {object} [options={}] Result, special-effect and recovery allocation callbacks.
 * @returns {Promise<object|null>} Retained-result metadata, or null when rejected.
 */
export async function rerollMessage(actor, message, { chooseResult = null, allocateRecovery = null, chooseSpecialEffect = null } = {}) {
  if (actor?.type !== "pc" || actor.isOwner === false || !message?.getFlag("cypher", "rerollable")) return null;
  return runActorAction(actor, "reroll", async context => {
    // Every new reroll card points to one original message. An older card can
    // otherwise replay already-granted Pool points, healing or cost refunds.
    const originId = message.flags.cypher.rerollOriginId;
    const origin = originId ? game.messages?.get(originId) : message;
    if (!origin || origin.isOwner === false || !origin.getFlag("cypher", "rerollable")) return null;
    let flags = origin.flags.cypher;
    let plan = resolveRerollPlan(flags);
    if (!plan) return null;
    if (message.isOwner === false) return null;
    const sourceActor = flags.actorUuid ? await resolveDocumentReference(flags.actorUuid, "pc")
      : !flags.actorId || flags.actorId === actor.id ? actor : game.actors?.get(flags.actorId);
    const appliesRecovery = plan.kind === "recovery" && flags.recoveryApplied === true;
    if ((flags.defenseType || flags.shieldReturn) && (sourceActor?.type !== "pc" || sourceActor.isOwner === false)) return null;
    if (flags.shieldReturn && sourceActor.items?.get(flags.shieldReturn.itemId)?.isOwner === false) return null;
    if (appliesRecovery && (sourceActor?.type !== "pc" || sourceActor.isOwner === false)) return null;
    const woundTarget = flags.woundRemoval ? await resolveDocumentReference(flags.woundRemoval.targetUuid, "pc") : null;
    const defenseRecipient = flags.defenseConsequences?.recipientUuid
      ? await resolveDocumentReference(flags.defenseConsequences.recipientUuid, "pc") : sourceActor;
    if (flags.defenseConsequences?.recipientUuid && (!defenseRecipient || defenseRecipient.isOwner === false)) return null;
    const ruleTarget = flags.ruleEffect ? await resolveDocumentReference(flags.ruleEffect.targetUuid) : null;
    if (flags.ruleEffect && (!ruleTarget || ruleTarget.isOwner === false)) return null;
    const initiativeOwner = flags.initiative ? await resolveInitiativeOwner(flags.initiative, sourceActor, { reroll: true }) : null;
    if (flags.initiative && (!initiativeOwner || !Number.isSafeInteger(flags.initiative.steps))) return null;
    const attackUuid = flags.isAttack ? flags.attackConsequences?.targetUuid : null;
    if (attackUuid && typeof attackUuid !== "string") return null;
    const attackTarget = attackUuid ? await resolveDocumentReference(attackUuid, "npc") : null;
    // World Actor IDs cannot identify an unlinked token. Never substitute the
    // currently selected target or a base Actor when the original is missing.
    if (attackUuid && (!attackTarget || attackTarget.isOwner === false)) return null;
    if (flags.woundRemoval && (!woundTarget || woundTarget.isOwner === false || sourceActor?.type !== "pc"
      || sourceActor.isOwner === false || !["minor", "moderate", "major"].includes(flags.woundRemoval.severity))) return null;
    const execute = async () => {
      // UUID resolution awaited before the healing guard; another accepted
      // action may have advanced the original card during that read.
      // A pending checkpoint updates the origin during this action. Keep the
      // accepted starting metadata independent of Foundry's in-place flag merge.
      flags = structuredClone(origin.flags.cypher);
      plan = resolveRerollPlan(flags);
      if (!plan) return null;
      if (flags.initiative && await resolveInitiativeOwner(flags.initiative, sourceActor, { reroll: true }) === null) return null;
      if (attackUuid && (flags.attackConsequences?.targetUuid !== attackUuid || attackTarget.isOwner === false)) return null;
      if (flags.defenseType && (sourceActor?.type !== "pc" || sourceActor.isOwner === false)) return null;
      const item = sourceActor?.items?.get(flags.itemId);
      if (plan.kind === "task" && flags.effortCost > 0
        && (!sourceActor || sourceActor.isOwner === false || !resolveStat(sourceActor.system, flags.stat))) return null;
      if (["depletion", "cypherTable", "cypherVariant"].includes(plan.kind) && !item) return null;
      if (plan.kind === "depletion" && item.isOwner === false) return null;
      if (plan.kind === "cypherTable" && !item.system.rollTables?.some(entry => entry.id === flags.tableId)) return null;
      if (plan.kind === "cypherVariant" && !item.system.variants?.length) return null;
      if ((actor.system.xp ?? 0) < CYPHER.xpCosts.reroll) {
        ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughXP", {
          amount: CYPHER.xpCosts.reroll, reason: game.i18n.localize("CYPHER.XP.Reroll")
        }));
        return null;
      }
      // Parse the formula before committing XP; malformed formulas cannot charge.
      const roll = new Roll(plan.formula, flags.rollData ?? {});
      await actor.update({ "system.xp": actor.system.xp - CYPHER.xpCosts.reroll });
      await roll.evaluate();
      let choice = null;
      if (["cypherTable", "cypherVariant"].includes(plan.kind)) {
        const oldDescription = await describeChoice(item, flags, plan.oldValue);
        const newDescription = await describeChoice(item, flags, roll.total);
        choice = chooseResult
          ? await chooseResult({ oldValue: plan.oldValue, newValue: roll.total, oldDescription, newDescription })
          : await promptRerollChoice(plan.oldValue, roll.total, oldDescription, newDescription);
      }
      let retained = selectRerollValue(plan, roll.total, choice);
      if (appliesRecovery && retained > plan.oldValue) {
        // A higher paid reroll contributes only its increase; rest, wounds and
        // the new-day reset must never be replayed. Closing the post-roll chooser
        // retains the old result, matching the existing paid-choice contract.
        const total = retained - plan.oldValue;
        const pools = getRecoveryPools(sourceActor);
        const allowedStats = flags.recoveryAllowedStats ?? CYPHER.stats;
        const proposed = defaultRecoveryAllocation(total, pools, allowedStats);
        const allocation = allocateRecovery ? await allocateRecovery({ total, pools, allowedStats, proposed }) : proposed;
        const updates = recoveryPoolUpdates(total, getRecoveryPools(sourceActor), allocation, allowedStats);
        if (!updates) retained = plan.oldValue;
        else if (Object.keys(updates).length) await sourceActor.update(updates);
      }
      const metadata = { ...flags, ...(origin.id ? { rerollOriginId: origin.id } : {}),
        actorId: sourceActor?.id ?? flags.actorId ?? actor.id,
        rerollable: true, originalRoll: retained };
      let shieldCheckpointed = false;
      let ruleCheckpointed = false;
      const checkpointRule = async () => {
        if (!flags.ruleEffect || ruleCheckpointed) return;
        await origin.update({ "flags.cypher": { ...metadata, ruleEffect: { ...metadata.ruleEffect, state: "pending" } } });
        ruleCheckpointed = true;
      };
      let initiativeCheckpointed = false;
      const checkpointInitiative = async () => {
        if (!flags.initiative || initiativeCheckpointed) return;
        await origin.update({ "flags.cypher": { ...metadata,
          initiative: { ...metadata.initiative, state: "pending" } } });
        initiativeCheckpointed = true;
      };
      let attackCheckpointed = false;
      const checkpointAttack = async pending => {
        // A targetless attack has no damage ledger, but its cost refund still
        // needs durable protection if the final chat write fails.
        const checkpoint = metadata.attackConsequences || pending
          ? { attackConsequences: pending ?? { ...metadata.attackConsequences, state: "pending" } }
          : { attackRefundPending: true };
        await origin.update({ "flags.cypher": { ...metadata, ...checkpoint } });
        attackCheckpointed = true;
      };
      const checkpointShield = async () => {
        if (!flags.shieldReturn || shieldCheckpointed) return;
        // Catching and the natural-20 refund are separate writes. An original
        // card checkpoint prevents retrying an uncertain partial completion.
        await origin.update({ "flags.cypher": { ...metadata,
          shieldReturn: { ...metadata.shieldReturn, state: "pending" } } });
        shieldCheckpointed = true;
      };
      let resultText = "";
      if (plan.kind === "task") {
        let specialEffectChoice = flags.specialEffectChoice;
        const offered = resolveTaskOutcome({ ...flags, d20: retained }).special.effectOptions;
        if (retained > plan.oldValue && offered.length) {
          specialEffectChoice = chooseSpecialEffect ? await chooseSpecialEffect(offered) : "damage";
          if (!offered.includes(specialEffectChoice)) specialEffectChoice = "damage";
        }
        metadata.specialEffectChoice = specialEffectChoice;
        const outcome = resolveTaskOutcome({ ...flags, d20: retained, specialEffectChoice });
        metadata.d20 = retained;
        if (flags.ruleEffect && outcome.success && !flags.ruleEffect.applied) {
          if (["pending", "manual"].includes(flags.ruleEffect.state)) {
            metadata.ruleEffect = { ...flags.ruleEffect, state: "manual" };
            ui.notifications.warn(game.i18n.localize("CYPHER.General.ManualCorrection"));
          } else {
            await checkpointRule();
            metadata.ruleEffect = await applyRuleEffect(ruleTarget, flags.ruleEffect, true);
          }
        }
        if (flags.initiative) {
          if (flags.initiative.state === "pending" || flags.initiative.reason === "partial") {
            metadata.initiative = { ...flags.initiative, state: "manual", reason: "partial",
              score: resolveInitiativeScore(retained, flags.initiative.steps) };
          } else if (retained > plan.oldValue) {
            metadata.initiative = { ...flags.initiative, score: resolveInitiativeScore(retained, flags.initiative.steps) };
            await checkpointInitiative();
            await persistInitiative(initiativeOwner, metadata.initiative.score, metadata.initiative);
          }
        }
        if (flags.isAttack && (flags.targetActorId || flags.attackConsequences)) {
          Object.assign(metadata, await reconcileAttackConsequences(attackTarget, flags, outcome, checkpointAttack));
        }
        if (flags.isAttack && flags.attackRefundPending) metadata.attackNote = "CYPHER.XP.AttackCorrectionManual";
        if (outcome.success && flags.shieldReturn
          && (flags.shieldReturn.state === "pending" || flags.shieldReturn.reason === "partial")) {
          metadata.shieldReturn = { ...flags.shieldReturn, state: "manual", reason: "partial", stale: true };
        } else if (outcome.success && flags.shieldReturn && !flags.shieldReturn.applied) {
          const shield = sourceActor?.items?.get(flags.shieldReturn.itemId);
          // Old catch cards cannot retrieve a shield from a later throw/project.
          if (shield?.type === "shield" && shield.isOwner !== false
            && shield.system.flightId === flags.shieldReturn.flightId && shield.system.inHand === false
            && !isShieldBroken(shield.system.wounds, shieldSurvivesMajor(shield, shieldOwnerItems(shield)))) {
            await checkpointShield();
            await shield.update({ "system.inHand": true, "system.equipped": true });
            metadata.shieldReturn = { ...flags.shieldReturn, applied: true };
          } else if (shield?.system.inHand !== true || shield.system.flightId !== flags.shieldReturn.flightId) {
            metadata.shieldReturn = { ...flags.shieldReturn, stale: true };
          }
        }
        if (flags.defenseType) {
          const corrected = await reconcileDefenseConsequences(sourceActor, flags, outcome,
            async pending => {
              // This original-card checkpoint survives a partial Actor/Item write.
              // A later card must never repeat a partially completed correction.
              await origin.update({ "flags.cypher": { ...metadata, defenseConsequences: pending } });
            }, context, defenseRecipient);
          Object.assign(metadata, corrected);
        }
        if (outcome.success && flags.woundRemoval && !flags.woundRemoval.applied) {
          metadata.woundRemoval = { ...flags.woundRemoval,
            applied: await removeWound(woundTarget, flags.woundRemoval.severity) };
        }
        if (outcome.special.refundsCost && !flags.costRefunded && flags.effortCost > 0
          && flags.defenseConsequences?.state !== "pending" && flags.defenseConsequences?.reason !== "partial"
          && flags.attackConsequences?.state !== "pending" && flags.attackConsequences?.reason !== "partial"
          && !flags.attackRefundPending
          && !["pending", "manual"].includes(flags.ruleEffect?.state)
          && flags.initiative?.state !== "pending" && flags.initiative?.reason !== "partial"
          && flags.shieldReturn?.state !== "pending" && flags.shieldReturn?.reason !== "partial") {
          const stat = resolveStat(sourceActor.system, flags.stat);
          const modifiers = resolveActiveAbilityModifiers(sourceActor.system.activeAbilityEffects,
            sourceActor.items?.contents ?? Array.from(sourceActor.items?.values?.() ?? []), sourceActor.system);
          const pool = stat.data.pool;
          await checkpointShield();
          await checkpointInitiative();
          await checkpointRule();
          if (flags.isAttack) await checkpointAttack();
          await sourceActor.update({ [`${stat.path}.pool.value`]: Math.min(
            pool.max + (modifiers.poolMax[flags.stat] ?? 0), pool.value + flags.effortCost) });
          metadata.costRefunded = true;
        }
        if (shieldCheckpointed) metadata.shieldReturn = { ...metadata.shieldReturn,
          state: metadata.shieldReturn.stale ? "manual" : "resolved" };
        if (attackCheckpointed) {
          if (!metadata.attackConsequences) metadata.attackRefundPending = false;
          else if (metadata.attackConsequences.state !== "manual") {
            metadata.attackConsequences = { ...metadata.attackConsequences, state: "applied" };
          }
        }
        if (initiativeCheckpointed) metadata.initiative = { ...metadata.initiative, state: "applied" };
        resultText = flags.initiative
          ? `<p>${game.i18n.format("CYPHER.Initiative.Result", { roll: retained, steps: flags.initiative.steps, score: metadata.initiative.score })}</p>`
          : `<p class="cypher-result ${outcome.success ? "success" : "failure"}">${game.i18n.localize(outcome.success ? "CYPHER.Roll.Success" : "CYPHER.Roll.Failure")}</p>`;
        if (metadata.initiative?.state === "manual") {
          resultText += `<p>${game.i18n.localize("CYPHER.Initiative.ManualCorrection")}</p>`;
          ui.notifications.warn(game.i18n.localize("CYPHER.Initiative.ManualCorrection"));
        }
        if (outcome.damageBonus) resultText += `<p>+${outcome.damageBonus} ${game.i18n.localize("CYPHER.Damage")} (${outcome.totalDamage})</p>`;
        if (outcome.selectedEffect) resultText += `<p>${game.i18n.localize(outcome.selectedEffect === "minor" ? "CYPHER.Roll.MinorEffect" : "CYPHER.Roll.MajorEffect")}</p>`;
        if (metadata.attackNote) {
          resultText += `<p>${game.i18n.localize(metadata.attackNote)}</p>`;
          if (metadata.attackNote === "CYPHER.XP.AttackCorrectionManual") ui.notifications.warn(game.i18n.localize(metadata.attackNote));
        }
        if (flags.isAttack && retained > plan.oldValue
          && (outcome.selectedEffect || ["minor", "major"].includes(flags.specialEffectChoice))) {
          resultText += `<p>${game.i18n.localize("CYPHER.XP.AttackNarrativeEffect")}</p>`;
          ui.notifications.warn(game.i18n.localize("CYPHER.XP.AttackNarrativeEffect"));
        }
        if (metadata.defenseNote) {
          resultText += `<p class="cypher-defense-note">${game.i18n.localize(metadata.defenseNote)}</p>`;
          if (metadata.defenseNote === "CYPHER.XP.DefenseCorrectionManual") ui.notifications.warn(game.i18n.localize(metadata.defenseNote));
        }
        if (metadata.shieldReturn?.stale) {
          resultText += `<p>${game.i18n.localize("CYPHER.ShieldAbility.StaleCatch")}</p>`;
          ui.notifications.warn(game.i18n.localize("CYPHER.ShieldAbility.StaleCatch"));
        }
      } else if (plan.kind === "depletion") {
        const depletes = retained >= plan.min && retained <= plan.max;
        if (item.system.depleted !== depletes) await item.update({ "system.depleted": depletes });
        resultText = `<p class="cypher-result ${depletes ? "failure" : "success"}">${game.i18n.localize(depletes ? "CYPHER.Depletion.LastUse" : "CYPHER.Depletion.StillWorks")}</p>`;
      } else if (plan.kind !== "recovery") {
        resultText = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          await describeChoice(item, flags, retained), { relativeTo: item });
      }
      // The original is authoritative for every card in the chain, including
      // cards created before a later success. Refresh the clicked card as well.
      if (typeof origin.update === "function") await origin.update({ "flags.cypher": metadata });
      if (message !== origin && typeof message.update === "function") await message.update({ "flags.cypher": metadata });
      await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: sourceActor ?? actor }),
        flavor: `<div class="cypher-roll-card cypher-reroll-card"><h3>${game.i18n.localize("CYPHER.XP.RerollResult")}</h3>
          <p>${game.i18n.format("CYPHER.XP.RerollCompare", { old: plan.oldValue, new: roll.total, final: retained })}</p>${resultText}</div>`,
        flags: { cypher: metadata, ...(flags.initiative ? { core: { initiativeRoll: true } } : {}) } },
      flags.initiative ? initiativeMessageOptions(flags.initiative) : {});
      return metadata;
    };
    return runActorActions([sourceActor ?? actor, woundTarget, defenseRecipient, ruleTarget, attackTarget, initiativeOwner?.combat], "rerollSource", execute, context);
  });
}

/** Closing a post-roll choice retains the old result; the accepted reroll still costs XP. */
async function promptRerollChoice(oldValue, newValue, oldDescription, newDescription) {
  const escape = foundry.utils.escapeHTML;
  return foundry.applications.api.DialogV2.prompt({
    rejectClose: false,
    window: { title: game.i18n.localize("CYPHER.XP.RerollResult") },
    content: `<p>${game.i18n.localize("CYPHER.XP.ChooseBetterReroll")}</p>
      <p>${oldValue}: ${escape(oldDescription)}</p><p>${newValue}: ${escape(newDescription)}</p>
      <select name="resultChoice"><option value="old">${game.i18n.localize("CYPHER.XP.KeepOldRoll")}</option>
      <option value="new">${game.i18n.localize("CYPHER.XP.KeepNewRoll")}</option></select>`,
    ok: { label: game.i18n.localize("CYPHER.XP.RerollResult"),
      callback: (event, button) => button.form.resultChoice.value }
  });
}
