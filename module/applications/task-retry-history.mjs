/** Original task cards own retry lineage, GM vetoes and pre-mutation checkpoints. */
import { isFailedTaskAttempt } from "../rules/task-retries.mjs";
import { canRetryTask } from "../rules/tasks.mjs";
export const TASK_RETRY_CONTEXT = Symbol("cypherTaskRetryContext");

/** Paid-reroll cards always refer to their actual original action card. */
export function taskRetryOrigin(message) {
  if (!message?.id || game.messages?.get(message.id) !== message) return null;
  const id = message.flags?.cypher?.rerollOriginId;
  return id ? game.messages.get(id) ?? null : message;
}

/** Expose card availability to sheets without importing deterministic rules there. */
export function hasTaskRetryControls(message) {
  const source = taskRetryOrigin(message);
  return Boolean(source?.flags?.cypher?.taskAttempt?.version === 1
    && (isFailedTaskAttempt(source.flags.cypher) || source.flags.cypher.taskRetry?.state));
}

/** Recheck every retained ancestor: a later successful paid reroll or GM veto closes the task. */
export function taskRetryProblem(message, actor = null) {
  const origin = taskRetryOrigin(message);
  if (!origin || origin.isOwner === false || !isFailedTaskAttempt(origin.flags?.cypher)) return "unavailable";
  if (actor && (actor.type !== "pc" || actor.isOwner === false || origin.flags.cypher.actorUuid !== actor.uuid)) return "unavailable";
  if (origin.flags.cypher.taskRetry?.state) return origin.flags.cypher.taskRetry.state === "pending" ? "interrupted" : "continued";
  const seen = new Set();
  let current = origin;
  while (current) {
    if (seen.has(current.id) || !isFailedTaskAttempt(current.flags?.cypher)) return "unavailable";
    seen.add(current.id);
    if (current.flags.cypher.taskRetryPolicy?.allowed === false) return "blocked";
    const parentId = current.flags.cypher.taskAttempt.parentMessageId;
    if (!parentId) break;
    const parent = game.messages.get(parentId);
    if (!parent || parent.flags?.cypher?.actorUuid !== origin.flags.cypher.actorUuid
      || !["pending", "done", "closed"].includes(parent.flags.cypher.taskRetry?.state)
      || parent.flags.cypher.taskRetry?.state === "done" && parent.flags.cypher.taskRetry.nextMessageId !== current.id) return "unavailable";
    if (parent.flags.cypher.taskRetry.state === "pending") return "interrupted";
    current = parent;
  }
  return null;
}

/** Validate fresh paid Effort after clamping, plus explicit same-task/time confirmation. */
export function validTaskRetry(actor, context, effort, stat) {
  const source = context?.source;
  const attempt = source?.flags?.cypher?.taskAttempt;
  return Boolean(source && !taskRetryProblem(source, actor) && context.sameTaskConfirmed === true
    && typeof context.label === "string" && context.label.trim()
    && typeof context.duration === "string" && context.duration.trim()
    && (!attempt.duration || attempt.duration === context.duration)
    && attempt.stat === stat && canRetryTask({ failed: true, effortLevels: effort.effortLevels }));
}

/** This checkpoint precedes action usage, costs and dice; uncertainty blocks replay after reload. */
export async function beginTaskRetry(context) {
  await context.source.update({ "flags.cypher.taskRetry": { state: "pending", actorUuid: context.source.flags.cypher.actorUuid } });
}

/** Only a known rejection before action usage may release the just-created checkpoint. */
export async function releaseTaskRetry(context) {
  await context.source.update({ "flags.cypher.taskRetry": null });
}

/** Publication succeeded; link this completed new action without altering its predecessor's outcome. */
export async function finishTaskRetry(context, message) {
  if (!message?.id) throw new Error("A retry must publish its new action card before completion");
  await context.source.update({ "flags.cypher.taskRetry": { state: "done", nextMessageId: message.id },
    "flags.cypher.taskAttempt": { ...context.source.flags.cypher.taskAttempt, label: context.label, duration: context.duration } });
}
