/** CRD Builds Allies 3596: autonomous hindered shots, with explicit NPC-versus-NPC adjudication. */
import { liveCompanionEffects, resolveTurretAttack } from "./companion-upgrade-read.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { runActorActions } from "./action-guard.mjs";
import { roundActionContext, consumeRoundAction } from "./round-action-service.mjs";
import { resolveNpcDamage } from "../rules/wounds.mjs";
import { companionNpcProtection } from "./companion-upgrade-read.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
import { resolveNpcAttackTargetDamage } from "../rules/npc-combat.mjs";
import { rollNpcAttack } from "./npc-combat-service.mjs";
import { getActiveWeaponEffects, expireWeaponEffectsAfterAction } from "./weapon-effect-service.mjs";
const authority = () => game.user?.isGM && game.users?.activeGM?.id === game.user.id;

/**
 * One autonomous shot per combat round, or per explicit narrative round ID.
 * Against an NPC, the GM confirms the hindered hit; no NPC d20 is invented.
 * Against a PC, the GM declares the wound/Pool profile for the numeric weapon
 * and the ordinary defense engine applies it. A partial PC resolution remains
 * visibly pending and cannot replay damage after reload.
 */
export async function fireAutomatonTurret(owner, effectId, { target, confirmed = false, inRange = false,
  hitConfirmed, roundId = null, pcAttack = null, defenseOptions = {} } = {}) {
  if (!authority() || owner?.isOwner === false || confirmed !== true || inRange !== true) return false;
  return Boolean(await runActorActions([owner], "turretRequest", async context => {
    const effect = liveCompanionEffects(owner).find(entry => entry.id === effectId && entry.key === "automaton-turret-upgrade");
    const npc = effect && await resolveDocumentReference(effect.npcUuid, "npc");
    const source = { ownerUuid: owner.uuid, effectId };
    if (!npc || !await resolveTurretAttack(npc, source) || npc.isOwner === false || target?.isOwner === false
      || !["pc", "npc"].includes(target?.type) || !(npc.system.health?.value > 0)
      || ["unconscious", "dead", "stunned", "paralyzed"].some(status => npc.statuses?.has(status))
      || resolveGeneralModifiers(getGeneralEffects(npc), [], { isAttack: true, noPhysicalMovement: true }).rejected) return false;
    const combat = game.combat;
    const turn = combat?.started ? `${combat.id}_${combat.round}` : roundId;
    if (typeof turn !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(turn)) return false;
    if (target.type === "npc" && typeof hitConfirmed !== "boolean") return false;
    if (target.type === "pc") {
      const profile = resolveNpcAttackTargetDamage(pcAttack);
      if (!profile || !["wound", "pool"].includes(profile.mode)
        || profile.mode === "wound" && (!["minor", "moderate", "major"].includes(profile.severity) || !Number.isSafeInteger(profile.wounds) || profile.wounds < 1)
        || profile.mode === "pool" && (!["might", "speed", "intellect"].includes(profile.stat) || !Number.isSafeInteger(profile.amount) || profile.amount < 0)) return false;
    }
    return Boolean(await runActorActions([owner, npc, target], "turretShot", async () => {
      if (npc.flags?.cypher?.turretRounds?.[turn]) return false;
      const round = roundActionContext(npc, { isAttack: true, actionTiming: "lastAction" });
      if (round && !round.kind) return false;
      const id = foundry.utils.randomID(), path = `flags.cypher.turretRounds.${turn}`;
      source.roundId = turn; source.shotId = id;
      if (target.type === "npc") {
        if (!await consumeRoundAction(round, context)) return false;
        if (getActiveWeaponEffects(npc).some(effect => effect.effect === "loseNextAction")
          || getGeneralEffects(npc).some(effect => effect.kind === "preventAction")) {
          await npc.update({ [path]: { id, effectId, targetUuid: target.uuid, state: "stopped" } });
          await expireWeaponEffectsAfterAction(npc); return false;
        }
        await npc.update({ [path]: { id, effectId, targetUuid: target.uuid, state: "pending" } });
        const damage = hitConfirmed ? Math.max(0, resolveNpcDamage(7, target.system.armor ?? 0, 0) - companionNpcProtection(target)) : 0;
        // Atomic Health + target receipt survives a lost response without replay.
        await target.update({ "system.health.value": Math.max(0, target.system.health.value - damage),
          [`flags.cypher.turretHits.${id}`]: { sourceUuid: npc.uuid, damage } });
        await expireWeaponEffectsAfterAction(npc);
        await npc.update({ [`${path}.state`]: "complete" }); return true;
      }
      await npc.update({ [path]: { id, effectId, targetUuid: target.uuid, state: "pending" } });
      const defense = await rollNpcAttack(npc, pcAttack, { ...defenseOptions, target, companionTurret: source, actionTiming: "lastAction",
        parentActionContext: context });
      if (!defense) return false;
      await npc.update({ [`${path}.state`]: "complete" }); return true;
    }, context));
  }));
}
