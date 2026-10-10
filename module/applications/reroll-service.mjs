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
 * @param {object} [options={}] Optional chooser for unordered results.
 * @returns {Promise<object|null>} Retained-result metadata, or null when rejected.
 */
export async function rerollMessage(actor, message, { chooseResult = null } = {}) {
  if (actor?.type !== "pc" || actor.isOwner === false || !message?.getFlag("cypher", "rerollable")) return null;
  return runActorAction(actor, "reroll", async () => {
    const flags = message.flags.cypher;
    const plan = resolveRerollPlan(flags);
    if (!plan) return null;
    if (message.isOwner === false) return null;
    const sourceActor = !flags.actorId || flags.actorId === actor.id
      ? actor : game.actors?.get(flags.actorId);
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
    const retained = selectRerollValue(plan, roll.total, choice);
    const metadata = { ...flags, actorId: sourceActor?.id ?? flags.actorId ?? actor.id,
      rerollable: true, originalRoll: retained };
    let resultText = "";
    if (plan.kind === "task") {
      const outcome = resolveTaskOutcome({ ...flags, d20: retained });
      metadata.d20 = retained;
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
    // Persist the current best on the source card too, so retrying that card
    // after a reload compares with every previous reroll, not its initial die.
    if (typeof message.update === "function") await message.update({ "flags.cypher": metadata });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: sourceActor ?? actor }),
      flavor: `<div class="cypher-roll-card cypher-reroll-card"><h3>${game.i18n.localize("CYPHER.XP.RerollResult")}</h3>
        <p>${game.i18n.format("CYPHER.XP.RerollCompare", { old: plan.oldValue, new: roll.total, final: retained })}</p>${resultText}</div>`,
      flags: { cypher: metadata } });
    return metadata;
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
