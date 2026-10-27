import { synchronizeFollowers } from "./follower-service.mjs";
/** CRD advancement purchases, source-backed Ability choices and legacy entitlement settlement. */
import { runActorAction } from "./action-guard.mjs";
import { CYPHER } from "../config.mjs";
import { getEligibleFocusAbilities } from "../rules/focus.mjs";
import { advanceSkillLevel, computeAdvancementEffects, computeTierAdvancement, validateAdvancementChoices,
  advancementResourcePoints, canPurchaseAdvancement, canPurchaseSkillTraining } from "../rules/advancement.mjs";
import { prepareAdvancementGrant } from "./advancement-grants.mjs";

const warn = key => ui.notifications.warn(game.i18n.localize(`CYPHER.Advancement.${key}`));
const ownedPC = actor => actor?.type === "pc" && actor.isOwner !== false;
const flag = (actor, key) => actor.flags?.cypher?.[key] ?? actor.getFlag?.("cypher", key);

/** Preserve only the explicit legacy Focus entitlement; new tiers never bank choices. */
export function getAdvancementChoices(actor) {
  const legacy = flag(actor, "focusAbilityPendingTier");
  return Number.isSafeInteger(legacy) && legacy > 0
    ? [{ id: `legacy-focus-${legacy}`, kind: "focus", tier: actor.system.tier }] : [];
}

/** Read-only projection lets subsequent choices see earlier grants in the same purchase. */
function projectGrant(actor, plan, tier) {
  const flags = structuredClone(actor.flags ?? {});
  flags.cypher ??= {};
  const system = { ...(actor.system.toObject?.() ?? actor.system), tier };
  for (const [path, value] of Object.entries(plan.updates)) {
    if (path.startsWith("system.")) system[path.slice(7)] = value;
    if (path.startsWith("flags.cypher.")) flags.cypher[path.slice(13)] = value;
  }
  const items = actor.items?.contents ?? (Array.isArray(actor.items) ? actor.items : [...(actor.items?.values?.() ?? [])]);
  return { type: "pc", system, flags, items: [...items, ...plan.items], getFlag(scope, key) { return this.flags[scope]?.[key]; } };
}

/** Determine source-backed choices required now, not entitlements to save for later. */
function tierKinds(actor) {
  const kinds = [];
  if (getEligibleFocusAbilities(flag(actor, "appliedFocusGraph"), flag(actor, "focusAbilityIds") ?? [], Math.min(actor.system.tier, 6)).length) kinds.push("focus");
  if (actor.system.tier % 3 === 0 && ["fantasy", "sciFi", "superhero", "custom"].includes(actor.system.genre)) kinds.push("genre");
  return kinds;
}

async function basePlan(actor, slot, extra) {
  const kind = slot.type === "other" && ["focus", "genre"].includes(slot.otherType) ? slot.otherType : null;
  return kind ? prepareAdvancementGrant(actor, kind, extra)
    : slot.type === "skill" ? skillPlan(actor, extra) : { ...computeAdvancementEffects(slot, extra, actor.system), items: [] };
}

/** Sheet-only preview: preflight the paid choice, then collect required new-tier grants without writes. */
export async function getTierAdvancementOptions(actor, index, extra = {}) {
  const slots = actor.system.advancementSlots;
  if (slots.length !== 4 || slots.filter((slot, position) => position !== index && slot.bought).length !== 3) return null;
  const plan = await basePlan(actor, slots[index], extra);
  if (!plan) return null;
  const projected = projectGrant(actor, plan, actor.system.tier + 1);
  return { actor: projected, tier: projected.system.tier, kinds: tierKinds(projected) };
}

/** Combine all required new-tier grants before the first cost or Item write. */
async function completeTierPlan(actor, plan, choices = {}) {
  let projected = projectGrant(actor, plan, actor.system.tier + 1);
  for (const kind of tierKinds(projected)) {
    const grant = await prepareAdvancementGrant(projected, kind, choices[kind], projected.system.tier);
    if (!grant) return false;
    Object.assign(plan.updates, grant.updates);
    plan.items.push(...grant.items);
    projected = projectGrant(projected, grant, projected.system.tier);
  }
  Object.assign(plan.updates, { "system.tier": actor.system.tier + 1,
    "system.advancementSlots": computeTierAdvancement(actor.system.tier).freshSlots,
    "flags.cypher.focusAbilityPendingTier": null });
  return true;
}

/** Read structured source restrictions, including old granted Skills retaining canonical provenance. */
export function canAdvanceOwnedSkill(item, tier) {
  const source = item.flags?.cypherFoundry?.crd;
  const id = source?.sourceLogicalId ?? source?.logicalId;
  const combat = ["skill.attacking", "skill.defending", "skill.gunnery"].includes(id);
  return item.type === "skill" && canPurchaseSkillTraining({ ...item.system,
    minimumTier: Math.max(item.system.minimumTier ?? 0, combat ? 2 : 0),
    minimumSpecializationTier: Math.max(item.system.minimumSpecializationTier ?? 0, combat ? 4 : 0),
    skillKind: item.flags?.cypher?.skillKind }, tier);
}

/** Validate the chosen Skill before paying. Custom combat training declares its kind explicitly. */
function skillPlan(actor, extra) {
  const tier = actor.system.tier ?? 1;
  if (extra.skillId) {
    const item = actor.items.get(extra.skillId);
    if (!item || item.isOwner === false || !canAdvanceOwnedSkill(item, tier)) return null;
    return { updates: {}, items: [], skill: item, skillLevel: advanceSkillLevel(item.system.level) };
  }
  const kind = extra.skillKind ?? "general";
  if (typeof extra.newSkillName !== "string" || !extra.newSkillName.trim() || !["general", "attack", "defense"].includes(kind)
    || (extra.attackCategory && !CYPHER.attackSkillCategories.includes(extra.attackCategory))) return null;
  const system = { level: "practiced", skillKind: kind, attackCategory: extra.attackCategory ?? "" };
  if (!canPurchaseSkillTraining(system, tier)) return null;
  return { updates: {}, items: [{ name: extra.newSkillName.trim(), type: "skill", flags: { cypher: { skillKind: kind } },
    system: { level: "trained", attackCategory: extra.attackCategory ?? "", minimumTier: kind === "general" ? null : 2,
      minimumSpecializationTier: kind === "general" ? null : 4 } }] };
}

/**
 * Purchase one accepted advancement. Actor-only costs, reward and tier transition
 * commit together. Embedded Item operations first persist a paid checkpoint;
 * failures retain that checkpoint and never repeat an uncertain spend or grant.
 */
export async function purchaseAdvancementSlot(actor, index, extra = {}) {
  if (!ownedPC(actor) || !Number.isInteger(index) || index < 0) return false;
  return (await runActorAction(actor, "advancement", async context => {
    if (flag(actor, "advancementPending")) { warn("Interrupted"); return false; }
    if (getAdvancementChoices(actor).length) { warn("ResolvePending"); return false; }
    const slots = actor.system.advancementSlots.map(slot => ({ ...slot }));
    const slot = slots[index];
    const purchases = flag(actor, "advancementPurchases") ?? [];
    if (!slot || slot.bought || !canPurchaseAdvancement(slot, index, actor.system, purchases)) { warn("Invalid"); return false; }
    if (slot.type === "perfection" && !Object.hasOwn(actor.system.stats, extra.stat || "might")) return false;
    const error = validateAdvancementChoices(slot, extra);
    if (error) { ui.notifications.error(game.i18n.localize(error)); return false; }
    const plan = await basePlan(actor, slot, extra);
    if (!plan) { warn("Invalid"); return false; }
    const cost = CYPHER.xpCosts.advancementSlot;
    if (!Number.isSafeInteger(actor.system.xp) || actor.system.xp < cost) {
      ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughXP", { amount: cost, reason: game.i18n.localize("CYPHER.Advancement.Title") }));
      return false;
    }
    const tier = actor.system.tier ?? 1;
    const completesTier = slots.length === 4 && slots.every((entry, position) => position === index || entry.bought);
    if (completesTier && !await completeTierPlan(actor, plan, extra.tierChoices)) { warn("NoChoices"); return false; }
    if (!ownedPC(actor) || plan.skill?.isOwner === false || actor.system.xp < cost) return false;
    slot.bought = true;
    const updates = { ...plan.updates, "system.advancementSlots": slots,
      "system.resourcePoints": (actor.system.resourcePoints ?? 0) + advancementResourcePoints(tier),
      "flags.cypher.advancementPurchases": [...purchases, { tier, index, type: slot.type, otherType: slot.otherType ?? "" }] };
    if (completesTier) updates["system.advancementSlots"] = plan.updates["system.advancementSlots"];
    const embedded = plan.skill || plan.items.length;
    if (embedded) {
      await actor.update({ "system.xp": actor.system.xp - cost, "flags.cypher.advancementPending": { version: 1, kind: "purchase", tier, index } });
      if (plan.skill) await plan.skill.update({ "system.level": plan.skillLevel });
      if (plan.items.length) await actor.createEmbeddedDocuments("Item", plan.items);
      updates["flags.cypher.advancementPending"] = null;
    } else updates["system.xp"] = actor.system.xp - cost;
    await actor.update(updates);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<p>${game.i18n.format("CYPHER.Advancement.PurchaseResult", { type: game.i18n.localize(`CYPHER.Advancement.${slot.type === "other" ? `other-${slot.otherType}` : slot.type}`), points: advancementResourcePoints(tier) })}</p>` });
    if (updates["system.tier"]) { await synchronizeFollowers(actor, context); await announceTier(actor, updates["system.tier"]); }
    return true;
  })) ?? false;
}

/** Explicit completion requires four bought slots; ordinary purchases already compose this update. */
export async function advanceTier(actor, options = {}) {
  if (!ownedPC(actor)) return false;
  return (await runActorAction(actor, "advancement", async context => {
    if (flag(actor, "advancementPending") || actor.system.advancementSlots?.length !== 4
      || !actor.system.advancementSlots.every(slot => slot.bought)) return false;
    const tier = actor.system.tier;
    if (!Number.isSafeInteger(tier) || tier < 1 || tier >= Number.MAX_SAFE_INTEGER) return false;
    if (getAdvancementChoices(actor).length) { warn("ResolvePending"); return false; }
    const plan = { updates: {}, items: [] };
    if (!await completeTierPlan(actor, plan, options)) { warn("NoChoices"); return false; }
    if (!ownedPC(actor)) return false;
    if (plan.items.length) {
      await actor.update({ "flags.cypher.advancementPending": { version: 1, kind: "tier", tier } });
      await actor.createEmbeddedDocuments("Item", plan.items);
    }
    await actor.update({ ...plan.updates, "flags.cypher.advancementPending": null });
    await synchronizeFollowers(actor, context);
    await announceTier(actor, tier + 1);
    return true;
  })) ?? false;
}

async function announceTier(actor, tier) {
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p>${game.i18n.format("CYPHER.Advancement.TierReached", { tier })}</p>` });
}

/** Settle an explicitly saved legacy choice before allowing further progression. */
export async function selectAdvancementAbility(actor, choiceId, options = {}) {
  if (!ownedPC(actor)) return false;
  return (await runActorAction(actor, "advancement", async context => {
    if (flag(actor, "advancementPending")) { warn("Interrupted"); return false; }
    const choices = getAdvancementChoices(actor);
    const choice = choices.find(choice => choice.id === choiceId);
    if (!choice || !["focus", "genre"].includes(choice.kind) || choice.tier > actor.system.tier) return false;
    const plan = await prepareAdvancementGrant(actor, choice.kind, options, actor.system.tier);
    if (!plan) { warn("Invalid"); return false; }
    if (!ownedPC(actor)) return false;
    await actor.update({ "flags.cypher.advancementPending": { version: 1, kind: "free", choiceId } });
    await actor.createEmbeddedDocuments("Item", plan.items);
    await actor.update({ ...plan.updates,
      "flags.cypher.focusAbilityPendingTier": null,
      "flags.cypher.advancementPending": null });
    return true;
  })) ?? false;
}

/** Existing Focus API now spends an actual pending entitlement instead of granting unlimited picks. */
export async function selectFocusAbility(actor, abilityId, weaponSkillCategory = null) {
  const choice = getAdvancementChoices(actor).find(choice => choice.kind === "focus");
  return choice ? selectAdvancementAbility(actor, choice.id, { abilityId, weaponSkillCategory }) : false;
}

/** GM acknowledgement only clears the interruption after explicit manual state reconciliation. */
export async function clearAdvancementInterruption(actor, { reconciled = false } = {}) {
  if (!ownedPC(actor) || !game.user?.isGM || !reconciled) return false;
  return Boolean(await runActorAction(actor, "advancement", async context => {
    if (!flag(actor, "advancementPending")) return false;
    await actor.update({ "flags.cypher.advancementPending": null });
    return true;
  }));
}
