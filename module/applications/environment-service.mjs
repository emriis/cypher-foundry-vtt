import { followerTaskPlan } from "./follower-service.mjs";
import { speciesTaskPlan, speciesDamageReduction } from "./species-benefit-service.mjs";
import { reduceWoundSeverity } from "../rules/wounds.mjs";
/** GM-adjudicated hazards on actual PCs; CRD Special Damage (7815–7823), no invented hazard table. */
import { normalizeEnvironmentalProfile, environmentalConsequences, environmentalExposureDue } from "../rules/environment.mjs";
import { runActorAction, ACTION_CONTEXT } from "./action-guard.mjs";
import { rollDefense } from "./task-service.mjs";
import { applyDefenseConsequences } from "./defense-consequence-service.mjs";
import { prepareTask } from "./task-preparation.mjs";
import { cooperativeTaskPlan } from "./cooperative-service.mjs";
import { resolveStat } from "../rules/stats.mjs";

const path = "flags.cypher.environmentalExposures";
const ownedPC = actor => actor?.type === "pc" && typeof actor.uuid === "string" && actor.isOwner !== false;

/** Only the elected GM triggers hazards; players can reroll their own resulting defense cards. */
export function isEnvironmentAuthority() {
  return game.user?.isGM === true && game.users?.activeGM?.id === game.user.id;
}

/** Read saved profiles without mutations; old Actors default to no exposures. */
export function getEnvironmentalExposures(actor) {
  return (actor?.flags?.cypher?.environmentalExposures ?? []).filter(entry => entry.version === 1);
}

async function saveExposure(actor, record) {
  const entries = getEnvironmentalExposures(actor);
  await actor.update({ [path]: entries.some(entry => entry.id === record.id)
    ? entries.map(entry => entry.id === record.id ? record : entry) : [...entries, record] });
}

/**
 * Save a GM declaration without applying damage or spending an action.
 * @param {object} actor Actual owned PC, preserving synthetic identity.
 * @param {object} input Explicit profile; intervals are seconds of game time.
 * @returns {Promise<object|null>} Ready exposure, or null when unauthorized/invalid/busy.
 */
export async function declareEnvironmentalExposure(actor, input) {
  const profile = normalizeEnvironmentalProfile(input);
  if (!isEnvironmentAuthority() || !ownedPC(actor) || !profile) return null;
  return runActorAction(actor, "environmentDeclaration", async () => {
    const record = { version: 1, id: foundry.utils.randomID(), declaredBy: game.user.id,
      actorUuid: actor.uuid, profile, state: "ready", sequence: 0, nextAt: null };
    await saveExposure(actor, record);
    return record;
  });
}

const choiceKeys = ["effortLevels", "assetSteps", "skillItemId", "extraHinderSteps", "extraEaseSteps", "rollRoutine",
  "push", "freeEffortLevels", "freeEffortSource", "powerShiftCategories", "luckyShot", "followerChoices", "benefitSelections", "cooperativeMode", "cooperativeEffectIds"];

/** Read-only preflight precedes the processing checkpoint; the task engine checks fresh state again. */
async function defenseAvailable(actor, profile, choices) {
  const cooperation = cooperativeTaskPlan(actor, choices.cooperativeMode ?? null, true, null, choices.cooperativeEffectIds ?? null);
  if (!cooperation) return false;
  const following = await followerTaskPlan(actor, choices.followerChoices ?? null, { defenseType: profile.stat });
  const species = speciesTaskPlan(actor, { selected: choices.benefitSelections ?? [], defenseType: profile.stat, skillItemId: choices.skillItemId ?? null });
  if (!following || !species) return false;
  return Boolean(prepareTask(actor, { stat: profile.stat, difficulty: profile.difficulty,
    effortLevels: 0, skillItemId: null,
    luckyShot: false, spentAbilityEdge: 0, defenseType: profile.stat, armorModifier: 0,
    targetActor: null, isAttack: false, baseDamage: 0, damageEffortLevels: 0,
    freeEffortLevels: 0, freeDamageEffortLevels: 0, freeEffortSource: "", areaAttack: false,
    push: false, pushDamageEffortLevels: 0, powerShiftCategories: [], abilitySource: null,
    ...choices, conditionalSkillSteps: species.skillSteps, assetSteps: (choices.assetSteps ?? 0) + cooperation.assets + following.assets + species.assets,
    extraEaseSteps: (choices.extraEaseSteps ?? 0) + cooperation.ease,
    extraHinderSteps: (choices.extraHinderSteps ?? 0) + cooperation.hinder,
    noPhysicalMovement: profile.noPhysicalMovement }));
}

/**
 * Apply one explicitly triggered exposure; never run unattended dice or catch up missed intervals.
 * @param {object} actor Actual PC; only the elected GM mutates environmental state.
 * @param {string} id Saved exposure identity.
 * @param {object} options Requires expectedSequence; intervalPassed confirms narrative elapsed time.
 * @returns {Promise<object|null>} Result or null when stale, premature, unauthorized, or rejected.
 * Errors leave a processing/manual checkpoint rather than replaying possibly committed damage.
 */
export async function resolveEnvironmentalExposure(actor, id, options = {}) {
  if (!isEnvironmentAuthority() || !ownedPC(actor)) return null;
  return runActorAction(actor, "environmentResolution", async context => {
    const entry = getEnvironmentalExposures(actor).find(record => record.id === id);
    const profile = normalizeEnvironmentalProfile(entry?.profile);
    const now = game.time?.worldTime;
    if (!profile || entry.actorUuid !== actor.uuid
      || !environmentalExposureDue(entry, options.expectedSequence, now, options.intervalPassed)) return null;
    const effects = environmentalConsequences(profile);
    // Preview personal resistance for complete protection without reducing the
    // packet twice: actual consequence writes still receive its original severity.
    let personalSeverity = effects.severity;
    for (let step = 0; personalSeverity && step < speciesDamageReduction(actor, profile.damageTags ?? []); step++) personalSeverity = reduceWoundSeverity(personalSeverity);
    const protectedFromAll = !personalSeverity && !effects.poolDamage && !effects.conditions.length;
    const choices = Object.fromEntries(choiceKeys.filter(key => key in options).map(key => [key, options[key]]));
    if (effects.poolDamage && !resolveStat(actor.system, effects.poolDamage.stat)
      || profile.mode === "defense" && !protectedFromAll && !await defenseAvailable(actor, profile, choices)) return null;
    // Persist before the first cost/die/damage write. A crash cannot silently replay this occurrence.
    await saveExposure(actor, { ...entry, state: "processing" });
    try {
      let result;
      const source = { id, sequence: entry.sequence, name: profile.name };
      if (profile.mode === "defense" && !protectedFromAll) {
        result = await rollDefense(actor, profile.stat, { ...choices, difficulty: profile.difficulty,
          incomingDamageTags: profile.damageTags ?? [], incomingSeverity: effects.severity ?? "minor", incomingWounds: effects.wounds,
          applyIncomingWound: effects.severity !== null, incomingPoolDamage: effects.poolDamage,
          conditionsOnFailure: effects.conditions, noPhysicalMovement: profile.noPhysicalMovement,
          environmentalSource: source, shieldItemId: null, isAttack: false, [ACTION_CONTEXT]: context });
        if (!result) { await saveExposure(actor, entry); return null; }
      } else {
        const applied = await applyDefenseConsequences(actor, { defenseType: profile.stat ?? "might", success: false,
          incomingDamageTags: profile.damageTags ?? [], incomingSeverity: effects.severity ?? "minor", incomingWounds: effects.wounds,
          applyIncomingWound: effects.severity !== null, incomingPoolDamage: effects.poolDamage,
          conditionsOnFailure: effects.conditions, usingShield: false, actionContext: context });
        const escape = value => foundry.utils.escapeHTML(String(value));
        const wounds = Object.entries(applied.defenseConsequences.wounds).filter(([, count]) => count > 0)
          .map(([severity, count]) => `${game.i18n.localize(`CYPHER.General.${severity}`)}: ${count}`).join(", ");
        const pool = effects.poolDamage && applied.defensePoolDamage > 0
          ? `${game.i18n.localize(`CYPHER.Stat.${effects.poolDamage.stat}`)}: ${applied.defensePoolDamage}` : "";
        const conditions = effects.conditions.map(effect => game.i18n.localize(`CYPHER.General.${effect.kind}`)).join(", ");
        await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
          content: `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.Environment.title")}</h3>
            <p>${escape(profile.name)}</p><p>${game.i18n.localize(protectedFromAll ? "CYPHER.Environment.protected" : "CYPHER.Environment.immediate")}</p>
            ${wounds ? `<p>${escape(wounds)}</p>` : ""}${pool ? `<p>${escape(pool)}</p>` : ""}${conditions ? `<p>${escape(conditions)}</p>` : ""}</div>`,
          flags: { cypher: { rollType: "environment", rerollable: false, actorUuid: actor.uuid,
            environmentalSource: source, profile, ...applied } } });
        result = { ...applied, protected: protectedFromAll };
      }
      const latestTime = game.time?.worldTime;
      await saveExposure(actor, { ...entry, sequence: entry.sequence + 1,
        state: profile.intervalSeconds === null ? "completed" : "ready",
        nextAt: profile.intervalSeconds !== null && Number.isFinite(latestTime) ? latestTime + profile.intervalSeconds : null });
      return result;
    } catch (error) {
      // No snapshot rollback: wounds/costs or chat may already have committed.
      try { await saveExposure(actor, { ...entry, state: "manual" }); }
      catch { /* The earlier processing checkpoint still prevents automatic replay. */ }
      throw error;
    }
  });
}

/**
 * End future exposure without healing wounds or clearing separately tracked conditions.
 * @param {object} actor Actual PC owned by the active GM.
 * @param {string} id Saved exposure identity.
 * @param {{reconciled?: boolean}} options True confirms GM reconciliation of an interrupted occurrence.
 * @returns {Promise<boolean>} True after ending; false if unauthorized, busy, ended or unreconciled.
 */
export async function endEnvironmentalExposure(actor, id, { reconciled = false } = {}) {
  if (!isEnvironmentAuthority() || !ownedPC(actor)) return false;
  return Boolean(await runActorAction(actor, "environmentEnd", async () => {
    const entry = getEnvironmentalExposures(actor).find(record => record.id === id);
    if (!entry || ["ended", "completed"].includes(entry.state)) return false;
    if (["manual", "processing"].includes(entry.state) && reconciled !== true) return false;
    await saveExposure(actor, { ...entry, state: "ended" });
    return true;
  }));
}
