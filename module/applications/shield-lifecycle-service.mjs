/** Source-bound shield designation, completed work, recovery and lost turns. */
import { SHIELD_ABILITY_KEYS, shieldAbilityKind, shieldOwnerItems } from "../rules/shield-abilities.mjs";
import { isShieldBroken } from "../rules/wounds.mjs";
import { runActorAction } from "./action-guard.mjs";

/** Identify supported owned Abilities by their stable source key. */
export function getShieldAbilityKind(item) {
  return item?.type === "ability" && SHIELD_ABILITY_KEYS.includes(item.system.key) ? item.system.key : null;
}

function owns(actor, item) {
  return actor?.type === "pc" && actor.isOwner !== false && item?.isOwner !== false
    && actor.items?.get(item?.id) === item;
}

/** Find the physical shield explicitly designated for this Ability, if any. */
export function getDesignatedShield(item) {
  if (!item) return null;
  return shieldOwnerItems({ actor: item?.actor }).find(shield => shield.type === "shield"
    && shield.system.abilityItemId === item.id) ?? null;
}

/**
 * Designate one actual shield or create the shield granted by the source.
 * Repeated calls never duplicate it; no other inventory shield gains the benefit.
 * @returns {Promise<Item|null>} Bound shield, or null for invalid/busy ownership.
 */
export async function designateShield(ability, shieldId = null) {
  const actor = ability?.actor, kind = getShieldAbilityKind(ability);
  if (!owns(actor, ability) || !["unyielding-shield", "hidden-shield"].includes(kind)) return null;
  return runActorAction(actor, "shieldDesignation", async () => {
    const existing = getDesignatedShield(ability);
    if (existing) return existing;
    if (shieldId) {
      const shield = actor.items.get(shieldId);
      if (!owns(actor, shield) || shield.type !== "shield" || shield.system.abilityItemId
        || isShieldBroken(shield.system.wounds)) return null;
      await shield.update({ "system.abilityItemId": ability.id });
      return shield;
    }
    const [shield] = await actor.createEmbeddedDocuments("Item", [{ type: "shield", name: ability.name,
      system: { abilityItemId: ability.id, equipped: false, inHand: true } }]);
    return shield;
  });
}

/**
 * Begin source-defined work only after resources/arrangements were confirmed.
 * Hidden Shield takes about a day; Unyielding replacement takes a rolled 1d6 days.
 * Resource quantity and crafting qualification are GM adjudication, not invented
 * currency deductions. Game-time seconds track the earliest completion.
 * @returns {Promise<boolean>} False before writes for an invalid project.
 */
export async function startShieldWork(shield, { resourcesConfirmed = false } = {}) {
  const actor = shield?.actor;
  if (!owns(actor, shield) || shield.type !== "shield" || !resourcesConfirmed) return false;
  return Boolean(await runActorAction(actor, "shieldWork", async () => {
    const kind = shieldAbilityKind(shield, shieldOwnerItems(shield));
    const repair = kind === "hidden-shield" && isShieldBroken(shield.system.wounds);
    const replace = kind === "unyielding-shield" && shield.system.inHand === false;
    if ((!repair && !replace) || shield.system.repairReadyAt != null || shield.system.replacementReadyAt != null) return false;
    const roll = replace ? await new Roll("1d6").evaluate() : null;
    const days = roll?.total ?? 1;
    const now = game.time.worldTime;
    if (!Number.isFinite(now) || !Number.isSafeInteger(days) || days < 1 || days > 6) return false;
    await shield.update({ [repair ? "system.repairReadyAt" : "system.replacementReadyAt"]: now + days * 86400 });
    const message = { speaker: ChatMessage.getSpeaker({ actor }),
      flavor: game.i18n.format("CYPHER.ShieldAbility.WorkStarted", { days }) };
    if (roll) await roll.toMessage(message);
    else await ChatMessage.create({ ...message, content: `<p>${message.flavor}</p>` });
    return true;
  }));
}

/**
 * Finish confirmed work after its game-time deadline. A replacement renews this
 * inventory record; its old flight identity is invalidated. Work never equips
 * the shield automatically. Repeated completion has no effect.
 */
export async function finishShieldWork(shield, { workCompleted = false } = {}) {
  const actor = shield?.actor;
  if (!owns(actor, shield) || shield.type !== "shield" || !workCompleted) return false;
  return Boolean(await runActorAction(actor, "shieldWork", async () => {
    const kind = shieldAbilityKind(shield, shieldOwnerItems(shield));
    const ready = kind === "hidden-shield" ? shield.system.repairReadyAt
      : kind === "unyielding-shield" ? shield.system.replacementReadyAt : null;
    if (ready == null || !Number.isFinite(game.time.worldTime) || game.time.worldTime < ready) return false;
    await shield.update({ "system.wounds.minor.current": 0, "system.wounds.moderate.current": 0,
      "system.wounds.major.current": 0, "system.repairReadyAt": null, "system.replacementReadyAt": null,
      "system.flightId": "", "system.inHand": true, "system.equipped": false });
    return true;
  }));
}

/** An explicit retrieval declaration restores possession, never repairs damage. */
export async function retrieveShield(shield) {
  if (!owns(shield?.actor, shield) || shield.type !== "shield") return false;
  return Boolean(await runActorAction(shield.actor, "shieldRetrieval", async () => {
    if (shield.system.inHand !== false) return false;
    await shield.update({ "system.inHand": true, "system.flightId": "" });
    return true;
  }));
}

/** A completed recovery clears only the designated Unyielding shield's minor/moderate wounds. */
export async function recoverUnyieldingShields(actor) {
  for (const shield of shieldOwnerItems({ actor })) {
    if (shield.type !== "shield" || shield.isOwner === false
      || shieldAbilityKind(shield, shieldOwnerItems(shield)) !== "unyielding-shield") continue;
    if (shield.system.wounds.minor.current || shield.system.wounds.moderate.current) {
      await shield.update({ "system.wounds.minor.current": 0, "system.wounds.moderate.current": 0 });
    }
  }
}

/**
 * Resolve a pending lost turn explicitly in narrative play, or replace it with
 * the CRD GM-intrusion alternative. Only a GM can choose the intrusion; this
 * acknowledges that adjudication and does not invent an intrusion's content/XP.
 */
export async function resolveShieldTurnLoss(actor, { gmIntrusion = false } = {}) {
  if (actor?.isOwner === false || (gmIntrusion && !game.user?.isGM)) return false;
  return Boolean(await runActorAction(actor, "shieldTurnLoss", async () => {
    if (!actor.flags?.cypher?.shieldTurnLossPending) return false;
    await actor.update({ "flags.cypher.shieldTurnLossPending": false });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${game.i18n.localize(gmIntrusion ? "CYPHER.ShieldAbility.IntrusionChosen" : "CYPHER.ShieldAbility.TurnLost")}</p>` });
    return true;
  }));
}

/**
 * updateCombat hook on the active GM only. Forward turn changes consume the
 * pending loss and advance normally, preserving synthetic combatant Actors.
 * No automatic rewinds or rolls happen on reload or round-only edits.
 */
export async function skipUnyieldingShieldTurn(combat, changes, options) {
  if (game.users?.activeGM?.id !== game.user?.id || !game.user?.isGM
    || options?.cypherInitiativeReorder || options?.cypherRoundFlow || !Object.hasOwn(changes, "turn") || !combat.started
    || (options?.direction ?? 1) < 0) return;
  const previous = combat.previous;
  if (previous?.round != null && (combat.round < previous.round
    || (combat.round === previous.round && Number.isInteger(previous.turn) && combat.turn <= previous.turn))) return;
  const actor = combat.combatant?.actor;
  if (!actor?.flags?.cypher?.shieldTurnLossPending) return;
  if (await resolveShieldTurnLoss(actor)) await combat.nextTurn();
}
