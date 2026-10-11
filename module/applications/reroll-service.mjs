/**
 * Apply the CRD paid-reroll contract to structured chat metadata.
 * Validate metadata/source before XP, keep the appropriate result, and carry
 * that result forward so another paid reroll compares against the current best.
 */
import { CYPHER } from "../config.mjs";
import { resolveRerollPlan, selectRerollValue } from "../rules/rerolls.mjs";
import { resolveTaskOutcome } from "../rules/task-outcome.mjs";
import { runActorAction } from "./action-guard.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { defaultRecoveryAllocation, recoveryPoolUpdates } from "../rules/recovery-points.mjs";
import { getRecoveryPools } from "./recovery-service.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { removeWound } from "./wound-removal.mjs";

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
 * Previously applied task consequences are not replayed by this chat operation.
 * @param {Actor} actor PC paying XP, potentially for another player's roll.
 * @param {ChatMessage} message Original message or a prior reroll message.
 * @param {object} [options={}] Optional result chooser or recovery-point allocation callback.
 * @returns {Promise<object|null>} Retained-result metadata, or null when rejected.
 */
export async function rerollMessage(actor, message, { chooseResult = null, allocateRecovery = null } = {}) {
  if (actor?.type !== "pc" || actor.isOwner === false || !message?.getFlag("cypher", "rerollable")) return null;
  return runActorAction(actor, "reroll", async () => {
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
    if (appliesRecovery && (sourceActor?.type !== "pc" || sourceActor.isOwner === false)) return null;
    const woundTarget = flags.woundRemoval ? await resolveDocumentReference(flags.woundRemoval.targetUuid, "pc") : null;
    if (flags.woundRemoval && (!woundTarget || woundTarget.isOwner === false || sourceActor?.type !== "pc"
      || sourceActor.isOwner === false || !["minor", "moderate", "major"].includes(flags.woundRemoval.severity))) return null;
    const execute = async () => {
      // UUID resolution awaited before the healing guard; another accepted
      // action may have advanced the original card during that read.
      flags = origin.flags.cypher;
      plan = resolveRerollPlan(flags);
      if (!plan) return null;
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
      let resultText = "";
      if (plan.kind === "task") {
        const outcome = resolveTaskOutcome({ ...flags, d20: retained });
        metadata.d20 = retained;
        if (outcome.success && flags.woundRemoval && !flags.woundRemoval.applied) {
          metadata.woundRemoval = { ...flags.woundRemoval,
            applied: await removeWound(woundTarget, flags.woundRemoval.severity) };
        }
        if (outcome.special.refundsCost && !flags.costRefunded && flags.effortCost > 0) {
          const stat = resolveStat(sourceActor.system, flags.stat);
          const modifiers = resolveActiveAbilityModifiers(sourceActor.system.activeAbilityEffects,
            sourceActor.items?.contents ?? Array.from(sourceActor.items?.values?.() ?? []));
          const pool = stat.data.pool;
          await sourceActor.update({ [`${stat.path}.pool.value`]: Math.min(
            pool.max + (modifiers.poolMax[flags.stat] ?? 0), pool.value + flags.effortCost) });
          metadata.costRefunded = true;
        }
        resultText = `<p class="cypher-result ${outcome.success ? "success" : "failure"}">${game.i18n.localize(outcome.success ? "CYPHER.Roll.Success" : "CYPHER.Roll.Failure")}</p>`;
        if (outcome.damageBonus) resultText += `<p>+${outcome.damageBonus} ${game.i18n.localize("CYPHER.Damage")} (${outcome.totalDamage})</p>`;
        if (outcome.selectedEffect) resultText += `<p>${game.i18n.localize(outcome.selectedEffect === "minor" ? "CYPHER.Roll.MinorEffect" : "CYPHER.Roll.MajorEffect")}</p>`;
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
        flags: { cypher: metadata } });
      return metadata;
    };
    return appliesRecovery || woundTarget ? runActorAction(sourceActor, "healing", () =>
      woundTarget && woundTarget !== sourceActor ? runActorAction(woundTarget, "healing", execute) : execute()) : execute();
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
