import { resolveSprayUse, resolveArcSprayAttacks } from "../rules/weapon-ability-resolution.mjs";
import { resolveWeaponPrerequisites } from "../rules/ability-weapon-prerequisites.mjs";
import { resolveAbilityCost, resolveAbilityCostStat } from "../rules/ability-costs.mjs";
import { clampEffortLevels, computeEffortCost } from "../rules/tasks.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { rollAttack } from "./item-service.mjs";

/** Dispatch on the stable Ability key, never the localized display name. */
export function getWeaponAbilityKind(item) {
  return item?.type === "ability" && ["spray", "arc-spray"].includes(item.system.key)
    ? item.system.key : null;
}

// CRD contracts also cover existing parent-derived records without prerequisites.
const REQUIREMENTS = {
  spray: [
    { kind: "rapidFire", alternativeGroup: "weapon-use" },
    { kind: "thrownWeaponsInReach", alternativeGroup: "weapon-use" }
  ],
  "arc-spray": [{ kind: "rapidFire", alternativeGroup: "weapon-use" }]
};
const pendingActors = new Set();

/**
 * Execute an owned Spray/Arc Spray action through the existing attack engine.
 * Validate the entire action before charging costs or changing a tracked store.
 * Adjacency and thrown-weapon reach are explicit declarations, not measurements.
 */
export async function executeWeaponAbility(item, {
  weaponId, targets = [], allAdjacent = false, thrownWeaponsInReach = false,
  rollOptions = {}
} = {}) {
  const actor = item?.actor;
  const kind = getWeaponAbilityKind(item);
  if (!kind || actor?.type !== "pc" || item.parent !== actor
      || pendingActors.has(actor)) return null;
  pendingActors.add(actor);
  try {
    const reject = () => {
      ui.notifications.warn(game.i18n.localize("CYPHER.WeaponAbility.InvalidUse"));
      return null;
    };
    const weapon = actor.items.get(weaponId);
    if (weapon?.type !== "attack" || weapon.actor !== actor) return reject();
    if (!resolveWeaponPrerequisites(
      item.system.weaponPrerequisites?.length ? item.system.weaponPrerequisites : REQUIREMENTS[kind],
      { weapon: weapon.system, thrownWeaponsInReach: kind === "spray" && thrownWeaponsInReach }
    ).eligible) return reject();
    if (!Array.isArray(targets) || targets.some(target => target?.type !== "npc" || !target.id
      || !Number.isInteger(target.system?.level) || target.system.level < 0)) return reject();
    let profiles;
    if (kind === "arc-spray") {
      const resolved = resolveArcSprayAttacks({ targetIds: targets.map(target => target.uuid ?? target.id), allAdjacent });
      if (!resolved.eligible) return reject();
      profiles = resolved.attacks;
    } else {
      if (targets.length !== 1 || weapon.system.availableUses === 0) return reject();
      profiles = [{ targetId: targets[0].id, extraHinderSteps: 0 }];
    }
    // Check all per-target Effort transactions before executing the first attack.
    const stat = weapon.system.stat;
    const pool = actor.system.stats[stat];
    const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects,
      actor.items.contents ?? Array.from(actor.items.values()));
    const rawCost = item.system.cost;
    if (!Number.isInteger(rawCost?.amount) || rawCost.amount < 0) return reject();
    const costStat = resolveAbilityCostStat(rawCost);
    const abilityEdge = costStat
      ? (actor.system.stats[costStat]?.edge ?? 0) + (modifiers.edge?.[costStat] ?? 0) : 0;
    const cost = resolveAbilityCost(actor.system, {
      ...rawCost, amount: Math.max(0, (rawCost?.amount ?? 0) - abilityEdge)
    });
    if (!cost) return reject();
    // The first attack shares Edge with the Ability activation. Subsequent
    // attacks are extra actions (CRD: Actions), with their own Effort costs.
    const spentAbilityEdge = costStat === stat ? Math.min(rawCost?.amount ?? 0, abilityEdge) : 0;
    const effort = clampEffortLevels(rollOptions.effortLevels ?? 0, actor.system.effort);
    const attackEdge = (pool?.edge ?? 0) + (modifiers.edge?.[stat] ?? 0);
    const firstEffortCost = computeEffortCost(effort, Math.max(0, attackEdge - spentAbilityEdge));
    const subsequentEffortCost = computeEffortCost(effort, attackEdge) * (profiles.length - 1);
    if (!pool || pool.pool.value < firstEffortCost + subsequentEffortCost + (cost.stat === stat ? cost.amount : 0)) return reject();
    // Lucky Shot is a separate action transaction and is not offered here.
    if (rollOptions.luckyShot) return reject();
    let spray = null;
    let useRoll = null;
    if (kind === "spray") {
      useRoll = await new Roll("1d6").evaluate();
      spray = resolveSprayUse({ dieResult: useRoll.total, availableUses: weapon.system.availableUses ?? null });
      if (!spray.eligible) return reject();
    }
    if (cost.amount) await actor.update({ [cost.path]: actor.system.stats[cost.stat].pool.value - cost.amount });
    if (spray && weapon.system.availableUses !== null && weapon.system.availableUses !== undefined) {
      await weapon.update({ "system.availableUses": weapon.system.availableUses - spray.usesToConsume });
    }
    const abilitySource = { itemId: item.id, name: item.name, kind,
      usesToConsume: spray?.usesToConsume ?? null };
    if (useRoll) await useRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("CYPHER.WeaponAbility.UsesConsumed", { uses: spray.usesToConsume }),
      flags: { cypher: { rollType: "sprayUses", actorId: actor.id, abilitySource } }
    });
    const results = [];
    for (let index = 0; index < profiles.length; index += 1) {
      const result = await rollAttack(weapon, {
        ...rollOptions, luckyShot: false, difficulty: targets[index].system.level,
        target: targets[index], extraHinderSteps: profiles[index].extraHinderSteps,
        assetSteps: (rollOptions.assetSteps ?? 0) + (spray?.assetSteps ?? 0),
        damageAdjustment: spray?.damageAdjustment ?? 0, abilitySource,
        spentAbilityEdge: index === 0 ? spentAbilityEdge : 0
      });
      if (!result) throw new Error("Validated weapon Ability attack was rejected");
      // A natural 20 refunds the first action's activation cost as well as
      // its Effort (the task engine handles the latter).
      if (index === 0 && result.roll?.total === 20 && cost.amount) {
        const statPool = actor.system.stats[cost.stat].pool;
        await actor.update({ [cost.path]: Math.min(
          statPool.max + (modifiers.poolMax?.[cost.stat] ?? 0), statPool.value + cost.amount
        ) });
      }
      results.push(result);
    }
    return { kind, spray, results };
  } finally {
    pendingActors.delete(actor);
  }
}
