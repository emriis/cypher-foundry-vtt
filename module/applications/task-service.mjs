import { CYPHER } from "../config.mjs";
import { spendXP } from "./character-service.mjs";
import {
  addWound,
  reduceWound,
  shieldAbsorbWound
} from "./damage-service.mjs";
import {
  clampAssetSteps,
  clampEffortLevels,
  computeEffortCost,
  computeTaskSteps,
  resolveSpecialRoll,
  resolveTaskDifficulty
} from "../rules/tasks.mjs";
import { resolveStat } from "../rules/stats.mjs";
import { resolveDefense } from "../rules/defense.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";

/**
 * Roll a Block or Dodge defense through the common task engine.
 *
 * @param {Actor} actor PC Actor.
 * @param {string} defenseType "block" or "dodge".
 * @param {object} options Defense roll options.
 * @returns {Promise<object|null>} Roll result.
 */
export async function rollDefense(
  actor,
  defenseType,
  {
    difficulty = 3,
    effortLevels = 0,
    assetSteps = 0,
    incomingSeverity = "minor",
    shieldItemId = null,
    skillItemId = null
  } = {}
) {
  if (actor.type !== "pc") return null;

  const { stat, armorModifier } = resolveDefense(
    defenseType,
    actor.system.armor
  );

  const result = await rollTask(actor, {
    stat,
    difficulty,
    effortLevels,
    assetSteps,
    armorModifier,
    skillItemId,
    defenseType,
    incomingSeverity,
    shieldItemId,
    flavor: game.i18n.localize(
      defenseType === "block"
        ? "CYPHER.Defense.Block"
        : "CYPHER.Defense.Dodge"
    )
  });

  if (!result) return null;
  return {
    ...result,
    stat,
    armorModifier,
    defenseType,
    incomingSeverity
  };
}

/**
 * Execute a task roll at the Foundry application boundary.
 *
 * Deterministic task calculations live in rules/tasks.mjs. This service owns
 * the remaining orchestration: Actor state, XP/Pool transactions, dice,
 * chat output, and wound application.
 *
 * @param {Actor} actor Cypher Actor performing the task.
 * @param {object} options Roll options.
 * @returns {Promise<object|null>} Roll result or null when the task is rejected.
 */
export async function rollTask(actor, {
    stat = "might", difficulty = 3, effortLevels = 0, assetSteps = 0,
    skillItemId = null, isAttack = false, baseDamage = 0, flavor = "",
    extraHinderSteps = 0, extraEaseSteps = 0, luckyShot = false,
    defenseType = null, incomingSeverity = "minor", armorModifier = 0, shieldItemId = null
  } = {}) {
    if (actor.type !== "pc") {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
      return null;
    }

    // Lucky shot: spend 1 XP to attack blind, hindered by 4 steps
    if (luckyShot) {
      if (!(await spendXP(actor, CYPHER.xpCosts.luckyShot, game.i18n.localize("CYPHER.XP.LuckyShot")))) return null;
      extraHinderSteps += 4;
    }

    const resolved = resolveStat(actor.system, stat);
    if (!resolved) return null;
    const statData = resolved.data;
    const statLabel = CYPHER.stats.includes(stat) ? game.i18n.localize(resolved.label) : resolved.label;

    // Asset steps are capped at 2.
    assetSteps = clampAssetSteps(assetSteps);
    // Effort cannot exceed the character's Effort score (max 6).
    effortLevels = clampEffortLevels(effortLevels, actor.system.effort);

    const skillItem = skillItemId ? actor.items.get(skillItemId) : null;
    const skillSteps = skillItem ? skillItem.system.stepModifier : 0;

    const abilityItems = actor.items?.contents
      ?? (Array.isArray(actor.items)
        ? actor.items
        : Array.from(actor.items?.values?.() ?? []));
    const abilityModifiers = resolveActiveAbilityModifiers(
      actor.system.activeAbilityEffects,
      abilityItems
    );
    const abilityEdge = abilityModifiers.edge?.[stat] ?? 0;
    const abilityPoolMax = abilityModifiers.poolMax?.[stat] ?? 0;
    const edge = (statData.edge ?? 0) + abilityEdge;
    const poolValue = statData.pool.value;
    const poolMax = statData.pool.max + abilityPoolMax;
    const totalCost = computeEffortCost(effortLevels, edge);

    if (totalCost > poolValue) {
      ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughPool", { stat: statLabel }));
      return null;
    }

    // Each Effort level reduces difficulty by one step; assets, skill, wound hindrance,
    // and any extra hindrance (lucky shot, unfamiliar weapon...) also apply.
    const woundHinder = actor.system.hinderSteps ?? 0;

    // An unfamiliar armor's Speed hindrance is applied to all Speed tasks, except Dodge,
    // where armorModifier already applies the same value.
    const autoArmorSpeedHinder = (stat === "speed" && defenseType !== "dodge")
      ? (actor.system.armor?.speedTaskHinder ?? 0)
      : 0;

    const totalSteps = computeTaskSteps({
      effortLevels,
      assetSteps,
      skillSteps,
      extraEaseSteps,
      woundHinder,
      extraHinderSteps,
      armorModifier,
      autoArmorSpeedHinder
    });
    const { effectiveDifficulty, targetNumber } =
      resolveTaskDifficulty(difficulty, totalSteps);

    // Spend the Pool points.
    if (totalCost > 0) {
      await actor.update({ [`${resolved.path}.pool.value`]: poolValue - totalCost });
    }

    const roll = await new Roll("1d20").evaluate();
    const d20 = roll.total;
    const success = effectiveDifficulty <= 0 ? true : d20 >= targetNumber;

    // Resolve CRD special outcomes in the pure rules layer. The application
    // layer only translates the resulting mechanics into Foundry state/chat.
    const special = resolveSpecialRoll({
      d20,
      success,
      isAttack,
      inflictsDamage: isAttack && success && baseDamage > 0
    });
    const damageBonus = special.damageBonus;
    const effectText = special.gmIntrusion
      ? game.i18n.localize("CYPHER.Roll.GMIntrusionFree")
      : special.effect === "minor"
        ? game.i18n.localize("CYPHER.Roll.MinorEffect")
        : special.effect === "major"
          ? game.i18n.localize("CYPHER.Roll.MajorEffect")
          : "";
    const refund = special.refundsCost;

    // A natural 20 refunds the action's point cost.
    if (refund && totalCost > 0) {
      await actor.update({ [`${resolved.path}.pool.value`]: Math.min(poolMax, poolValue) });
    }

    const totalDamage = isAttack ? baseDamage + damageBonus : 0;

    // A successful Block can transfer the whole wound to an equipped, unbroken shield
    // instead of reducing it by one step on the character.
    const shieldItem = shieldItemId ? actor.items.get(shieldItemId) : null;
    const usingShield = defenseType === "block" && shieldItem?.type === "shield" && !shieldItem.system.broken;

    // Descriptive text for the defense result, shown in the message.
    let defenseNote = "";
    if (defenseType) {
      if (success) {
        if (defenseType === "block" && usingShield) {
          defenseNote = `<p class="cypher-defense-note">${game.i18n.format("CYPHER.Shield.Absorbed", { name: shieldItem.name, severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
        } else if (defenseType === "block") {
          defenseNote = `<p class="cypher-defense-note">${game.i18n.format("CYPHER.Defense.BlockSuccess", { severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
        } else {
          defenseNote = `<p class="cypher-defense-note">${game.i18n.localize("CYPHER.Defense.DodgeSuccess")}</p>`;
        }
      } else {
        defenseNote = `<p class="cypher-defense-note failure">${game.i18n.format("CYPHER.Defense.Failed", { severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
      }
    }

    const messageFlavor = `
      <div class="cypher-roll-card">
        <h3>${flavor || game.i18n.localize("CYPHER.Roll.Task")}</h3>
        <p>${statLabel} —
           ${game.i18n.localize("CYPHER.Roll.Difficulty")} ${difficulty}
           (${game.i18n.localize("CYPHER.Roll.Effective")}: ${effectiveDifficulty}) —
           ${game.i18n.localize("CYPHER.Roll.Target")}: ${effectiveDifficulty <= 0 ? game.i18n.localize("CYPHER.Roll.Routine") : targetNumber}</p>
        ${effortLevels ? `<p>${game.i18n.localize("CYPHER.Roll.EffortSpent")}: ${effortLevels} (${totalCost} ${game.i18n.localize("CYPHER.Roll.PoolPoints")})</p>` : ""}
        ${woundHinder ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.WoundHinder", { steps: woundHinder })}</p>` : ""}
        ${extraHinderSteps ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.ExtraHinder", { steps: extraHinderSteps })}</p>` : ""}
        ${armorModifier ? `<p class="cypher-armor-mod">${game.i18n.format("CYPHER.Roll.ArmorModifier", { steps: armorModifier })}</p>` : ""}
        ${autoArmorSpeedHinder ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.ArmorSpeedHinder", { steps: autoArmorSpeedHinder })}</p>` : ""}
        <p class="cypher-result ${success ? "success" : "failure"}">
          ${success ? game.i18n.localize("CYPHER.Roll.Success") : game.i18n.localize("CYPHER.Roll.Failure")}
          ${isAttack && damageBonus ? ` — +${damageBonus} ${game.i18n.localize("CYPHER.Damage")} (${totalDamage} ${game.i18n.localize("CYPHER.Roll.TotalDamage")})` : ""}
          ${effectText ? ` — ${effectText}` : ""}
        </p>
        ${refund && totalCost > 0 ? `<p class="cypher-refund">${game.i18n.localize("CYPHER.Roll.CostRefunded")}</p>` : ""}
        ${defenseNote}
      </div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flavor: messageFlavor,
      flags: {
        "cypher": {
          rerollable: true,
          rollType: "task",
          actorId: actor.id,
          d20,
          targetNumber,
          effectiveDifficulty,
          isAttack,
          baseDamage
        }
      }
    });

    // Resolve the wound based on the defense result.
    if (defenseType) {
      if (success) {
        if (defenseType === "block") {
          if (usingShield) {
            await shieldAbsorbWound(actor, shieldItem, incomingSeverity);
          } else {
            const reduced = reduceWound(incomingSeverity);
            if (reduced) await addWound(actor, reduced);
          }
        }
        // A successful Dodge avoids the wound entirely.
      } else {
        await addWound(actor, incomingSeverity);
      }
    }

    return { roll, success, targetNumber, effectiveDifficulty, damage: totalDamage };
  }


