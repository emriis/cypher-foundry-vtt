import { rollDefense } from "./task-service.mjs";
import { resolveNpcAttackTargetDamage } from "../rules/npc-combat.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { roundActionContext, consumeRoundAction, ROUND_ACTION_OWNER } from "./round-action-service.mjs";
import {
  expireWeaponEffectsAfterAction,
  expireWeaponEffectsOutsideCurrentRound,
  getActiveWeaponEffects
} from "./weapon-effect-service.mjs";

/**
 * Execute a structured NPC attack against a player character.
 *
 * Cypher NPCs do not make attack rolls: the targeted player makes the defense
 * roll against the NPC level. Only wound and Pool target damage have a defined
 * PC-side contract here; numeric damage remains an NPC Health mechanic.
 *
 * @param {Actor} actor NPC performing the attack.
 * @param {object} attack Structured NPC attack.
 * @param {object} [options={}] Attack options.
 * @param {Actor|null} [options.target=null] Target PC. When omitted, exactly
 * one targeted PC is required.
 * @param {string} [options.defenseType="dodge"] Block, Dodge or explicitly declared stat defense.
 * @param {string|null} [options.shieldItemId=null] Target-owned shield explicitly chosen for a Block.
 * @returns {Promise<object|null>} Defense and damage result.
 */
export async function rollNpcAttack(
  actor,
  attack,
  { target = null, defenseType = "dodge", shieldItemId = null, cooperativeMode = null,
    takeAttackActor = null, physicalAttack = true, attackForm = null, ...taskOptions } = {}
) {
  if (actor.type !== "npc" || actor.isOwner === false) return null;

  let selectedTarget = target
    ?? (game.user?.targets?.size === 1
      ? [...game.user.targets][0]?.actor
      : null);

  if (selectedTarget?.type !== "pc") {
    ui.notifications.warn(game.i18n.localize("CYPHER.NPC.SinglePCTarget"));
    return null;
  }

  if (!["block", "dodge", "might", "speed", "intellect"].includes(defenseType)) return null;
  if (cooperativeMode === "draw") {
    const draw = getGeneralEffects(actor).find(effect => effect.kind === "draw" && !effect.cancelled);
    if (!draw) return null;
    selectedTarget = await resolveDocumentReference(draw.sourceUuid, "pc");
    // The task validates any chosen shield against this actual drawn target.
    if (!selectedTarget || selectedTarget.isOwner === false) return null;
  }
  return runActorActions([actor, selectedTarget, takeAttackActor], "npcAttack", async context => {
    const roundContext = roundActionContext(actor, { isAttack: true, actionTiming: taskOptions.actionTiming });
    if (roundContext && !roundContext.kind) return null;
    const generalEffects = getGeneralEffects(actor);
    if (generalEffects.some(effect => effect.kind === "preventAction")) {
      if (!await consumeRoundAction(roundContext, context)) return null;
      await expireWeaponEffectsAfterAction(actor);
      ui.notifications.warn(game.i18n.localize("CYPHER.General.GuardStopped"));
      return { stopped: true };
    }
    if (resolveGeneralModifiers(generalEffects, [], { isAttack: true, noPhysicalMovement: !physicalAttack }).rejected) {
      ui.notifications.warn(game.i18n.localize("CYPHER.General.ActionPrevented"));
      return null;
    }

    await expireWeaponEffectsOutsideCurrentRound(actor);
    const targetEffects = getActiveWeaponEffects(actor);
    if (targetEffects.some(effect => effect.effect === "loseNextAction")) {
      if (!await consumeRoundAction(roundContext, context)) return null;
      ui.notifications.warn(game.i18n.localize("CYPHER.NPC.LostNextAction"));
      await expireWeaponEffectsAfterAction(actor);
      return null;
    }

    const hinderSteps = targetEffects
      .filter(effect => effect.effect === "hindered")
      .reduce((total, effect) => total + Math.max(0, effect.hinderSteps ?? 0), 0);
    const npcHinder = resolveGeneralModifiers(generalEffects, [], { isAttack: true }).hinder;
    const effectiveLevel = Math.max(0, actor.system.level - hinderSteps - npcHinder);

    const damage = resolveNpcAttackTargetDamage(attack);
    if (!damage) {
      ui.notifications.warn(game.i18n.localize("CYPHER.NPC.UnsupportedAttackDamage"));
      return null;
    }

    const defense = await rollDefense(selectedTarget, defenseType, {
      ...taskOptions,
      [ACTION_CONTEXT]: context,
      [ROUND_ACTION_OWNER]: actor,
      cooperativeMode, npcSource: actor, takeAttackActor, attackForm,
      automaticFailure: physicalAttack && getGeneralEffects(selectedTarget).some(effect => ["paralyzed", "unconscious"].includes(effect.kind)),
      shieldItemId,
      difficulty: effectiveLevel,
      incomingSeverity: damage.mode === "wound" ? damage.severity : "minor",
      incomingWounds: damage.mode === "wound" ? damage.wounds : 1,
      applyIncomingWound: damage.mode === "wound",
      incomingPoolDamage: damage.mode === "pool" ? { stat: damage.stat, amount: damage.amount } : null
  });

  if (!defense) return null;
  await expireWeaponEffectsAfterAction(actor);

  const targetDamage = defense.defensePoolDamage ?? 0;

  return {
    defense,
    damage,
    targetDamage
  };
  });
}
