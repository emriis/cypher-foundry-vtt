import {
  computeRecoveryUpdates,
  getRecoveryRollData
} from "../rules/recovery.mjs";

/**
 * Execute a recovery roll at the Foundry application boundary.
 *
 * @param {Actor} actor Character recovering.
 * @param {string} interval Recovery interval.
 * @returns {Promise<object|null>} Recovery result.
 */
export async function rollRecovery(actor, interval = "hour") {
    const tier = actor.system.tier ?? 1;
    const bonus = actor.system.recoveryBonus ?? 0;
    const { formula, data } = getRecoveryRollData(tier, bonus);
    const roll = await new Roll(formula, data).evaluate();

    let woundNote = "";
    if (actor.type === "pc") {
      const { updates, woundNoteKey } = computeRecoveryUpdates(
        interval,
        actor.system.wounds,
        actor.system.recoveries
      );
      if (woundNoteKey) woundNote = game.i18n.localize(woundNoteKey);
      if (Object.keys(updates).length) await actor.update(updates);
    }

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      flavor: `<h3>${game.i18n.localize("CYPHER.Roll.Recovery")}</h3>
                <p>${game.i18n.localize(`CYPHER.Recovery.${interval}`)}</p>
                ${woundNote ? `<p>${woundNote}</p>` : ""}`
    });
    return roll;
  }



/**
 * Execute a Rally action at the Foundry application boundary.
 *
 * @param {Actor} actor Character rallying a wound.
 * @param {string} severity Wound severity.
 * @returns {Promise<object|null>} Rally result.
 */
export async function rallyWound(actor, severity) {
    if (actor.type !== "pc") return;

    const might = actor.system.stats.might.pool.value;
    const cost = getRallyCost(severity, actor.system.canRallyMajor);

    if (cost === null) {
      if (severity === "major" && !actor.system.canRallyMajor) {
        ui.notifications.warn(game.i18n.localize("CYPHER.Warning.CannotRallyMajor"));
      }
      return;
    }

    if (might < cost) {
      ui.notifications.error(game.i18n.localize("CYPHER.Warning.NotEnoughMightToRally"));
      return;
    }

    const result = computeRallyResult(
      severity,
      might,
      actor.system.wounds,
      actor.system.canRallyMajor
    );
    if (!result) return;

    await actor.update({
      "system.stats.might.pool.value": result.remainingMight,
      [`system.wounds.${severity}.current`]: result.remainingWound
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p>${game.i18n.format("CYPHER.Roll.Rallied", { name: actor.name, severity: game.i18n.localize(`CYPHER.Wound.${severity}`) })}</p>`
    });
  }


