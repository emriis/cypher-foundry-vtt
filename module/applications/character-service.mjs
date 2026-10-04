import { CYPHER } from "../config.mjs";

/**
 * Spend XP at the application boundary.
 *
 * Keeping this operation outside the Actor document makes XP spending reusable
 * by task rolls, rerolls, intrusions, and future application use cases.
 *
 * @param {Actor} actor Character spending XP.
 * @param {number} amount Number of XP to spend.
 * @param {string} [reasonLabel=""] Localized reason shown in the warning.
 * @returns {Promise<boolean>} True when the XP was successfully spent.
 */
export async function spendXP(actor, amount, reasonLabel = "") {
  if (actor.type !== "pc") return false;

  const currentXP = actor.system.xp ?? 0;
  if (currentXP < amount) {
    ui.notifications.error(
      game.i18n.format("CYPHER.Warning.NotEnoughXP", {
        amount,
        reason: reasonLabel
      })
    );
    return false;
  }

  await actor.update({ "system.xp": currentXP - amount });
  return true;
}

/**
 * Reroll a previous Cypher roll by spending XP and keeping the better result.
 *
 * Depletion rolls use their own die and threshold, while normal task rolls
 * compare the rerolled d20 with the original target number.
 *
 * @param {Actor} actor Character rerolling.
 * @param {object} message Foundry chat message containing the reroll flags.
 * @returns {Promise<void>|undefined} Nothing when the message is not rerollable.
 */
export async function rerollMessage(actor, message) {
  const flags = message.getFlag("cypher", "rerollable")
    ? message.flags["cypher"]
    : null;
  if (!flags) return;

  if (flags.rollType === "depletion") {
    return rerollDepletion(actor, message, flags);
  }

  if (!(await spendXP(
    actor,
    CYPHER.xpCosts.reroll,
    game.i18n.localize("CYPHER.XP.Reroll")
  ))) return;

  const newRoll = await new Roll("1d20").evaluate();
  const oldD20 = flags.d20;
  const finalD20 = Math.max(oldD20, newRoll.total);
  const success = flags.effectiveDifficulty <= 0
    ? true
    : finalD20 >= flags.targetNumber;

  let damageBonus = 0;
  let effectText = "";

  if (flags.isAttack && success) {
    if (finalD20 === 17) damageBonus = 1;
    else if (finalD20 === 18) damageBonus = 2;
    else if (finalD20 === 19) damageBonus = 3;
    else if (finalD20 === 20) damageBonus = 4;
  } else if (success && finalD20 === 19) {
    effectText = game.i18n.localize("CYPHER.Roll.MinorEffect");
  } else if (success && finalD20 === 20) {
    effectText = game.i18n.localize("CYPHER.Roll.MajorEffect");
  }

  const totalDamage = flags.isAttack
    ? flags.baseDamage + damageBonus
    : 0;

  const content = `
    <div class="cypher-roll-card cypher-reroll-card">
      <h3>${game.i18n.localize("CYPHER.XP.RerollResult")}</h3>
      <p>${game.i18n.format("CYPHER.XP.RerollCompare", {
        old: oldD20,
        new: newRoll.total,
        final: finalD20
      })}</p>
      <p class="cypher-result ${success ? "success" : "failure"}">
        ${success
          ? game.i18n.localize("CYPHER.Roll.Success")
          : game.i18n.localize("CYPHER.Roll.Failure")}
        ${flags.isAttack && damageBonus
          ? ` — +${damageBonus} ${game.i18n.localize("CYPHER.Damage")}
             (${totalDamage} ${game.i18n.localize("CYPHER.Roll.TotalDamage")})`
          : ""}
        ${effectText ? ` — ${effectText}` : ""}
      </p>
    </div>`;

  await newRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: content,
    flags: { cypher: { rerollable: false } }
  });
}

/**
 * Reroll an artifact or equipment depletion check.
 *
 * @param {Actor} actor Character rerolling.
 * @param {object} message Foundry chat message.
 * @param {object} flags Reroll metadata stored on the message.
 * @returns {Promise<void>} Completes after the reroll message is posted.
 */
async function rerollDepletion(actor, message, flags) {
  const item = actor.items.get(flags.itemId);
  if (!item) return;

  if (!(await spendXP(
    actor,
    CYPHER.xpCosts.reroll,
    game.i18n.localize("CYPHER.XP.Reroll")
  ))) return;

  const newRoll = await new Roll(`1d${flags.dieMax}`).evaluate();
  const finalValue = Math.max(flags.originalRoll, newRoll.total);
  const depletes = finalValue <= flags.threshold;

  if (depletes && !item.system.depleted) {
    await item.update({ "system.depleted": true });
  }

  const content = `
    <div class="cypher-roll-card cypher-reroll-card">
      <h3>${game.i18n.localize("CYPHER.XP.RerollResult")}</h3>
      <p>${game.i18n.format("CYPHER.XP.RerollCompare", {
        old: flags.originalRoll,
        new: newRoll.total,
        final: finalValue
      })}</p>
      <p class="cypher-result ${depletes ? "failure" : "success"}">
        ${depletes
          ? game.i18n.localize("CYPHER.Depletion.LastUse")
          : game.i18n.localize("CYPHER.Depletion.StillWorks")}
      </p>
    </div>`;

  await newRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: content,
    flags: { cypher: { rerollable: false } }
  });
}

/**
 * Apply a Player Intrusion after charging its XP cost.
 *
 * @param {Actor} actor Character using the intrusion.
 * @param {string} description Player-provided intrusion description.
 * @returns {Promise<void>} Completes after the chat message is created.
 */
export async function usePlayerIntrusion(actor, description) {
  if (!(await spendXP(
    actor,
    CYPHER.xpCosts.playerIntrusion,
    game.i18n.localize("CYPHER.XP.PlayerIntrusion")
  ))) return;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cypher-roll-card"><h3>${
      game.i18n.localize("CYPHER.XP.PlayerIntrusion")
    }</h3><p>${description || ""}</p></div>`
  });
}
