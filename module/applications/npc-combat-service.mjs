import { addWound, applyDamage } from "./damage-service.mjs";
import { rollDefense } from "./task-service.mjs";
import { resolveNpcAttackTargetDamage } from "../rules/npc-combat.mjs";
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
 * @param {string} [options.defenseType="dodge"] Block or Dodge.
 * @returns {Promise<object|null>} Defense and damage result.
 */
export async function rollNpcAttack(
  actor,
  attack,
  { target = null, defenseType = "dodge" } = {}
) {
  if (actor.type !== "npc") return null;

  const selectedTarget = target
    ?? (game.user?.targets?.size === 1
      ? [...game.user.targets][0]?.actor
      : null);

  if (selectedTarget?.type !== "pc") {
    ui.notifications.warn(game.i18n.localize("CYPHER.NPC.SinglePCTarget"));
    return null;
  }

  if (!["block", "dodge"].includes(defenseType)) return null;

  await expireWeaponEffectsOutsideCurrentRound(actor);
  const targetEffects = getActiveWeaponEffects(actor);
  if (targetEffects.some(effect => effect.effect === "loseNextAction")) {
    ui.notifications.info(game.i18n.localize("CYPHER.NPC.LostNextAction"));
    await expireWeaponEffectsAfterAction(actor);
    return null;
  }

  const hinderSteps = targetEffects
    .filter(effect => effect.effect === "hindered")
    .reduce((total, effect) => total + Math.max(0, effect.hinderSteps ?? 0), 0);
  const effectiveLevel = Math.max(0, actor.system.level - hinderSteps);

  const damage = resolveNpcAttackTargetDamage(attack);
  if (!damage) {
    ui.notifications.warn(game.i18n.localize("CYPHER.NPC.UnsupportedAttackDamage"));
    return null;
  }

  const defense = await rollDefense(selectedTarget, defenseType, {
    difficulty: effectiveLevel,
    incomingSeverity: damage.mode === "wound" ? damage.severity : "minor",
    incomingWounds: damage.mode === "wound" ? damage.wounds : 1,
    applyIncomingWound: damage.mode === "wound"
  });

  await expireWeaponEffectsAfterAction(actor);
  if (!defense) return null;

  let targetDamage = 0;
  if (!defense.success && damage.mode === "pool") {
    targetDamage = await applyDamage(selectedTarget, damage.amount, {
      stat: damage.stat
    });
  }

  return {
    defense,
    damage,
    targetDamage
  };
}
