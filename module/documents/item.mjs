import { CYPHER } from "../config.mjs";

/**
 * Foundry Item document extended with Cypher-specific item behavior.
 *
 * This document owns item actions that need access to the parent actor or to
 * Foundry document APIs, while reusable game rules remain centralized in the
 * configuration and actor logic.
 */
export default class CypherItem extends Item {

  /**
   * Uses a cypher, marks it as depleted, and posts a chat notification.
   *
   * No-op when called for a non-cypher item.
   *
   * @returns {Promise<void>|undefined} The update and chat-message operation.
   */
  async useCypher() {
    if (this.type !== "cypher") return;
    await this.update({ "system.depleted": true });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<h3>${this.name}</h3><p>${game.i18n.localize("CYPHER.Cypher.Used")}</p>`
    });
  }

  /**
   * Rolls an attack using this weapon and delegates task resolution to the parent actor.
   *
   * Weapon familiarity is converted into a task hindrance here so the actor remains
   * responsible for the common task-roll calculation.
   *
   * @param {object} [options={}] Attack-roll options.
   * @param {number} [options.effortLevels=0] Number of Effort levels to spend.
   * @param {number} [options.assetSteps=0] Number of asset steps applied to the roll.
   * @param {number} [options.difficulty=3] Base task difficulty.
   * @param {boolean} [options.luckyShot=false] Whether to use the Lucky Shot rule.
   * @param {string|null} [options.skillItemId=null] Skill item used for the attack.
   * @returns {Promise<object>|undefined} The actor task-roll result.
   */
  async rollAttack({ effortLevels = 0, assetSteps = 0, difficulty = 3, luckyShot = false, skillItemId = null } = {}) {
    if (this.type !== "attack" || !this.actor) return;
    const baseDamage = this.system.damage || CYPHER.weaponDamage[this.system.attackType] || 2;
    const weaponHinder = (this.system.freelyUsable || this.actor.system.canFreelyUseAllWeapons) ? 0 : 1;

    return this.actor.rollTask({
      stat: this.system.stat,
      difficulty,
      effortLevels,
      assetSteps,
      skillItemId,
      isAttack: true,
      baseDamage,
      extraHinderSteps: weaponHinder,
      luckyShot,
      flavor: `${game.i18n.localize("CYPHER.Roll.Attack")}: ${this.name}`
    });
  }

  /**
   * Rolls an artifact or charge-based equipment depletion check.
   *
   * When the result is within the configured depletion threshold, the item still
   * works for the current use but becomes depleted for subsequent uses.
   *
   * @returns {Promise<void>|undefined} The depletion-check operation.
   */
  async rollDepletion() {
    if (!["artifact", "equipment"].includes(this.type) || !this.actor) return;
    const die = this.system.depletionDie;

    if (die === "none") {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="cypher-roll-card"><h3>${this.name}</h3><p>${game.i18n.localize("CYPHER.Depletion.Never")}</p></div>`
      });
      return;
    }

    const max = CYPHER.depletionDieMax[die];
    const threshold = this.system.depletionThreshold;
    const roll = await new Roll(`1d${max}`).evaluate();
    const depletes = roll.total <= threshold;

    if (depletes) await this.update({ "system.depleted": true });

    const flavor = `
      <div class="cypher-roll-card">
        <h3>${game.i18n.format("CYPHER.Depletion.Title", { name: this.name })}</h3>
        <p>${game.i18n.format("CYPHER.Depletion.Range", { threshold, die })}</p>
        <p class="cypher-result ${depletes ? "failure" : "success"}">
          ${depletes ? game.i18n.localize("CYPHER.Depletion.LastUse") : game.i18n.localize("CYPHER.Depletion.StillWorks")}
        </p>
      </div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor,
      flags: {
        "cypher": {
          rerollable: true,
          rollType: "depletion",
          actorId: this.actor.id,
          itemId: this.id,
          threshold,
          dieMax: max,
          originalRoll: roll.total
        }
      }
    });
  }
}
