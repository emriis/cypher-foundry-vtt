/** Chat controls distinguish a fresh same-task attempt from an XP reroll. */
import { retryTask, setTaskRetryPermission, closeInterruptedTaskRetry } from "../applications/task-retry-service.mjs";
import { taskRetryOrigin, taskRetryProblem, hasTaskRetryControls } from "../applications/task-retry-history.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";
import { promptRollOptions } from "./dialogs.mjs";
const label = key => game.i18n.localize(`CYPHER.TaskRetry.${key}`);

/** UI cancellation has no writes; application preflight checks the card again after the dialog. */
export async function promptTaskRetry(actor, message) {
  const source = taskRetryOrigin(message);
  const problem = taskRetryProblem(source, actor);
  if (problem) { ui.notifications.warn(label(problem)); return null; }
  const attempt = source.flags.cypher.taskAttempt;
  const options = await promptRollOptions(actor, { stat: attempt.stat, difficulty: attempt.difficulty, retryAttempt: attempt });
  if (!options) return null;
  const result = await retryTask(actor, source, options);
  if (!result) ui.notifications.warn(label(taskRetryProblem(source, actor) ?? "invalid"));
  return result;
}

/** Read-only rendering delegates every accepted mutation to an application service. */
export async function renderTaskRetryControls(message, html) {
  const source = taskRetryOrigin(message);
  if (!hasTaskRetryControls(source)) return;
  const container = html instanceof HTMLElement ? html : html[0];
  const content = container?.querySelector(".message-content");
  if (!content || content.querySelector(".cypher-task-retry-controls")) return;
  const actor = await resolveDocumentReference(source.flags.cypher.actorUuid, "pc");
  if (!actor?.isOwner && !game.user.isGM) return;
  const controls = document.createElement("div");
  controls.className = "cypher-task-retry-controls";
  const problem = taskRetryProblem(source, actor);
  function button(className, text, action) {
    const element = document.createElement("button"); element.type = "button";
    element.className = className; element.textContent = text;
    element.addEventListener("click", async event => {
      event.preventDefault(); element.disabled = true;
      try { await action(); }
      catch (error) { ui.notifications.error(label("interrupted")); console.error("Cypher | Task retry interrupted", error); }
      finally { element.disabled = false; }
    });
    controls.appendChild(element);
  }
  if (actor?.isOwner && !problem) button("cypher-task-retry-button", label("retry"), () => promptTaskRetry(actor, source));
  if (["pending", "done", "closed"].includes(source.flags.cypher.taskRetry?.state) || problem === "blocked" || problem === "interrupted") {
    const note = document.createElement("p"); note.textContent = label(source.flags.cypher.taskRetry?.state === "closed" ? "closed" : problem ?? "continued"); controls.appendChild(note);
  }
  const policy = source.flags.cypher.taskRetryPolicy;
  if (policy?.reason) { const reason = document.createElement("p"); reason.textContent = policy.reason; controls.appendChild(reason); }
  if (game.user.isGM) {
    button("cypher-task-retry-policy", label(policy?.allowed === false ? "allow" : "forbid"), async () => {
      if (source.flags.cypher.taskRetryPolicy?.allowed === false) return setTaskRetryPermission(source, { allowed: true });
      const reason = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("forbid") },
        content: `<label>${label("reason")}<input name="reason" type="text"/></label>`,
        ok: { callback: (_event, button) => button.form.elements.reason.value } });
      if (reason !== null && reason !== undefined) await setTaskRetryPermission(source, { allowed: false, reason });
    });
    if (source.flags.cypher.taskRetry?.state === "pending") button("cypher-task-retry-close", label("close"), async () => {
      if (await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label("close") }, content: `<p>${label("reconcile")}</p>` })) {
        await closeInterruptedTaskRetry(source, { reconciled: true });
      }
    });
  }
  content.appendChild(controls);
}
