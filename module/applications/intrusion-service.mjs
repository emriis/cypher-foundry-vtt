/** GM-authoritative intrusion decisions, player requests, and idempotent multi-Actor XP settlement. */
import { intrusionXPPlan, intrusionReactionIsCurrent } from "../rules/intrusions.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { nextSourceTurn } from "./general-effect-service.mjs";
import { getRoundFlow } from "./round-action-service.mjs";
import { intrusionMessageContent } from "./intrusion-message.mjs";

const flagPath = "flags.cypher.intrusion";
const receiptPath = "flags.cypher.intrusionReceipts";
const pc = actor => actor?.type === "pc" && typeof actor.uuid === "string";
const ownedBy = (actor, user) => Boolean(user && (user.isGM || actor?.testUserPermission?.(user, "OWNER")));

/** A single elected GM settles all clients' requests; other clients never write another player's XP. */
export function isIntrusionAuthority() {
  return game.user?.isGM === true && game.users?.activeGM?.id === game.user.id;
}

/** Read versioned cards only; ordinary chat and old descriptive intrusion messages remain ordinary chat. */
export function getIntrusion(message) {
  const record = message?.flags?.cypher?.intrusion;
  return record?.version === 1 && ["player", "gm", "gmFree", "choice"].includes(record.kind) ? record : null;
}

function playerFor(actor) {
  const assigned = game.users?.find?.(user => !user.isGM && user.character?.id === (actor.parent?.actorId ?? actor.id)
    && ownedBy(actor, user));
  if (assigned) return assigned;
  const owners = game.users?.filter?.(user => !user.isGM && ownedBy(actor, user)) ?? [];
  // A user's secondary PC still belongs to that player. Shared ownership needs
  // an explicit sourcePlayerId rather than silently treating the GM as affected.
  return owners.length === 1 ? owners[0] : null;
}

async function createCard(actor, record) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: intrusionMessageContent(record), flags: { cypher: { intrusion: record } } });
}

async function updateCard(message, patch) {
  const record = { ...getIntrusion(message), ...patch };
  return message.update({ [flagPath]: record, content: intrusionMessageContent(record) });
}

/**
 * Propose a narrative change without spending XP or a combat action.
 * @param {object} actor Actual owned PC, including a synthetic Actor.
 * @param {string} description Nonblank narrative proposal, escaped for chat.
 * @param {{reactionTo?: string|null}} options Optional GM-card UUID; requires the next primary turn.
 * @returns {Promise<object|null>} Persisted pending ChatMessage, or null on invalid input.
 */
export async function requestPlayerIntrusion(actor, description, { reactionTo = null } = {}) {
  if (!pc(actor) || actor.isOwner === false || typeof description !== "string" || !description.trim()
    || !Number.isSafeInteger(actor.system.xp) || actor.system.xp < 1) return null;
  const origin = reactionTo ? await resolveDocumentReference(reactionTo) : null;
  const parent = getIntrusion(origin);
  if (reactionTo && (!parent || !["gm", "gmFree"].includes(parent.kind) || parent.sourceUuid !== actor.uuid
    || !reactionIsCurrent(parent.reactionDeadline, actor))) return null;
  return createCard(actor, { version: 1, kind: "player", state: "pending", sourceUuid: actor.uuid,
    sourceName: actor.name, sourcePlayerId: game.user.id, description: description.trim(),
    reactionTo: origin?.uuid ?? null, reactionDeadline: parent?.reactionDeadline ?? null });
}

/**
 * Declare an intrusion as active GM. Paid awards await a share; free ones grant no XP.
 * @param {object} actor Actual affected PC.
 * @param {string} description GM-adjudicated narrative consequence.
 * @param {{rollMessage?: object|null, sourcePlayerId?: string|null}} options A task card requests a natural-one free intrusion.
 * @returns {Promise<object|null>} Created/reused ChatMessage, or null for rejected input or a busy owner.
 */
export async function createGMIntrusion(actor, description, { rollMessage = null, sourcePlayerId = null } = {}) {
  if (!isIntrusionAuthority() || !pc(actor) || actor.isOwner === false || typeof description !== "string" || !description.trim()) return null;
  const free = Boolean(rollMessage);
  if (rollMessage?.flags?.cypher?.rerollOriginId) rollMessage = game.messages.get(rollMessage.flags.cypher.rerollOriginId);
  if (free && (!rollMessage?.uuid || rollMessage.flags?.cypher?.d20 !== 1
    || rollMessage.flags.cypher.rollType !== "task" || rollMessage.flags.cypher.actorUuid !== actor.uuid)) return null;
  const sourcePlayer = sourcePlayerId ? game.users.get(sourcePlayerId) : playerFor(actor) ?? (free ? game.user : null);
  if (!ownedBy(actor, sourcePlayer)) return null;
  return runActorActions([actor, rollMessage], "gmIntrusion", async () => {
    if (free) {
      const existing = game.messages.find(message => getIntrusion(message)?.rollUuid === rollMessage.uuid);
      if (existing) return existing;
    }
    return createCard(actor, { version: 1, kind: free ? "gmFree" : "gm", state: free ? "resolved" : "awaitingRecipient",
      sourceUuid: actor.uuid, sourceName: actor.name, sourcePlayerId: sourcePlayer.id, description: description.trim(),
      rollUuid: rollMessage?.uuid ?? null, reactionDeadline: nextSourceTurn(actor) });
  });
}

/**
 * Select another player and that player's PC; XP remain GM-owned writes.
 * @param {object} message Pending GM intrusion card.
 * @param {object} recipient Actual recipient PC; the sender need not own it.
 * @param {string} recipientPlayerId Owning User ID, distinct from the affected player.
 * @returns {Promise<object|null>} Pending choice card, or null when invalid/unauthorized.
 */
export async function requestIntrusionShare(message, recipient, recipientPlayerId) {
  const record = getIntrusion(message), user = game.users.get(recipientPlayerId);
  const source = await resolveDocumentReference(record?.sourceUuid, "pc");
  if (!record || record.kind !== "gm" || record.state !== "awaitingRecipient" || !pc(source) || source.isOwner === false
    || !(game.user.isGM || game.user.id === record.sourcePlayerId) || !pc(recipient)
    || recipient.uuid === source.uuid || !user || user.id === record.sourcePlayerId || !ownedBy(recipient, user)) return null;
  return createCard(source, { version: 1, kind: "choice", state: "pending", sourceUuid: source.uuid,
    sourceName: source.name, sourcePlayerId: record.sourcePlayerId, description: record.description,
    originUuid: message.uuid, recipientUuid: recipient.uuid, recipientName: recipient.name, recipientPlayerId: user.id });
}

function reactionIsCurrent(deadline, actor) {
  const combat = game.combat, flow = getRoundFlow(combat), active = combat?.combatant;
  return active?.actor === actor && intrusionReactionIsCurrent(deadline, {
    combatId: combat.id, combatantId: active.id, turnRevision: combat.flags?.cypher?.turnRevisions?.[active.id] ?? 0,
    phase: flow?.queue?.[flow.cursor]?.phase ?? "normal", rewound: Boolean(flow?.rewindAnchor)
  });
}

function receipts(actor) { return actor.flags?.cypher?.intrusionReceipts ?? []; }

/** XP and its receipt share one Actor write. A retry adds to current XP rather than restoring an old snapshot. */
async function applyReceipt(actor, id, delta) {
  const previous = receipts(actor).find(receipt => receipt.id === id);
  if (previous) {
    if (previous.delta !== delta) throw Error("Intrusion receipt conflicts with the frozen settlement");
    return;
  }
  const xp = actor.system.xp;
  if (!Number.isSafeInteger(xp) || !Number.isSafeInteger(xp + delta) || xp + delta < 0) throw Error("Intrusion XP changed before settlement");
  await actor.update({ "system.xp": xp + delta, [receiptPath]: [...receipts(actor), { id, delta }] });
  if (!receipts(actor).some(receipt => receipt.id === id)) throw Error("Intrusion XP write was not committed");
}

/**
 * Accept/reject a player request, or resume its frozen debit after partial failure.
 * @param {object} message Pending/processing player-intrusion card.
 * @param {{accept?: boolean}} options False rejects only a still-pending request.
 * @returns {Promise<boolean>} True after a saved decision; false when unavailable.
 * Persistence errors propagate; processing cards retain enough state to resume.
 */
export async function resolvePlayerIntrusion(message, { accept = true } = {}) {
  const record = getIntrusion(message);
  if (!isIntrusionAuthority() || record?.kind !== "player" || !["pending", "processing"].includes(record.state)) return false;
  const actor = await resolveDocumentReference(record.sourceUuid, "pc");
  if (!pc(actor) || actor.isOwner === false || !ownedBy(actor, message.author)) return false;
  return Boolean(await runActorActions([message, actor, game.combat], "intrusionDecision", async () => {
    const current = getIntrusion(message);
    if (!["pending", "processing"].includes(current.state)) return false;
    if (current.state === "pending" && !accept) { await updateCard(message, { state: "rejected", decisionBy: game.user.id }); return true; }
    if (current.state === "pending" && (current.reactionTo && !reactionIsCurrent(current.reactionDeadline, actor)
      || !intrusionXPPlan("player", { xp: actor.system.xp }))) return false;
    if (current.state === "pending") await updateCard(message, { state: "processing", decisionBy: game.user.id });
    await applyReceipt(actor, message.uuid, -1);
    await updateCard(message, { state: "resolved" });
    return true;
  }));
}

/**
 * Apply the mandatory 2-XP award and immediate 1-XP transfer as two net +1 contributions.
 * @param {object} choice Player-authored share choice, validated by the elected GM.
 * @returns {Promise<boolean>} True after settlement/supersession; false when unavailable.
 * Actor writes are sequential, not atomic across Actors; errors leave resumable receipts.
 */
export async function resolveIntrusionShare(choice) {
  const selection = getIntrusion(choice);
  if (!isIntrusionAuthority() || selection?.kind !== "choice" || selection.state !== "pending") return false;
  const origin = await resolveDocumentReference(selection.originUuid), record = getIntrusion(origin);
  if (!record || record.kind !== "gm" || !origin.author?.isGM
    || selection.sourceUuid !== record.sourceUuid || selection.sourcePlayerId !== record.sourcePlayerId) return false;
  const source = await resolveDocumentReference(record.sourceUuid, "pc");
  if (!pc(source) || source.isOwner === false || !ownedBy(source, choice.author)
    || !(choice.author.isGM || choice.author.id === record.sourcePlayerId)) return false;
  const frozen = record.state === "processing" ? record.settlement : selection;
  const recipient = await resolveDocumentReference(frozen?.recipientUuid, "pc"), player = game.users.get(frozen?.recipientPlayerId);
  if (!pc(recipient) || recipient.isOwner === false || !ownedBy(recipient, player)
    || !intrusionXPPlan("gm", { distinctPlayer: player.id !== record.sourcePlayerId, distinctActor: recipient.uuid !== source.uuid })) return false;
  return Boolean(await runActorActions([choice, origin, source, recipient], "intrusionAward", async () => {
    const current = getIntrusion(origin);
    if (current.state === "resolved") {
      const same = selection.recipientUuid === current.settlement.recipientUuid
        && selection.recipientPlayerId === current.settlement.recipientPlayerId;
      await updateCard(choice, { state: same ? "resolved" : "superseded" }); return true;
    }
    if (!["awaitingRecipient", "processing"].includes(current.state)) return false;
    if (current.state === "processing" && (current.settlement.recipientUuid !== recipient.uuid
      || current.settlement.recipientPlayerId !== player.id)) return false;
    // Reject invalid resource values before freezing a new award. Receipted
    // contributions on retries are already committed and must not be repeated.
    if ([source, recipient].some(actor => !receipts(actor).some(receipt => receipt.id === origin.uuid)
      && (!Number.isSafeInteger(actor.system.xp) || actor.system.xp < 0 || !Number.isSafeInteger(actor.system.xp + 1)))) return false;
    if (current.state === "awaitingRecipient") await updateCard(origin, { state: "processing",
      recipientUuid: recipient.uuid, recipientName: recipient.name,
      settlement: { recipientUuid: recipient.uuid, recipientPlayerId: player.id } });
    await applyReceipt(source, origin.uuid, 1);
    await applyReceipt(recipient, origin.uuid, 1);
    await updateCard(origin, { state: "resolved" });
    await updateCard(choice, { state: selection.recipientUuid === recipient.uuid
      && selection.recipientPlayerId === player.id ? "resolved" : "superseded" });
    return true;
  }));
}

/** Resume only already authorized shares. Player proposals always require an explicit GM decision. */
export async function resumeIntrusionShares() {
  if (!isIntrusionAuthority()) return;
  for (const message of game.messages ?? []) {
    if (getIntrusion(message)?.kind === "choice" && getIntrusion(message).state === "pending") await resolveIntrusionShare(message);
  }
}
