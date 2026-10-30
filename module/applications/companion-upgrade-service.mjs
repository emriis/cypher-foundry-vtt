/** CRD Builds Allies / Controls Beasts: installed capabilities and resumable paid activations. */
import { COMPANION_UPGRADES, companionEffectActive } from "../rules/companion-upgrades.mjs";
import { resolveActiveAbilityModifiers } from "../rules/ability-modifiers.mjs";
import { runActorActions } from "./action-guard.mjs";
import { followerDisplay } from "./follower-service.mjs";
import { companionContext, ownsCompanionAbility } from "./companion-power-service.mjs";
import { companionEffects, companionInstallations } from "./companion-upgrade-read.mjs";
import { resolveDocumentReference } from "./reference-resolver.mjs";
import { consumeRoundAction, roundActionContext } from "./round-action-service.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { resolveGeneralModifiers } from "../rules/general-effects.mjs";
const items = actor => actor.items?.contents ?? Array.from(actor.items?.values?.() ?? []);
const owned = actor => actor?.type === "pc" && actor.isOwner !== false;
const authority = () => game.user?.isGM && game.users?.activeGM?.id === game.user.id;
const time = () => game.time.worldTime;
const physical = key => ["armor", "turret"].includes(COMPANION_UPGRADES[key]?.kind);

/** Bind one retained Ability copy to one synchronized automaton slot. Installation itself is free. */
export async function installCompanionUpgrade(actor, itemId, followerId, { confirmed = false } = {}) {
  if (!owned(actor) || !authority() || !confirmed) return false;
  return Boolean(await runActorActions([actor], "companionInstall", async () => {
    const item = actor.items.get(itemId), rule = COMPANION_UPGRADES[item?.system?.key];
    if (item?.type !== "ability" || !rule || rule.kind === "senses"
      || companionInstallations(actor).some(binding => binding.key === item.system.key)) return false;
    const follower = (await followerDisplay(actor)).find(entry => entry.id === followerId && !entry.pending && entry.sourceAbility?.family === "automaton");
    if (!follower || !ownsCompanionAbility(actor, follower.sourceAbility.key)) return false;
    const id = foundry.utils.randomID();
    await actor.update({ [`flags.cypher.companionUpgrades.${id}`]: { version: 1, id, key: item.system.key, itemId, followerId } });
    return true;
  }));
}

/** Read model for sheets; the retained Ability name is presentation only. */
export function companionUpgradeDisplay(actor) {
  return { offers: items(actor).filter(item => item.type === "ability" && COMPANION_UPGRADES[item.system.key]).map(item => ({ id: item.id, name: item.name, senses: item.system.key === "beast-eyes" })),
  installations: companionInstallations(actor).map(binding => ({ ...binding, name: actor.items.get(binding.itemId)?.name ?? binding.key,
    flight: COMPANION_UPGRADES[binding.key]?.kind === "flight" })),
  effects: companionEffects(actor).filter(effect => ["active", "pending", "ending"].includes(effect.state)).map(effect => ({ ...effect,
    name: actor.items.get(effect.sourceItemId)?.name ?? effect.key, pending: effect.state === "pending",
    senses: effect.key === "beast-eyes", field: effect.key === "automaton-force-field-upgrade", turret: effect.key === "automaton-turret-upgrade" })) };
}

/**
 * Activate only after explicit fiction/range declarations. The elected GM owns
 * cross-document settlement; paid pending records can be resumed after reload.
 * Armor/turret use the NPC's action, Beast Eyes the PC's; Enablers add no action.
 */
export async function activateCompanionUpgrade(actor, bindingId, options = {}) {
  if (!owned(actor) || !authority() || options.confirmed !== true) return false;
  return Boolean(await runActorActions([actor], "companionActivation", async context => {
    if (companionEffects(actor).some(effect => ["pending", "ending"].includes(effect.state))) return false;
    const binding = companionInstallations(actor).find(entry => entry.id === bindingId);
    const source = binding ? actor.items.get(binding.itemId) : actor.items.get(bindingId);
    const key = source?.system?.key, rule = COMPANION_UPGRADES[key];
    if (source?.type !== "ability" || !rule || rule.kind === "flight" || binding && binding.key !== key) return false;
    let npc, followerId, sensoryContext;
    if (rule.kind === "senses") {
      const companion = await companionContext(actor);
      if (!companion?.alive || options.withinRange !== true) return false;
      npc = companion.npc; followerId = companion.followerId;
      sensoryContext = companion.id;
    } else {
      if (!binding) return false;
      const follower = (await followerDisplay(actor)).find(entry => entry.id === binding.followerId && !entry.pending && entry.available && entry.sourceAbility?.family === "automaton");
      if (!follower || !ownsCompanionAbility(actor, follower.sourceAbility.key)) return false;
      npc = await resolveDocumentReference(follower.npcUuid, "npc"); followerId = follower.id;
    }
    if (!npc || npc.isOwner === false || !(npc.system.health?.value > 0) || npc.statuses?.has("dead")) return false;
    if (!Array.isArray(options.targetUuids ?? []) || (options.targetUuids ?? []).some(uuid => typeof uuid !== "string")) return false;
    const targets = rule.kind === "field" ? [...new Set([npc.uuid, ...(options.targetUuids ?? [])])] : [];
    if (rule.kind === "field" && options.immediate !== true) return false;
    const recipients = [];
    for (const uuid of targets) {
      const target = await resolveDocumentReference(uuid);
      if (!["pc", "npc"].includes(target?.type) || target.isOwner === false) return false;
      recipients.push(target);
    }
    const operator = rule.kind === "turret" ? await resolveDocumentReference(options.operatorUuid ?? actor.uuid, "pc") : null;
    if (rule.kind === "turret" && (!operator || operator.isOwner === false)) return false;
    let token = null;
    if (rule.kind === "senses" && options.visionTokenUuid) {
      token = await resolveDocumentReference(options.visionTokenUuid);
      if (token?.actor !== npc) return false;
    }
    const previous = companionEffects(actor).filter(effect => companionEffectActive(effect, actor.flags?.cypher, time())
      && (effect.key === key || physical(key) && physical(effect.key) && effect.followerId === followerId));
    // A live effect must first be explicitly ended; do not spend again on a double click.
    if (previous.some(effect => effect.key === key)) return false;
    const stat = actor.system.stats?.intellect;
    const modifiers = resolveActiveAbilityModifiers(actor.system.activeAbilityEffects, items(actor), actor.system);
    const cost = Math.max(0, rule.cost - (stat?.edge ?? 0) - (modifiers.edge.intellect ?? 0));
    if (!Number.isFinite(cost) || (stat?.pool?.value ?? 0) < cost || !Number.isFinite(time())) return false;
    const acting = rule.action === "pc" ? actor : rule.action === "npc" ? npc : null;
    if (resolveGeneralModifiers(getGeneralEffects(actor)).rejected || ["unconscious", "dead", "paralyzed", "stunned"].some(status => actor.statuses?.has(status))
      || acting && (resolveGeneralModifiers(getGeneralEffects(acting)).rejected
        || ["unconscious", "dead", "paralyzed", "stunned"].some(status => acting.statuses?.has(status)))) return false;
    const round = acting ? roundActionContext(acting) : null;
    if (round && !round.kind) return false;
    return Boolean(await runActorActions([actor, npc, operator, ...recipients], "companionCommit", async () => {
      if (!owned(actor) || !authority() || [npc, ...recipients, ...(operator ? [operator] : [])].some(document => document.isOwner === false)
        || actor.items.get(source.id) !== source) return false;
      const id = foundry.utils.randomID();
      const effect = { version: 1, id, key, bindingId: binding?.id ?? null, sourceItemId: source.id, followerId: followerId ?? null,
        npcUuid: npc.uuid, state: "pending", startedAt: time(), cost,
        ...(rule.durationSeconds ? { endsAt: time() + rule.durationSeconds } : {}),
        ...(rule.recovery ? { recoveryRevision: actor.flags?.cypher?.companionRecoveries?.[rule.recovery] ?? 0 } : {}),
        targets, ...(rule.kind === "field" ? { fieldLevel: 5 } : {}), operators: operator ? [operator.uuid] : [], immediate: options.immediate === true,
        withinRange: options.withinRange === true, visionTokenUuid: token?.uuid ?? null,
        sensoryContext: sensoryContext ?? null,
        previous: previous.map(entry => entry.id) };
      await actor.update({ [`flags.cypher.companionEffects.${id}`]: effect,
        ...(cost ? { "system.stats.intellect.pool.value": stat.pool.value - cost } : {}) });
      return finishActivation(actor, effect, npc, recipients, operator, round, context);
    }, context));
  }));
}

/** Resume the paid saga without recharging or repeating an acknowledged NPC/PC action. */
export async function resumeCompanionUpgrade(actor, id) {
  if (!owned(actor) || !authority()) return false;
  return Boolean(await runActorActions([actor], "companionResume", async context => {
    const effect = companionEffects(actor).find(entry => entry.id === id && entry.state === "pending");
    if (!effect) return false;
    const npc = await resolveDocumentReference(effect.npcUuid, "npc");
    const recipients = [];
    for (const uuid of effect.targets) recipients.push(await resolveDocumentReference(uuid));
    const operator = effect.operators.length ? await resolveDocumentReference(effect.operators[0], "pc") : null;
    if (!npc || [npc, ...recipients, ...(effect.operators.length ? [operator] : [])].some(doc => !doc || doc.isOwner === false)) return false;
    const rule = COMPANION_UPGRADES[effect.key], acting = rule.action === "pc" ? actor : rule.action === "npc" ? npc : null;
    return Boolean(await runActorActions([actor, npc, operator, ...recipients], "companionResumeCommit",
      () => finishActivation(actor, effect, npc, recipients, operator, acting ? roundActionContext(acting) : null, context), context));
  }));
}

/** Each side effect has a durable identity, so a lost response never creates fresh equipment or pays twice. */
async function finishActivation(actor, effect, npc, recipients, operator, round, context) {
  const rule = COMPANION_UPGRADES[effect.key];
  if (!companionEffectActive({ ...effect, state: "active" }, actor.flags?.cypher, time())) {
    await actor.update({ [`flags.cypher.companionEffects.${effect.id}.state`]: "ending" });
    await endEffect(actor, effect.id); return false;
  }
  const acting = rule.action === "pc" ? actor : rule.action === "npc" ? npc : null;
  if (acting && !acting.flags?.cypher?.companionActions?.[effect.id]) {
    if (!await consumeRoundAction(round, context, { receiptId: effect.id })) return false;
    if (!round) await acting.update({ [`flags.cypher.companionActions.${effect.id}`]: true });
  }
  for (const previous of effect.previous) if (!await endEffect(actor, previous)) return false;
  let equipment;
  if (["armor", "turret"].includes(rule.kind)) {
    const holder = rule.kind === "armor" ? actor : operator;
    const existing = items(holder).filter(item => item.flags?.cypher?.companionEquipment?.ownerUuid === actor.uuid
      && item.flags.cypher.companionEquipment.followerId === effect.followerId && item.flags.cypher.companionEquipment.kind === rule.kind);
    if (existing.length > 1) return false;
    equipment = existing[0];
    if (!equipment) {
      const known = companionEffects(actor).some(entry => entry.followerId === effect.followerId && entry.itemId && COMPANION_UPGRADES[entry.key]?.kind === rule.kind
        && (rule.kind === "armor" || entry.operators?.includes(holder.uuid)));
      if (known) return false; // Deleted proxy requires explicit GM reconciliation, never free repair.
      [equipment] = await holder.createEmbeddedDocuments("Item", [{ name: actor.items.get(effect.sourceItemId)?.name ?? effect.key,
        type: rule.kind === "armor" ? "armor" : "attack", system: rule.kind === "armor"
          ? { category: rule.category, freelyUsable: true, equipped: false }
          : { attackType: "heavy", range: "veryLong", damage: 7, stat: "speed", freelyUsable: false, equipped: false },
        flags: { cypher: { companionEquipment: { kind: rule.kind, ownerUuid: actor.uuid, followerId: effect.followerId, effectId: effect.id } } } }]);
    }
    await equipment.update({ ...(rule.kind === "armor" ? { "system.category": rule.category, "system.freelyUsable": true }
      : { "system.attackType": "heavy", "system.range": "veryLong", "system.damage": 7, "system.stat": "speed", "system.freelyUsable": false }),
      "flags.cypher.companionEquipment.effectId": effect.id });
    await actor.update({ [`flags.cypher.companionEffects.${effect.id}.itemId`]: equipment.id });
    if (rule.kind === "armor" && effect.immediate) {
      for (const other of items(actor)) if (other.type === "armor" && other.id !== equipment.id && other.system.equipped) await other.update({ "system.equipped": false });
    }
  }
  for (const target of recipients) await target.update({ [`flags.cypher.companionFields.${effect.id}`]: { ownerUuid: actor.uuid } });
  if (equipment && rule.kind === "armor" && effect.immediate) await equipment.update({ "system.equipped": true }, { cypherCompanionActivation: effect.id });
  await actor.update({ [`flags.cypher.companionEffects.${effect.id}.state`]: "active" });
  return true;
}

/** Explicit ending and expiry never restore an old equipment snapshot or refund a paid activation. */
export async function endCompanionUpgrade(actor, id) {
  if (!owned(actor) || !authority()) return false;
  return Boolean(await runActorActions([actor], "companionEnd", async context => {
    const effect = companionEffects(actor).find(entry => entry.id === id);
    if (effect?.key !== "automaton-turret-upgrade" || effect.state !== "active") return endEffect(actor, id);
    const npc = await resolveDocumentReference(effect.npcUuid, "npc");
    if (!npc || npc.isOwner === false) return false;
    return Boolean(await runActorActions([actor, npc], "turretReconfigure", async () => {
      const receiptId = `end${id}`;
      if (!npc.flags?.cypher?.companionActions?.[receiptId]) {
        if (resolveGeneralModifiers(getGeneralEffects(npc)).rejected || ["unconscious", "dead", "stunned", "paralyzed"].some(status => npc.statuses?.has(status))) return false;
        const round = roundActionContext(npc);
        if (!await consumeRoundAction(round, context, { receiptId })) return false;
        if (!round) await npc.update({ [`flags.cypher.companionActions.${receiptId}`]: true });
      }
      return endEffect(actor, id);
    }, context));
  }));
}
async function endEffect(actor, id) {
  const effect = companionEffects(actor).find(entry => entry.id === id);
  if (!effect || effect.state === "pending") return false;
  await actor.update({ [`flags.cypher.companionEffects.${id}.state`]: "ending" });
  const item = effect.itemId && actor.items.get(effect.itemId);
  if (item?.type === "armor" && item.system.equipped) await item.update({ "system.equipped": false });
  await actor.update({ [`flags.cypher.companionEffects.${id}.state`]: "ended" }); return true;
}

/** Recovery invalidates effects atomically; this best-effort cleanup only unequips retained armor. */
export async function cleanupCompanionUpgrades(actor) {
  if (!owned(actor) || !authority()) return;
  for (const effect of companionEffects(actor)) if (effect.state === "ending" || effect.state === "active" && !companionEffectActive(effect, actor.flags?.cypher, time())) await endEffect(actor, effect.id);
}

/** Update declared carrying or senses range without charging for a new activation. */
export async function configureCompanionUpgrade(actor, { followerId, carrying, effectId, withinRange, targetUuids, immediate = false } = {}) {
  if (!owned(actor)) return false;
  return Boolean(await runActorActions([actor], "companionCircumstances", async context => {
    if (followerId && typeof carrying === "boolean" && companionInstallations(actor).some(binding => binding.followerId === followerId && binding.key === "automaton-flight-upgrade")) {
      await actor.update({ [`flags.cypher.companionCarrying.${followerId}`]: carrying }); return true;
    }
    const effect = companionEffects(actor).find(entry => entry.id === effectId && entry.state === "active");
    if (effect?.key === "automaton-force-field-upgrade" && authority() && immediate === true && Array.isArray(targetUuids)) {
      const targets = [...new Set([effect.npcUuid, ...targetUuids])], recipients = [];
      for (const uuid of targets) {
        const target = await resolveDocumentReference(uuid);
        if (!["pc", "npc"].includes(target?.type) || target.isOwner === false) return false;
        recipients.push(target);
      }
      return Boolean(await runActorActions([actor, ...recipients], "companionFieldTargets", async () => {
        for (const target of recipients) await target.update({ [`flags.cypher.companionFields.${effect.id}`]: { ownerUuid: actor.uuid } });
        await actor.update({ [`flags.cypher.companionEffects.${effect.id}.targets`]: targets }); return true;
      }, context));
    }
    if (effect?.key !== "beast-eyes") return false;
    if (!effect || typeof withinRange !== "boolean") return false;
    await actor.update({ [`flags.cypher.companionEffects.${effectId}.withinRange`]: withinRange }); return true;
  }));
}
