/** Collect explicit narrative decisions; the elected GM service owns XP writes. */
import { requestPlayerIntrusion, createGMIntrusion, requestIntrusionShare, resolvePlayerIntrusion,
  resolveIntrusionShare, getIntrusion, isIntrusionAuthority } from "../applications/intrusion-service.mjs";
import { intrusionLabel as label, intrusionMessageContent } from "../applications/intrusion-message.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";

const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const dialog = () => foundry.applications.api.DialogV2;
const warn = () => ui.notifications.warn(label("Unavailable"));

/** Cancellation creates no request and no XP charge; ordinary intrusions consume no action. */
export async function promptPlayerIntrusion(actor, reactionTo = null) {
  if (!(actor.system.xp >= 1)) { warn(); return; }
  const description = await dialog().prompt({ rejectClose: false, window: { title: label(reactionTo ? "React" : "player") },
    content: `<p>${label("PlayerHint")}</p>${reactionTo ? `<p>${label("ReactionHint")}</p>` : ""}<div class="form-group"><label for="intrusion-description">${label("Description")}</label>
      <textarea id="intrusion-description" name="description" required></textarea></div>`,
    ok: { label: label("Request"), callback: (_event, button) => button.form.description.value } });
  if (typeof description === "string" && !await requestPlayerIntrusion(actor, description, { reactionTo })) warn();
}

/** A free intrusion is offered only by a retained natural-one task card. */
export async function promptGMIntrusion(actor, rollMessage = null) {
  if (!isIntrusionAuthority()) { warn(); return; }
  const result = await dialog().prompt({ rejectClose: false, window: { title: label(rollMessage ? "gmFree" : "gm") },
    content: `<p>${label(rollMessage ? "FreeHint" : "ShareHint")}</p><div class="form-group"><label for="intrusion-description">${label("Description")}</label>
      <textarea id="intrusion-description" name="description" required></textarea></div>`,
    ok: { label: label("Declare"), callback: (_event, button) => button.form.description.value } });
  if (typeof result === "string" && !await createGMIntrusion(actor, result, { rollMessage })) warn();
}

/** Select a different player and their assigned PC, including players currently offline. */
async function promptShare(message) {
  const record = getIntrusion(message);
  const choices = game.users.filter(user => user.id !== record.sourcePlayerId && user.character?.type === "pc"
    && user.character.uuid !== record.sourceUuid && (user.isGM || user.character.testUserPermission(user, "OWNER")));
  if (!choices.length) { ui.notifications.warn(label("NoRecipient")); return; }
  const playerId = await dialog().prompt({ rejectClose: false, window: { title: label("Share") },
    content: `<p>${label("ShareHint")}</p><div class="form-group"><label for="intrusion-recipient">${label("Recipient")}</label>
      <select id="intrusion-recipient" name="recipient">${choices.map(user => `<option value="${escape(user.id)}">${escape(user.name)} — ${escape(user.character.name)}</option>`).join("")}</select></div>`,
    ok: { label: label("Share"), callback: (_event, button) => button.form.recipient.value } });
  if (!playerId) return;
  const player = game.users.get(playerId);
  if (!player || !await requestIntrusionShare(message, player.character, playerId)) warn();
}

/** Attach per-client controls to cards; each service rechecks state and permissions after the click. */
export async function renderIntrusionControls(message, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const record = getIntrusion(message);
  const container = root.querySelector(".message-content");
  if (!container) return;
  const button = (key, action) => {
    const element = document.createElement("button");
    element.type = "button"; element.dataset.intrusionAction = key; element.textContent = label(key);
    element.addEventListener("click", async event => {
      event.preventDefault(); element.disabled = true;
      try { await action(); }
      catch (error) { console.error("Cypher | Intrusion action failed", error); warn(); }
      finally { element.disabled = false; }
    });
    container.append(element);
  };
  if (!record) {
    const flags = message.flags?.cypher;
    if (isIntrusionAuthority() && flags?.rollType === "task" && flags.d20 === 1) {
      const actor = await resolveDocumentReference(flags.actorUuid, "pc");
      if (actor) button("Free", () => promptGMIntrusion(actor, message));
    }
    return;
  }
  container.innerHTML = intrusionMessageContent(record);
  const actor = await resolveDocumentReference(record.sourceUuid, "pc");
  if (!actor) return;
  if (record.kind === "player" && isIntrusionAuthority()) {
    if (record.state === "pending") {
      button("Accept", async () => { if (!await resolvePlayerIntrusion(message)) warn(); });
      button("Reject", async () => { if (!await resolvePlayerIntrusion(message, { accept: false })) warn(); });
    } else if (record.state === "processing") button("Resume", async () => { if (!await resolvePlayerIntrusion(message)) warn(); });
  }
  if (record.kind === "choice" && record.state === "pending" && isIntrusionAuthority()) {
    button("Resume", async () => { if (!await resolveIntrusionShare(message)) warn(); });
  }
  if (["gm", "gmFree"].includes(record.kind) && actor.isOwner && (game.user.isGM || game.user.id === record.sourcePlayerId)) {
    if (record.kind === "gm" && record.state === "awaitingRecipient") button("Share", () => promptShare(message));
    if (record.reactionDeadline) button("React", () => promptPlayerIntrusion(actor, message.uuid));
  }
}
