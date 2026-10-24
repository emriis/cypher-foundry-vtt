/** Actual held objects, source-required weapon setup and readonly crew validation. */
import { minimumWeaponHands, handsFit } from "../rules/equipment-hands.mjs";
import { isShieldBroken } from "../rules/wounds.mjs";
import { shieldSurvivesMajor, shieldOwnerItems } from "../rules/shield-abilities.mjs";
import { getGeneralEffects } from "./general-effect-service.mjs";
import { runActorAction } from "./action-guard.mjs";
import { resolveCachedDocumentReference } from "./reference-resolver.mjs";

const flagPath = "flags.cypher.equipmentUse";
/** Inventory reads preserve actual embedded Item identities, including synthetic owners. */
export const equipmentItems = actor => actor?.items?.contents ?? (Array.isArray(actor?.items) ? actor.items : Array.from(actor?.items?.values?.() ?? []));

/** Saved capacity is a GM declaration, not inferred from species, names or anatomy descriptions. */
export function handCapacity(actor) { return actor?.flags?.cypher?.handCapacity ?? 2; }

/** Expose source requirements to UI without moving rule calculations into sheets. */
export function minimumEquipmentHands(item) { return item?.type === "shield" ? 1 : item?.type === "attack" ? minimumWeaponHands(item.system) : 0; }

/** Existing readied shields retain their declared use; legacy attacks/gear remain unknown. */
export function equipmentGrip(item) {
  const saved = item?.flags?.cypher?.equipmentUse;
  const grip = saved?.version === 1 ? saved : item?.type === "shield"
    ? { version: 1, held: Boolean(item.system.equipped), hands: 1, deployed: false, operators: [] } : null;
  if (!grip) return null;
  if (item.type === "shield" && (!item.system.equipped || item.system.inHand === false
    || isShieldBroken(item.system.wounds, shieldSurvivesMajor(item, shieldOwnerItems(item))))) return { ...grip, held: false };
  return grip;
}

/** Test a proposed grip without moving any other object. Broken/thrown shields free their allocation. */
export function canAllocateHands(actor, itemId, hands) {
  return handsFit(handCapacity(actor), [...equipmentItems(actor).filter(item => item.id !== itemId)
    .map(item => { const grip = equipmentGrip(item); return grip?.held ? grip.hands : 0; }), hands]);
}

function crewActor(uuid, actor) {
  if (uuid === actor.uuid) return actor;
  return resolveCachedDocumentReference(uuid);
}

function crewAvailable(actor, operators, required) {
  if (!Number.isSafeInteger(required) || required < 0 || !Array.isArray(operators)) return false;
  const uuids = [actor.uuid, ...operators];
  if (new Set(uuids).size !== uuids.length || uuids.some(uuid => typeof uuid !== "string" || !uuid)) return false;
  return uuids.filter(uuid => {
    const participant = crewActor(uuid, actor);
    return !uuid.startsWith("Compendium.") && participant?.uuid === uuid && ["pc", "npc"].includes(participant?.type)
      && participant.system?.dead !== true
      && !getGeneralEffects(participant).some(effect => ["unconscious", "stunned", "paralyzed"].includes(effect.kind));
  }).length >= required;
}

/**
 * Return a localization suffix for unmet prerequisites, or null when ready.
 * Flight exemptions require an actual owned shield Ability and its current flight identity.
 */
export function equipmentAttackProblem(item, { abilitySource = null, equipmentFlightId = null } = {}) {
  const actor = item?.actor;
  if (!actor || actor.isOwner === false || item.isOwner === false) return "invalid";
  const actual = actor?.items?.get?.(item?.id) ?? item;
  const ability = abilitySource ? actor?.items?.get?.(abilitySource.itemId) : null;
  const flight = actual.type === "shield" && equipmentFlightId && equipmentFlightId === actual.system.flightId
    && actual.system.inHand === false && ability?.type === "ability"
    && ["throw-shield", "bouncing-shield", "unyielding-shield"].includes(ability.system.key)
    && abilitySource.shieldItemId === actual.id;
  if (flight) return null;
  const grip = equipmentGrip(actual);
  if (!grip?.held) return "needGrip";
  if (actual.type === "attack" && grip.hands === 0 && grip.handsFreeApproved !== true) return "invalid";
  const minimum = actual.type === "shield" ? 1 : minimumWeaponHands(item.system);
  if (!Number.isSafeInteger(grip.hands) || grip.hands < minimum) return "needTwoHands";
  if (!canAllocateHands(actor, actual.id, grip.hands)) return "handsFull";
  if (item.system.mechanics?.requiresTripod && !grip.deployed) return "needTripod";
  const required = item.system.mechanics?.requiredOperators ?? 0;
  if (required > 1 && !crewAvailable(actor, grip.operators ?? [], required)) return "needCrew";
  return null;
}

/** Check space for a successful catch before any cost or dice, preserving the shield's declared grip. */
export function canReadyShield(shield) {
  const hands = shield?.flags?.cypher?.equipmentUse?.hands ?? 1;
  return shield?.type === "shield" && Number.isSafeInteger(hands) && hands >= 1 && canAllocateHands(shield.actor, shield.id, hands);
}

/** One successful-catch write restores physical readiness and an existing declared grip together. */
export function shieldReadyUpdate(shield) {
  const saved = shield?.flags?.cypher?.equipmentUse;
  return { "system.inHand": true, "system.equipped": true,
    ...(saved?.version === 1 ? { "flags.cypher.equipmentUse": { ...saved, held: true } } : {}) };
}

/**
 * Persist one explicit held/stowed/setup declaration in a single Item update.
 * Cancellation is handled by the UI; rejected declarations never write or unequip others.
 * Operator assignment is a fictional participation declaration, not a bonus or an action spend.
 */
export async function configureEquipmentUse(item, { held, hands, deployed = false, operators = [] } = {}, context = null) {
  const actor = item?.actor;
  if (actor?.type !== "pc" || actor.isOwner === false || item.isOwner === false || actor.items?.get(item.id) !== item
    || !["attack", "shield", "equipment"].includes(item.type)
    || typeof held !== "boolean" || typeof deployed !== "boolean" || !Number.isSafeInteger(hands) || hands < 0
    || !Array.isArray(operators) || operators.some(uuid => typeof uuid !== "string" || !uuid)
    || new Set(operators).size !== operators.length || operators.includes(actor.uuid)) return false;
  return Boolean(await runActorAction(actor, "equipmentGrip", async () => {
    const handsFreeApproved = item.type === "attack" && held && game.user?.isGM === true
      ? hands === 0 : item.flags?.cypher?.equipmentUse?.handsFreeApproved === true;
    if (item.type === "attack" && held && hands === 0 && !handsFreeApproved) return false;
    if (held && (hands < (item.type === "shield" ? 1 : item.type === "attack" ? minimumWeaponHands(item.system) : 0)
      || !canAllocateHands(actor, item.id, hands))) return false;
    if (held && item.type === "shield" && (item.system.inHand === false
      || isShieldBroken(item.system.wounds, shieldSurvivesMajor(item, shieldOwnerItems(item))))) return false;
    if (held && operators.length && !crewAvailable(actor, operators, operators.length + 1)) return false;
    await item.update({ [flagPath]: { version: 1, held, hands, deployed, operators: [...operators], handsFreeApproved },
      ...(item.type === "shield" ? { "system.equipped": held } : {}) });
    return true;
  }, context));
}

/** GM-only anatomy adjustment; lowering capacity cannot silently discard held objects. */
export async function setHandCapacity(actor, capacity) {
  if (!game.user?.isGM || actor?.type !== "pc" || actor.isOwner === false) return false;
  return Boolean(await runActorAction(actor, "handCapacity", async () => {
    if (!handsFit(capacity, equipmentItems(actor).map(item => { const grip = equipmentGrip(item); return grip?.held ? grip.hands : 0; }))) return false;
    await actor.update({ "flags.cypher.handCapacity": capacity });
    return true;
  }));
}
