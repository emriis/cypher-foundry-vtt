/**
 * Coordinate Spray and Arc Spray across an Ability, a weapon, and NPC targets.
 * Pure rules decide eligibility and modifiers; this browser service validates
 * current documents, spends resources, and awaits each attack in order.
 */
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { resolveSprayUse, resolveArcSprayAttacks } from "../rules/weapon-ability-resolution.mjs";
import { resolveWeaponPrerequisites } from "../rules/ability-weapon-prerequisites.mjs";
import { resolveAbilityCost, resolveAbilityCostStat } from "../rules/ability-costs.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { prepareAttackOptions } from "./item-service.mjs";
import { prepareTask } from "./task-preparation.mjs";

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

/**
 * Execute an owned Spray/Arc Spray action through the existing attack engine.
 * Validate activation and the first attack before writes. Each later attack is
 * a new action: check its current Pool before paying or rolling, not the sum of
 * all hypothetical future attacks. A natural 20 can fund the next action.
 * Adjacency and thrown-weapon reach are explicit declarations, not measurements.
 * Once writes begin, a later failure can leave earlier writes committed;
 * the finally block releases the local guard but does not roll resources back.
 *
 * @param {Item} item Ability embedded in the acting PC.
 * @param {object} [options={}] Weapon, actual target Actors, and roll choices.
 * @param {string} options.weaponId Embedded attack Item ID.
 * @param {Actor[]} [options.targets=[]] One Spray target or three distinct Arc Spray targets.
 * @param {boolean} [options.allAdjacent=false] Caller-confirmed adjacency for Arc Spray.
 * @param {boolean} [options.thrownWeaponsInReach=false] Caller-confirmed Spray alternative.
 * @param {object} [options.rollOptions={}] Choices passed to the shared attack engine.
 * @param {Function|null} [options.chooseAttackOptions=null] Fresh choices before each extra action; null cancels it.
 * @returns {Promise<object|null>} Per-target results, or null for a rejected activation.
 */
export async function executeWeaponAbility(item, {
  weaponId, targets = [], allAdjacent = false, thrownWeaponsInReach = false,
  rollOptions = {}, chooseAttackOptions = null
} = {}) {
  const actor = item?.actor;
  const kind = getWeaponAbilityKind(item);
  if (!kind || actor?.type !== "pc" || actor.isOwner === false || item.parent !== actor) return null;
  return runActorActions([actor, ...(Array.isArray(targets) ? targets : [])], "weaponAbility", async context => {
    const reject = () => {
      ui.notifications.warn(game.i18n.localize("CYPHER.WeaponAbility.InvalidUse"));
      return null;
    };
    const weapon = actor.items.get(weaponId);
    if (chooseAttackOptions !== null && typeof chooseAttackOptions !== "function") return reject();
    if (weapon?.type !== "attack" || weapon.actor !== actor) return reject();
    if (!resolveWeaponPrerequisites(
      item.system.weaponPrerequisites?.length ? item.system.weaponPrerequisites : REQUIREMENTS[kind],
      { weapon: weapon.system, thrownWeaponsInReach: kind === "spray" && thrownWeaponsInReach }
    ).eligible) return reject();
    if (!Array.isArray(targets) || targets.some(target => target?.type !== "npc" || target.isOwner === false || !target.id
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
    // The activation belongs to the first action; later attacks pay separately.
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
    const planAttack = (index, extra = {}, choices = rollOptions) => {
      const options = prepareAttackOptions(weapon, { ...choices, ...extra, [ACTION_CONTEXT]: context, areaAttack: false,
        difficulty: targets[index].system.level, target: targets[index],
        extraHinderSteps: (choices.extraHinderSteps ?? 0) + profiles[index].extraHinderSteps,
        abilitySource: { itemId: item.id, name: item.name, kind },
        spentAbilityEdge: index === 0 ? spentAbilityEdge : 0 });
      const plan = options && prepareTask(actor, { damageEffortLevels: 0, freeEffortLevels: 0,
        freeDamageEffortLevels: 0, freeEffortSource: "", powerShiftCategories: [],
        areaAttack: false, push: false, armorModifier: 0, defenseType: null, ...options });
      return plan ? { options, plan } : null;
    };
    const first = planAttack(0);
    if (!first || !pool || pool.pool.value < first.plan.totalCost + (cost.stat === stat ? cost.amount : 0)) return reject();
    // Lucky Shot is a separate action transaction and is not offered here.
    if (rollOptions.luckyShot) return reject();
    let spray = null;
    let useRoll = null;
    if (kind === "spray") {
      useRoll = await new Roll("1d6").evaluate();
      spray = resolveSprayUse({ dieResult: useRoll.total, availableUses: weapon.system.availableUses ?? null });
      if (!spray.eligible) return reject();
    }
    // Validation above is read-only. From here onward, writes are persistent:
    // activation cost, tracked uses, chat, then each target's attack consequences.
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
      // A conditional grant or accepted wound belongs to one action. Legacy
      // macros can reuse paid choices, but must explicitly declare free grants
      // again; the sheet collects fresh choices for every extra action.
      let choices = index === 0 ? rollOptions : { ...rollOptions,
        freeEffortLevels: 0, freeDamageEffortLevels: 0, freeEffortSource: "",
        push: false, pushDamageEffortLevels: 0 };
      if (index > 0 && chooseAttackOptions) {
        choices = await chooseAttackOptions({ index, actor, target: targets[index], previous: results.at(-1) });
        if (!choices) break;
      }
      if (choices.luckyShot) break;
      // Re-read current resources immediately before each action. Refusal
      // leaves that action's Pool, dice and target untouched; earlier actions
      // remain committed. Do not throw as if a completed attack never happened.
      const current = planAttack(index, {
        luckyShot: false,
        assetSteps: (choices.assetSteps ?? 0) + (spray?.assetSteps ?? 0),
        damageAdjustment: spray?.damageAdjustment ?? 0, abilitySource,
        spentAbilityEdge: index === 0 ? spentAbilityEdge : 0
      }, choices);
      if (!current) break;
      const result = await actor.rollTask(current.options);
      if (!result) break;
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
    return { kind, spray, results, completed: results.length === profiles.length };
  });
}
