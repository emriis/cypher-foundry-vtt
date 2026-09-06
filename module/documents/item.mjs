import { CYPHER } from "../config.mjs";

export default class CypherItem extends Item {

  /**
   * Utilise un cypher : marque comme épuisé et poste un message de chat.
   * Uses a cypher: marks it depleted and posts a chat message.
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
   * Effectue une attaque à partir d'un objet Arme : lance la tâche liée sur l'acteur parent,
   * avec les dégâts de base selon la catégorie d'arme (légère 2 / moyenne 4 / lourde 6).
   * Une arme non maîtrisée (freelyUsable = false, et l'avancement "Armes" non acheté)
   * handicape l'attaque d'1 pas.
   * Rolls an attack from a Weapon item, delegating to the parent actor's task roll,
   * with base damage from the weapon category (light 2 / medium 4 / heavy 6). An
   * unfamiliar weapon (freelyUsable = false, and the "Weapons" advancement not bought)
   * hinders the attack by 1 step.
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
   * Effectue le jet d'épuisement d'un Artefact (ou d'un Équipement à charges) : lance le dé
   * d'épuisement, et si le résultat tombe dans la plage d'épuisement, l'objet fonctionne quand
   * même cette fois-ci mais devient épuisé pour les usages futurs.
   * Rolls the depletion check for an Artifact (or a charge-based Equipment): rolls the
   * depletion die, and if the result falls within the depletion range, the item still works
   * this time but becomes depleted for future uses.
   *
   * Rules: "you roll the die in the depletion stat. If your roll is in the depletion range
   * of numbers, the artifact works, but that is its last use."
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
