/** CRD Retrying a Task After Failure: explicit ordinary-task identity, never prose inference. */

/** Specialized actions retain their own validation and consequence workflows. */
export function isOrdinaryRetryTask(options) {
  return !options.isAttack && !options.defenseType && !options.initiative && !options.shieldReturn
    && !options.woundRemovalSeverity && !options.abilitySource && !options.ruleEffect
    && !options.targetActor && (!options.cooperativeMode || ["none", "help"].includes(options.cooperativeMode)) && !options.environmentalSource
    && !options.npcSource && !options.minorActivity && !options.extraAction && !options.activationCost;
}

/** Read the retained result, including paid rerolls, without recreating lost historical inputs. */
export function isFailedTaskAttempt(flags) {
  const attempt = flags?.taskAttempt;
  const die = flags?.originalRoll ?? flags?.d20;
  return flags?.rollType === "task" && attempt?.version === 1 && isOrdinaryRetryTask(flags)
    && typeof flags.actorUuid === "string" && flags.actorUuid.length > 0
    && attempt.stat === flags.stat && Number.isSafeInteger(attempt.difficulty) && attempt.difficulty >= 0
    && Number.isSafeInteger(die) && die >= 1 && die <= 20
    && Number.isFinite(flags.targetNumber) && flags.targetNumber > die;
}
