/** Fresh ordinary attempts compose the task engine; no old effects or expenses are undone. */
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { rollTask } from "./task-service.mjs";
import { runActorActions, ACTION_CONTEXT } from "./action-guard.mjs";
import { taskRetryOrigin, taskRetryProblem, TASK_RETRY_CONTEXT } from "./task-retry-history.mjs";

/** Only these fresh player choices can enter the ordinary task pipeline. */
const CHOICES = ["effortLevels", "difficulty", "assetSteps", "skillItemId", "extraEaseSteps", "extraHinderSteps",
  "benefitSelections", "followerChoices", "cooperativeMode", "cooperativeEffectIds", "freeEffortLevels", "freeEffortSource", "rollRoutine", "powerShiftCategories", "noPhysicalMovement", "push"];

/** Repeated calls share the actual Actor reservation with paid rerolls and ordinary actions. */
export async function retryTask(actor, message, options = {}) {
  const source = taskRetryOrigin(message);
  if (actor?.type !== "pc" || actor.isOwner === false || !source || taskRetryProblem(source, actor)) return null;
  if (await resolveDocumentReference(source.flags.cypher.actorUuid, "pc") !== actor) return null;
  return runActorActions([actor, source], "taskRetry", async context => {
    if (taskRetryProblem(source, actor)) return null;
    const attempt = source.flags.cypher.taskAttempt;
    const choices = Object.fromEntries(CHOICES.filter(key => Object.hasOwn(options, key)).map(key => [key, options[key]]));
    return rollTask(actor, { ...choices, stat: attempt.stat, difficulty: choices.difficulty ?? attempt.difficulty,
      flavor: foundry.utils.escapeHTML(options.label ?? attempt.label),
      [TASK_RETRY_CONTEXT]: { source, label: options.label ?? attempt.label, duration: options.duration,
        sameTaskConfirmed: options.sameTaskConfirmed }, [ACTION_CONTEXT]: context });
  });
}

/** GM authority records possibility explicitly; it does not approve or spend a new action. */
export async function setTaskRetryPermission(message, { allowed, reason = "" } = {}) {
  const source = taskRetryOrigin(message);
  if (!game.user?.isGM || !source?.flags?.cypher?.taskAttempt || typeof allowed !== "boolean" || typeof reason !== "string") return false;
  return Boolean(await runActorActions([source], "taskRetryPolicy", async () => {
    await source.update({ "flags.cypher.taskRetryPolicy": { allowed, reason: reason.trim(), userId: game.user.id } });
    return true;
  }));
}

/** Manual reconciliation closes the uncertain predecessor without replaying costs or rolling again. */
export async function closeInterruptedTaskRetry(message, { reconciled = false } = {}) {
  const source = taskRetryOrigin(message);
  if (!game.user?.isGM || !reconciled || source?.flags?.cypher?.taskRetry?.state !== "pending") return false;
  return Boolean(await runActorActions([source], "taskRetryPolicy", async () => {
    await source.update({ "flags.cypher.taskRetry": { state: "closed" } });
    return true;
  }));
}
