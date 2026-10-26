/**
 * CRD Resource Points: persistent downtime proposals and elected-GM settlement.
 * Existing system.resourcePoints remains the only currency store. Versioned
 * flags hold workflow/history, not a second balance. No old data is converted.
 */
import { quoteProject } from "../rules/projects.mjs";
import { runActorActions } from "./action-guard.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { objectDisplay } from "./object-service.mjs";

const root = "flags.cypher.projects";
const pc = actor => actor?.type === "pc" && actor.isOwner !== false && typeof actor.uuid === "string";
const validId = id => typeof id === "string" && /^[A-Za-z0-9]+$/.test(id);
const receipts = actor => actor.flags?.cypher?.resourcePointReceipts ?? [];
const record = (actor, id) => {
  const project = validId(id) ? actor.flags?.cypher?.projects?.[id] : null;
  if (project?.version !== 1 || project.id !== id || !project.proposal || typeof project.proposal.kind !== "string"
    || !Number.isSafeInteger(project.proposal.durationSeconds) || project.proposal.durationSeconds < 0
    || !["draft", "active", "settling", "manual", "completed", "cancelled"].includes(project.state)) return null;
  return structuredClone(project);
};
const write = (actor, id, patch) => actor.update({ [`${root}.${id}`]: patch });
const now = () => game.time?.worldTime;

/** One active GM commits multi-owner changes; player clients only propose or cancel owned projects. */
export function isProjectAuthority() { return game.user?.isGM === true && game.users?.activeGM?.id === game.user.id; }

/** Read-only presentation leaves unknown legacy flags untouched. */
export function projectDisplay(actor) {
  return Object.keys(actor.flags?.cypher?.projects ?? {}).map(id => record(actor, id)).filter(Boolean).map(project => ({
    ...project, kindLabel: `CYPHER.Project.${project.proposal.kind}`, stateLabel: `CYPHER.Project.${project.state}`,
    hasCost: Number.isSafeInteger(project.cost), hasDeadline: Number.isFinite(project.readyAt),
    canCancel: ["draft", "active"].includes(project.state), canApprove: project.state === "draft" && isProjectAuthority(),
    canComplete: project.state === "active" && now() >= project.readyAt && isProjectAuthority(),
    canResume: project.state === "settling" && isProjectAuthority(), canReconcile: ["manual", "settling"].includes(project.state) && isProjectAuthority(),
    hoursRemaining: project.readyAt == null ? null : Math.max(0, Math.ceil((project.readyAt - now()) / 3600))
  }));
}

/**
 * Save intent without reserving or spending currency. The GM later confirms
 * genre, applicable skill/commission, duration and contributors' consent.
 * @param {Actor} actor Actual owning PC, including synthetic Actors.
 * @param {object} proposal Activity, label, durationSeconds and optional source/target/participants.
 * @returns {Promise<string|null>} Stable workflow ID, or null before writes for invalid input.
 */
export async function createProject(actor, proposal) {
  if (!pc(actor) || !proposal || typeof proposal.label !== "string" || !proposal.label.trim()
    || !Number.isSafeInteger(proposal.durationSeconds) || proposal.durationSeconds < 0) return null;
  return runActorActions([actor], "project", async () => {
    const id = foundry.utils.randomID();
    await write(actor, id, { version: 1, id, state: "draft", proposal: structuredClone(proposal), cost: null, readyAt: null });
    return id;
  });
}

/** Resolve actual documents and qualification; prose/names never establish crafting training. */
async function resolvePlan(actor, project) {
  const proposal = project.proposal;
  if (proposal.kind === "investment" && proposal.investmentConfirmed !== true) return null;
  let training = 0;
  const crafting = ["craftObject", "repairObject", "craftCypher", "craftArtifact"].includes(proposal.kind);
  const worker = proposal.workerUuid ? await resolveDocumentReference(proposal.workerUuid, "npc") : null;
  if (proposal.workerUuid && (!worker || worker.isOwner === false)) return null;
  if (crafting) {
    if (proposal.genreConfirmed !== true || proposal.skillAppropriate !== true) return null;
    training = worker ? proposal.workerTraining : { trained: 1, specialized: 2, expert: 3 }[actor.items?.get?.(proposal.skillItemId)?.system.level];
    if (!worker && actor.items?.get?.(proposal.skillItemId)?.type !== "skill") return null;
  }
  let target = null, source = null;
  const quoted = { ...proposal, training, befriendPenalty: actor.flags?.cypher?.befriendPenalty === true };
  if (["repairObject", "restoreFollower"].includes(proposal.kind)) {
    target = await resolveDocumentReference(proposal.targetUuid, proposal.kind === "repairObject" ? "object" : "npc");
    if (!target || target.isOwner === false) return null;
    if (proposal.kind === "repairObject") {
      const state = objectDisplay(target);
      if (!["broken", "functional"].includes(state.status) || state.levelDamage === 0) return null;
      quoted.level = state.originalLevel;
    } else {
      if (proposal.followerConfirmed !== true || !(target.system.health?.max > 0)) return null;
      quoted.level = target.system.level;
      // The CRD default is about a week; a shorter source-specific duration
      // must be explicitly identified rather than inferred from an NPC name.
      if (proposal.durationSeconds !== 604800 && !proposal.durationSource?.trim()) return null;
    }
  }
  if (proposal.sourceUuid) {
    source = await resolveDocumentReference(proposal.sourceUuid);
    const expected = { craftCypher: ["cypher"], craftArtifact: ["artifact"], craftObject: ["equipment", "attack", "armor", "shield"] }[proposal.kind];
    if (!expected?.includes(source?.type) || source.documentName && source.documentName !== "Item") return null;
    const sourceLevel = source.system.level == null || source.system.level === "" ? null : Number(source.system.level);
    if (["equipment", "artifact"].includes(source.type) && Number.isSafeInteger(sourceLevel) && sourceLevel > 0) quoted.level = sourceLevel;
  }
  if (["craftCypher", "craftArtifact"].includes(proposal.kind) && !source) return null;
  if (proposal.kind === "craftCypher") {
    if (source.system.cypherType !== "manifest") return null;
    const powers = source.system.powerLevels?.length ? source.system.powerLevels : [source.system.powerLevel];
    if (!powers.includes(proposal.power)) return null;
    if (source.system.variants?.length && !source.system.variants.some(variant => variant.name === proposal.variantName
      && variant.powerLevel === proposal.power)) return null;
  }
  const quote = quoteProject(quoted);
  if (!quote) return null;
  const contributors = [], seen = new Set([actor.uuid]);
  let contributed = 0;
  if (proposal.contributions !== undefined && !Array.isArray(proposal.contributions)) return null;
  for (const contribution of proposal.contributions ?? []) {
    if (!Number.isSafeInteger(contribution.amount) || contribution.amount < 1 || seen.has(contribution.actorUuid)) return null;
    const contributor = await resolveDocumentReference(contribution.actorUuid, "pc");
    if (!pc(contributor) || contributor === actor || seen.has(contributor.uuid)) return null;
    seen.add(contributor.uuid); contributed += contribution.amount;
    contributors.push({ actor: contributor, amount: contribution.amount });
  }
  if (contributed > quote.cost) return null;
  contributors.unshift({ actor, amount: quote.cost - contributed });
  return { quote, target, source, worker, contributors };
}

/** Specific cypher crafting selects an effect at the paid power, never a random higher-power result. */
export async function projectVariantChoices(sourceUuid, power) {
  const source = await resolveDocumentReference(sourceUuid, "cypher");
  return (source?.system.variants ?? []).filter(variant => variant.powerLevel === power).map(variant => variant.name);
}

/** Concrete, read-only approval review using resolved identities and the current source-backed quote. */
export async function projectReview(actor, id) {
  const project = record(actor, id);
  if (!pc(actor) || project?.state !== "draft") return null;
  const plan = await resolvePlan(actor, project);
  if (!plan) return null;
  return { cost: plan.quote.cost, hours: project.proposal.durationSeconds / 3600,
    target: plan.target?.name ?? "", source: plan.source?.name ?? "", worker: plan.worker?.name ?? "",
    skill: actor.items?.get?.(project.proposal.skillItemId)?.name ?? "",
    contributors: plan.contributors.map(entry => ({ uuid: entry.actor.uuid, name: entry.actor.name ?? entry.actor.id, amount: entry.amount })) };
}

/**
 * Approve fiction and consent, then start the declared interval without payment.
 * @param {Actor} actor Owning PC; only the elected GM may approve.
 * @param {string} id Existing proposal ID.
 * @param {object} [options={}] Explicit confirmation and optional concrete review to revalidate.
 * @returns {Promise<boolean>} False before writes for rejected or stale approval.
 */
export async function approveProject(actor, id, { confirmed = false, expectedReview = null } = {}) {
  if (!isProjectAuthority() || !pc(actor) || confirmed !== true || !Number.isFinite(now())) return false;
  return Boolean(await runActorActions([actor], "project", async () => {
    const project = record(actor, id);
    if (project?.state !== "draft") return false;
    const plan = await resolvePlan(actor, project);
    if (!plan || !Number.isFinite(now() + project.proposal.durationSeconds)) return false;
    if (expectedReview && JSON.stringify(await projectReview(actor, id)) !== JSON.stringify(expectedReview)) return false;
    await write(actor, id, { ...project, state: "active", cost: plan.quote.cost, approvedBy: game.user.id,
      readyAt: now() + project.proposal.durationSeconds });
    return true;
  }));
}

/** Cancel only before settlement; no currency has been reserved or spent. */
export async function cancelProject(actor, id) {
  if (!pc(actor)) return false;
  return Boolean(await runActorActions([actor], "project", async () => {
    const project = record(actor, id);
    if (!["draft", "active"].includes(project?.state)) return false;
    await write(actor, id, { ...project, state: "cancelled" }); return true;
  }));
}

/** Debit/award and its receipt share one Actor update, allowing safe resumed multi-owner settlement. */
async function applyReceipt(actor, id, delta, note) {
  const existing = receipts(actor).find(receipt => receipt.id === id);
  if (existing) {
    if (existing.delta !== delta) throw Error("Resource receipt mismatch");
    return;
  }
  const balance = actor.system.resourcePoints;
  if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(balance + delta) || balance + delta < 0) throw Error("Resource balance changed");
  await actor.update({ "system.resourcePoints": balance + delta,
    "flags.cypher.resourcePointReceipts": [...receipts(actor), { id, delta, note }] });
  if (!receipts(actor).some(receipt => receipt.id === id)) throw Error("Resource receipt was not committed");
}

function resultPlan(project, plan) {
  const { proposal } = project;
  if (proposal.kind === "repairObject") return { kind: "repair", targetUuid: plan.target.uuid,
    before: { levelDamage: plan.target.system.levelDamage, destructionDamage: plan.target.system.destructionDamage,
      revision: plan.target.flags?.cypher?.objectRevision ?? 0 } };
  if (proposal.kind === "restoreFollower") return { kind: "restore", targetUuid: plan.target.uuid,
    before: { value: plan.target.system.health.value, max: plan.target.system.health.max } };
  if (plan.source) {
    const data = { name: proposal.label, img: plan.source.img, type: plan.source.type,
      flags: { cypher: { projectSourceUuid: plan.source.uuid } }, system: structuredClone(plan.source.toObject().system) };
    if ("quantity" in data.system) data.system.quantity = 1;
    if ("equipped" in data.system) data.system.equipped = false;
    if ("depleted" in data.system) data.system.depleted = false;
    if (proposal.kind === "craftCypher") {
      data.system.powerLevel = proposal.power; data.system.powerLevels = [proposal.power];
      data.system.variants = [];
      data.flags.cypher.craftedVariant = proposal.variantName ?? "";
    }
    return { kind: "item", data };
  }
  if (proposal.kind === "craftObject") return { kind: "object", data: { name: proposal.label, type: "object",
    system: { originalLevel: proposal.level, material: proposal.material ?? "" } } };
  return { kind: "narrative" };
}

/**
 * Complete only after both elapsed time and explicit work confirmation. Freeze
 * all owners and the output before the first debit; failed writes remain
 * resumable. Output writes have a pending checkpoint because creation/repair
 * cannot be atomically combined with several resource-point debits.
 * @param {Actor} actor Owning PC, potentially a synthetic Actor.
 * @param {string} id Approved project ID.
 * @param {object} [options={}] workConfirmed acknowledges actual work, not just clock time.
 * @returns {Promise<boolean>} True after completion; false for rejection or required reconciliation.
 * @throws {Error} Failed writes preserve checkpoints/receipts and propagate to the caller.
 */
export async function completeProject(actor, id, { workConfirmed = false } = {}) {
  if (!isProjectAuthority() || !pc(actor) || workConfirmed !== true) return false;
  const project = record(actor, id);
  if (project?.state !== "active" || !Number.isFinite(project.readyAt) || !Number.isFinite(now()) || now() < project.readyAt) return false;
  const plan = await resolvePlan(actor, project);
  if (!plan || plan.quote.cost !== project.cost) return false;
  const owners = [actor, plan.target, plan.worker, ...plan.contributors.map(entry => entry.actor)];
  return Boolean(await runActorActions(owners, "project", async context => {
    if (JSON.stringify(record(actor, id)) !== JSON.stringify(project)) return false;
    if (plan.contributors.some(entry => !Number.isSafeInteger(entry.actor.system.resourcePoints) || entry.actor.system.resourcePoints < entry.amount)) return false;
    const settlement = { participants: plan.contributors.map(entry => ({ uuid: entry.actor.uuid, amount: entry.amount })),
      result: resultPlan(project, plan), resultState: "unstarted" };
    await write(actor, id, { ...project, state: "settling", settlement });
    return settle(actor, id, context);
  }));
}

async function settle(actor, id, context = null) {
  const project = record(actor, id);
  if (project?.state !== "settling") return false;
  const { settlement } = project;
  const participants = [];
  for (const participant of settlement.participants) {
    const owner = await resolveDocumentReference(participant.uuid, "pc");
    if (!pc(owner)) return false;
    participants.push({ actor: owner, amount: participant.amount });
  }
  const result = settlement.result;
  const target = result.targetUuid ? await resolveDocumentReference(result.targetUuid) : null;
  if (result.targetUuid && (!target || target.isOwner === false)) return false;
  return runActorActions([actor, target, ...participants.map(entry => entry.actor)], "projectSettlement", async () => {
    const receiptId = `${actor.uuid}:${id}`;
    if (participants.some(entry => !receipts(entry.actor).some(receipt => receipt.id === receiptId)
      && (!Number.isSafeInteger(entry.actor.system.resourcePoints) || entry.actor.system.resourcePoints < entry.amount))) return false;
    for (const participant of participants) await applyReceipt(participant.actor, receiptId, -participant.amount, project.proposal.label);
    if (settlement.resultState === "pending") {
      await write(actor, id, { ...project, state: "manual" }); return false;
    }
    if (settlement.resultState === "unstarted") {
      const changed = result.kind === "repair" && (target.system.levelDamage !== result.before.levelDamage
        || target.system.destructionDamage !== result.before.destructionDamage
        || (target.flags?.cypher?.objectRevision ?? 0) !== result.before.revision)
        || result.kind === "restore" && (target.system.health.value !== result.before.value || target.system.health.max !== result.before.max);
      if (changed) { await write(actor, id, { ...project, state: "manual" }); return false; }
      settlement.resultState = "pending";
      await write(actor, id, { ...project, settlement });
      if (result.kind === "repair") await target.update({ "system.levelDamage": 0, "system.destructionDamage": 0 });
      if (result.kind === "restore") await target.update({ "system.health.value": target.system.health.max });
      if (result.kind === "item") {
        const [created] = await actor.createEmbeddedDocuments("Item", [result.data]);
        settlement.resultUuid = created?.uuid ?? null;
      }
      if (result.kind === "object") {
        const created = await foundry.documents.Actor.create({ ...result.data, ownership: structuredClone(actor.ownership ?? {}) });
        settlement.resultUuid = created.uuid ?? null;
      }
      settlement.resultState = "applied";
      await write(actor, id, { ...project, settlement });
    }
    await write(actor, id, { ...project, settlement, state: "completed" });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${game.i18n.format("CYPHER.Project.result", {
      name: foundry.utils.escapeHTML(project.proposal.label), cost: project.cost })}</p>` });
    return true;
  }, context);
}

/**
 * Resume receipted debits; uncertain output is left for explicit GM reconciliation.
 * @param {Actor} actor Owning PC; only the elected GM may resume.
 * @param {string} id Interrupted settlement ID.
 * @returns {Promise<boolean>} Completion result, without repeating committed debits or outputs.
 */
export async function resumeProject(actor, id) {
  if (!isProjectAuthority() || !pc(actor)) return false;
  return settle(actor, id);
}

/** The GM confirms external reconciliation; this never refunds, recreates or repairs automatically. */
export async function reconcileProject(actor, id, { confirmed = false, note = "" } = {}) {
  if (!isProjectAuthority() || !pc(actor) || confirmed !== true || !note.trim()) return false;
  return Boolean(await runActorActions([actor], "project", async () => {
    const project = record(actor, id);
    if (!["manual", "settling"].includes(project?.state)) return false;
    await write(actor, id, { ...project, state: "completed", reconciliation: note }); return true;
  }));
}

/** GM awards/corrections use the existing balance and an idempotent request ID, never XP. */
export async function adjustResourcePoints(actor, delta, { id, note = "" } = {}) {
  if (!isProjectAuthority() || !pc(actor) || !validId(id) || !note.trim() || !Number.isSafeInteger(delta) || delta === 0) return false;
  return Boolean(await runActorActions([actor], "resourceAward", async () => {
    const existing = receipts(actor).find(receipt => receipt.id === `award:${id}`);
    if (existing) return existing.delta === delta;
    if (!Number.isSafeInteger(actor.system.resourcePoints) || actor.system.resourcePoints + delta < 0) return false;
    await applyReceipt(actor, `award:${id}`, delta, note); return true;
  }));
}

/** Fictional harm is explicitly declared by the GM, never inferred from arbitrary NPC Health loss. */
export async function setBefriendPenalty(actor, { confirmed = false } = {}) {
  if (!isProjectAuthority() || !pc(actor) || confirmed !== true) return false;
  await actor.update({ "flags.cypher.befriendPenalty": true }); return true;
}
