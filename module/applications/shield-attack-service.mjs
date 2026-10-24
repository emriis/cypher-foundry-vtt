/** Execute shield attacks through the shared task/cost/target-effect pipeline. */
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { getShieldAbilityKind } from "./shield-lifecycle-service.mjs";
import { shieldAbilityKind, shieldOwnerItems, validShieldTargets, shieldSurvivesMajor } from "../rules/shield-abilities.mjs";
import { canShieldAbsorbWound, isShieldBroken } from "../rules/wounds.mjs";
import { prepareAttackOptions } from "./item-service.mjs";
import { prepareTask } from "./task-preparation.mjs";
import { rollTask } from "./task-service.mjs";

/**
 * Adapt a source-granted shield attack without creating a second inventory weapon.
 * The player chooses Might/Speed for melee; all thrown attacks use Speed.
 * @returns {object} Attack-shaped read-only input for existing weapon mechanics.
 */
export function shieldAttackProfile(shield, { thrown = false, stat = "might" } = {}) {
  return { id: shield.id, name: shield.name, type: "attack", actor: shield.actor,
    system: { stat: thrown ? "speed" : stat, attackType: "light", damage: 2,
      freelyUsable: true, range: thrown ? "short" : "immediate", mechanics: {} } };
}

function normalizedPlan(actor, options) {
  return prepareTask(actor, { effortLevels: 0, assetSteps: 0, extraHinderSteps: 0, extraEaseSteps: 0,
    spentAbilityEdge: 0, baseDamage: 0, armorModifier: 0, damageEffortLevels: 0,
    freeEffortLevels: 0, freeDamageEffortLevels: 0, freeEffortSource: "", powerShiftCategories: [],
    areaAttack: false, push: false, pushDamageEffortLevels: 0, ...options });
}

/**
 * Validate Ability, physical shield, declared range and ordered targets before
 * the first write. Bouncing Shield's later attacks are extra actions (CRD 852),
 * each with fresh Effort choices; activation cost belongs to the first attack.
 * Hidden Shield's paired attacks are both hindered, including the main attack.
 * Throwing commits loss of possession before rolling. Cancelling later options
 * leaves completed attacks/costs intact and the shield away until caught/retrieved.
 * @param {Item} ability Owned source Ability.
 * @param {object} options Explicit targets, mode, shield and read-only roll choices.
 * @returns {Promise<object|null>} Completed attacks/catch, or null before mutation.
 */
export async function executeShieldAbility(ability, { shieldId, mode = "throw", targets = [],
  mainAttackId = null, rangeConfirmed = false, rollOptions = {},
  chooseAttackOptions = null, catchOptions = null, chooseCatchOptions = null } = {}) {
  const actor = ability?.actor, kind = getShieldAbilityKind(ability);
  if (!kind || actor?.type !== "pc" || actor.isOwner === false || ability.isOwner === false
    || actor.items?.get(ability.id) !== ability || !Array.isArray(targets)) return null;
  return runActorActions([actor, ...targets], "shieldAttack", async context => {
    const shield = actor.items.get(shieldId);
    const thrown = mode === "throw";
    if (!canShieldAbsorbWound(shield) || shield.isOwner === false || !rangeConfirmed
      || !["throw", "melee", "paired"].includes(mode)) return null;
    if (["hidden-shield", "unyielding-shield"].includes(kind)
      && (shield.system.abilityItemId !== ability.id || shieldAbilityKind(shield, shieldOwnerItems(shield)) !== kind)) return null;
    if (kind === "hidden-shield" && thrown) return null;
    if (["throw-shield", "bouncing-shield"].includes(kind) && !thrown) return null;
    if (mode === "paired" && kind !== "hidden-shield") return null;
    if (targets.some(target => target?.type !== "npc" || target.isOwner === false
      || !target.uuid || !Number.isSafeInteger(target.system.level) || target.system.level < 0)) return null;
    if (mode === "paired" ? targets.length !== 2
      : !validShieldTargets(kind, targets.map(target => target.uuid))) return null;
    const main = mainAttackId ? actor.items.get(mainAttackId) : null;
    if (mode === "paired" && (main?.type !== "attack" || main.actor !== actor || main.isOwner === false)) return null;
    if (chooseAttackOptions !== null && typeof chooseAttackOptions !== "function") return null;
    if (chooseCatchOptions !== null && typeof chooseCatchOptions !== "function") return null;
    let flightId = null;
    const planAttack = (index, choices) => {
      if (!choices || choices.luckyShot || (choices.stat && !["might", "speed"].includes(choices.stat))) return null;
      if (kind === "hidden-shield" && choices.effectEffortLevels) return null;
      const weapon = mode === "paired" && index === 0 ? main : shieldAttackProfile(shield, { thrown, stat: choices.stat });
      const abilitySource = { itemId: ability.id, name: ability.name, kind, shieldItemId: shield.id };
      const options = prepareAttackOptions(weapon, { ...choices, [ACTION_CONTEXT]: context, equipmentFlightId: flightId,
        target: targets[index], difficulty: targets[index].system.level, areaAttack: false, extraAction: index > 0,
        abilitySource, activationCost: index === 0 && kind === "bouncing-shield" ? 3 : 0,
        extraHinderSteps: (choices.extraHinderSteps ?? 0) + (mode === "paired" ? 1 : 0) });
      if (!options) return null;
      // CRD Power shifts supply the source's special Effort benefit without
      // occupying another paid Effort level (3063). Applicability is explicit.
      const hinders = choices.effectEffortLevels === 1
        || ((choices.powerShiftCategories ?? []).includes("power") && actor.system.powerShifts?.power > 0);
      if (hinders && kind !== "hidden-shield") options.weaponTargetEffects = [
        { effect: "hindered", hinderSteps: 1, duration: "one round", minimumTargetLevel: 0, maximumTargetLevel: null, shieldHindrance: true }
      ];
      return normalizedPlan(actor, options) ? options : null;
    };
    const first = planAttack(0, rollOptions);
    if (!first) return null;
    flightId = thrown ? foundry.utils.randomID() : null;
    first.weaponSource.equipmentFlightId = flightId;
    if (thrown) await shield.update({ "system.inHand": false, "system.equipped": false, "system.flightId": flightId });
    const results = [];
    for (let index = 0; index < targets.length; index++) {
      if (actor.items.get(ability.id) !== ability || actor.items.get(shield.id) !== shield
        || shield.isOwner === false || isShieldBroken(shield.system.wounds,
          shieldSurvivesMajor(shield, shieldOwnerItems(shield)))) break;
      const choices = index === 0 ? rollOptions : chooseAttackOptions
        ? await chooseAttackOptions({ index, target: targets[index], shield })
        : { ...rollOptions, freeEffortLevels: 0, freeDamageEffortLevels: 0, freeEffortSource: "", push: false, pushDamageEffortLevels: 0 };
      const options = index === 0 ? first : choices && planAttack(index, choices);
      if (!options) break;
      const result = await rollTask(actor, options);
      if (!result) break;
      results.push(result);
    }
    let caught = null;
    if (thrown) {
      const choices = chooseCatchOptions ? await chooseCatchOptions({ shield, results }) : catchOptions;
      if (choices) caught = await rollTask(actor, { ...choices, [ACTION_CONTEXT]: context, stat: "speed",
        difficulty: 2, isAttack: false, activationCost: 0, effectEffortLevels: 0, damageEffortLevels: 0,
        freeDamageEffortLevels: 0, pushDamageEffortLevels: 0, areaAttack: false,
        shieldReturn: { itemId: shield.id, flightId },
        abilitySource: { itemId: ability.id, name: ability.name, kind },
        flavor: game.i18n.localize("CYPHER.ShieldAbility.Catch") });
      if (!caught?.success) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p>${game.i18n.localize(kind === "bouncing-shield"
          ? "CYPHER.ShieldAbility.LandsImmediate" : "CYPHER.ShieldAbility.LandsShort")}</p>` });
    }
    return { results, caught, completed: results.length === targets.length };
  });
}
