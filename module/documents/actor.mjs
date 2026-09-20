import { CYPHER } from "../config.mjs";

/**
 * Extends Foundry's Actor class with Cypher logic.
 */
export default class CypherActor extends Actor {

  /* -------------------------------------------- */
  /*  Effort cost                                    */
  /* -------------------------------------------- */

  /**
   * Computes total Pool cost for a number of Effort levels, with Edge discounted
   * ONCE on the total (never per level), per the rules.
   */
  static computeEffortCost(levels, edge = 0) {
    if (levels <= 0) return 0;
    let total = CYPHER.effortCostFirstLevel + (levels - 1) * CYPHER.effortCostAdditionalLevel;
    total = Math.max(0, total - edge);
    return total;
  }

  /* -------------------------------------------- */
  /*  Stat resolution                                */
  /* -------------------------------------------- */

  /**
   * Resolves a stat key (one of the three core stats, or a custom stat by id) to its
   * data and the update path to use.
   */
  _resolveStat(statKey) {
    if (CYPHER.stats.includes(statKey)) {
      return { data: this.system.stats[statKey], path: `system.stats.${statKey}`, label: `CYPHER.Stat.${statKey}` };
    }
    const index = this.system.customStats.findIndex(s => s.id === statKey);
    if (index === -1) return null;
    const data = this.system.customStats[index];
    return { data, path: `system.customStats.${index}`, label: data.label };
  }

  /* -------------------------------------------- */
  /*  Task rolls                                    */
  /* -------------------------------------------- */

  /**
   * Rolls a Cypher task: d20 vs (difficulty - steps) * 3.
   */
  async rollTask({
    stat = "might", difficulty = 3, effortLevels = 0, assetSteps = 0,
    skillItemId = null, isAttack = false, baseDamage = 0, flavor = "",
    extraHinderSteps = 0, luckyShot = false,
    defenseType = null, incomingSeverity = "minor", armorModifier = 0, shieldItemId = null
  } = {}) {
    if (this.type !== "pc") {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.NotPC"));
      return null;
    }

    // Lucky shot: spend 1 XP to attack blind, hindered by 4 steps
    if (luckyShot) {
      if (!(await this.spendXP(CYPHER.xpCosts.luckyShot, game.i18n.localize("CYPHER.XP.LuckyShot")))) return null;
      extraHinderSteps += 4;
    }

    const resolved = this._resolveStat(stat);
    if (!resolved) return null;
    const statData = resolved.data;
    const statLabel = CYPHER.stats.includes(stat) ? game.i18n.localize(resolved.label) : resolved.label;

    // Asset steps are capped at 2.
    assetSteps = Math.min(2, Math.max(0, assetSteps));
    // Effort can't exceed the character's Effort score (max 6)
    effortLevels = Math.min(this.system.effort, 6, Math.max(0, effortLevels));

    const skillItem = skillItemId ? this.items.get(skillItemId) : null;
    const skillSteps = skillItem ? skillItem.system.stepModifier : 0;

    const edge = statData.edge ?? 0;
    const totalCost = CypherActor.computeEffortCost(effortLevels, edge);

    if (totalCost > statData.pool.value) {
      ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughPool", { stat: statLabel }));
      return null;
    }

    // Each Effort level reduces difficulty by one step; assets, skill, wound hindrance,
    // and any extra hindrance (lucky shot, unfamiliar weapon...) also apply.
    const woundHinder = this.system.hinderSteps ?? 0;

    // An unfamiliar armor's Speed hindrance is applied to all Speed tasks, except Dodge,
    // where armorModifier already applies the same value.
    const autoArmorSpeedHinder = (stat === "speed" && defenseType !== "dodge")
      ? (this.system.armor?.speedTaskHinder ?? 0)
      : 0;

    const totalSteps = effortLevels + assetSteps + skillSteps - woundHinder - extraHinderSteps + armorModifier - autoArmorSpeedHinder;
    const effectiveDifficulty = Math.max(0, difficulty - totalSteps);
    const targetNumber = effectiveDifficulty * 3;

    // Spend the Pool points.
    if (totalCost > 0) {
      await this.update({ [`${resolved.path}.pool.value`]: statData.pool.value - totalCost });
    }

    const roll = await new Roll("1d20").evaluate();
    const d20 = roll.total;
    const success = effectiveDifficulty <= 0 ? true : d20 >= targetNumber;

    // Special results on 1 / 17 / 18 / 19 / 20, as defined by the rules.
    let damageBonus = 0;
    let effectText = "";
    let refund = false;

    if (d20 === 1) {
      effectText = game.i18n.localize("CYPHER.Roll.GMIntrusionFree");
    } else if (success && isAttack) {
      if (d20 === 17) damageBonus = 1;
      else if (d20 === 18) damageBonus = 2;
      else if (d20 === 19) damageBonus = 3;
      else if (d20 === 20) { damageBonus = 4; refund = true; }
    } else if (success && d20 === 19) {
      effectText = game.i18n.localize("CYPHER.Roll.MinorEffect");
    } else if (success && d20 === 20) {
      effectText = game.i18n.localize("CYPHER.Roll.MajorEffect");
      refund = true;
    }

    // A natural 20 refunds the action's point cost.
    if (refund && totalCost > 0) {
      const afterSpend = statData.pool.value - totalCost;
      await this.update({ [`${resolved.path}.pool.value`]: Math.min(statData.pool.max, afterSpend + totalCost) });
    }

    const totalDamage = isAttack ? baseDamage + damageBonus : 0;

    // A successful Block can transfer the whole wound to an equipped, unbroken shield
    // instead of reducing it by one step on the character.
    const shieldItem = shieldItemId ? this.items.get(shieldItemId) : null;
    const usingShield = defenseType === "block" && shieldItem?.type === "shield" && !shieldItem.system.broken;

    // Descriptive text for the defense result, shown in the message.
    let defenseNote = "";
    if (defenseType) {
      if (success) {
        if (defenseType === "block" && usingShield) {
          defenseNote = `<p class="cypher-defense-note">${game.i18n.format("CYPHER.Shield.Absorbed", { name: shieldItem.name, severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
        } else if (defenseType === "block") {
          defenseNote = `<p class="cypher-defense-note">${game.i18n.format("CYPHER.Defense.BlockSuccess", { severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
        } else {
          defenseNote = `<p class="cypher-defense-note">${game.i18n.localize("CYPHER.Defense.DodgeSuccess")}</p>`;
        }
      } else {
        defenseNote = `<p class="cypher-defense-note failure">${game.i18n.format("CYPHER.Defense.Failed", { severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
      }
    }

    const messageFlavor = `
      <div class="cypher-roll-card">
        <h3>${flavor || game.i18n.localize("CYPHER.Roll.Task")}</h3>
        <p>${statLabel} —
           ${game.i18n.localize("CYPHER.Roll.Difficulty")} ${difficulty}
           (${game.i18n.localize("CYPHER.Roll.Effective")}: ${effectiveDifficulty}) —
           ${game.i18n.localize("CYPHER.Roll.Target")}: ${effectiveDifficulty <= 0 ? game.i18n.localize("CYPHER.Roll.Routine") : targetNumber}</p>
        ${effortLevels ? `<p>${game.i18n.localize("CYPHER.Roll.EffortSpent")}: ${effortLevels} (${totalCost} ${game.i18n.localize("CYPHER.Roll.PoolPoints")})</p>` : ""}
        ${woundHinder ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.WoundHinder", { steps: woundHinder })}</p>` : ""}
        ${extraHinderSteps ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.ExtraHinder", { steps: extraHinderSteps })}</p>` : ""}
        ${armorModifier ? `<p class="cypher-armor-mod">${game.i18n.format("CYPHER.Roll.ArmorModifier", { steps: armorModifier })}</p>` : ""}
        ${autoArmorSpeedHinder ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.ArmorSpeedHinder", { steps: autoArmorSpeedHinder })}</p>` : ""}
        <p class="cypher-result ${success ? "success" : "failure"}">
          ${success ? game.i18n.localize("CYPHER.Roll.Success") : game.i18n.localize("CYPHER.Roll.Failure")}
          ${isAttack && damageBonus ? ` — +${damageBonus} ${game.i18n.localize("CYPHER.Damage")} (${totalDamage} ${game.i18n.localize("CYPHER.Roll.TotalDamage")})` : ""}
          ${effectText ? ` — ${effectText}` : ""}
        </p>
        ${refund && totalCost > 0 ? `<p class="cypher-refund">${game.i18n.localize("CYPHER.Roll.CostRefunded")}</p>` : ""}
        ${defenseNote}
      </div>`;

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: messageFlavor,
      flags: {
        "cypher": {
          rerollable: true,
          rollType: "task",
          actorId: this.id,
          d20,
          targetNumber,
          effectiveDifficulty,
          isAttack,
          baseDamage
        }
      }
    });

    // Resolve the wound based on the defense result.
    if (defenseType) {
      if (success) {
        if (defenseType === "block") {
          if (usingShield) {
            await this._shieldAbsorbWound(shieldItem, incomingSeverity);
          } else {
            const reduced = this._reduceWoundSeverity(incomingSeverity);
            if (reduced) await this.addWound(reduced);
          }
        }
        // A successful Dodge avoids the wound entirely.
      } else {
        await this.addWound(incomingSeverity);
      }
    }

    return { roll, success, targetNumber, effectiveDifficulty, damage: totalDamage };
  }

  /**
   * Reduces a wound severity by one step (major→moderate→minor→none).
   */
  _reduceWoundSeverity(severity) {
    if (severity === "major") return "moderate";
    if (severity === "moderate") return "minor";
    return null; // A minor wound reduced by one step disappears.
  }

  /**
   * Has a shield absorb a whole wound, with cascading overflow (3 minor → 2 moderate →
   * 1 major, per the rules). The shield is destroyed as soon as it takes a major wound.
   */
  async _shieldAbsorbWound(shieldItem, severity) {
    const w = shieldItem.system.wounds;
    let target = severity;
    if (target === "minor" && w.minor.current >= w.minor.max) target = "moderate";
    if (target === "moderate" && w.moderate.current >= w.moderate.max) target = "major";

    const newCurrent = w[target].current + 1;
    await shieldItem.update({ [`system.wounds.${target}.current`]: Math.min(newCurrent, w[target].max) });

    if (target === "major" && newCurrent >= w.major.max) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.Shield.Broken")}</h3><p>${game.i18n.format("CYPHER.Shield.BrokenNote", { name: shieldItem.name })}</p></div>`
      });
    }
  }

  /**
   * Rolls a Defense task: Block (Might, eased by armor) or Dodge (Speed, hindered by armor),
   * against the attacker's target number. A successful Block reduces the wound's severity by
   * one step; a successful Dodge avoids it entirely; a failure inflicts the wound as-is.
   */
  async rollDefense(defenseType, { difficulty = 3, effortLevels = 0, assetSteps = 0, incomingSeverity = "minor", shieldItemId = null, skillItemId = null } = {}) {
    if (this.type !== "pc") return null;
    const stat = defenseType === "block" ? "might" : "speed";
    const armorModifier = defenseType === "block"
      ? (this.system.armor.blockEase ?? 0)
      : -(this.system.armor.dodgeHinder ?? 0);

    return this.rollTask({
      stat, difficulty, effortLevels, assetSteps, armorModifier, skillItemId,
      defenseType, incomingSeverity, shieldItemId,
      flavor: `${game.i18n.localize(defenseType === "block" ? "CYPHER.Defense.Block" : "CYPHER.Defense.Dodge")}`
    });
  }

  /* -------------------------------------------- */
  /*  Experience Points                              */
  /* -------------------------------------------- */

  /**
   * Spends XP if the character has enough. Returns true if the spend succeeded.
   */
  async spendXP(amount, reasonLabel = "") {
    if (this.type !== "pc") return false;
    if ((this.system.xp ?? 0) < amount) {
      ui.notifications.error(game.i18n.format("CYPHER.Warning.NotEnoughXP", { amount, reason: reasonLabel }));
      return false;
    }
    await this.update({ "system.xp": (this.system.xp ?? 0) - amount });
    return true;
  }

  /**
   * Rerolls a previous roll by spending 1 XP, keeping the better of the two results.
   */
  async rerollMessage(message) {
    const flags = message.getFlag("cypher", "rerollable") ? message.flags["cypher"] : null;
    if (!flags) return;

    if (flags.rollType === "depletion") return this._rerollDepletion(message, flags);

    if (!(await this.spendXP(CYPHER.xpCosts.reroll, game.i18n.localize("CYPHER.XP.Reroll")))) return;

    const newRoll = await new Roll("1d20").evaluate();
    const oldD20 = flags.d20;
    const finalD20 = Math.max(oldD20, newRoll.total);
    const success = flags.effectiveDifficulty <= 0 ? true : finalD20 >= flags.targetNumber;

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

    const totalDamage = flags.isAttack ? flags.baseDamage + damageBonus : 0;

    const content = `
      <div class="cypher-roll-card cypher-reroll-card">
        <h3>${game.i18n.localize("CYPHER.XP.RerollResult")}</h3>
        <p>${game.i18n.format("CYPHER.XP.RerollCompare", { old: oldD20, new: newRoll.total, final: finalD20 })}</p>
        <p class="cypher-result ${success ? "success" : "failure"}">
          ${success ? game.i18n.localize("CYPHER.Roll.Success") : game.i18n.localize("CYPHER.Roll.Failure")}
          ${flags.isAttack && damageBonus ? ` — +${damageBonus} ${game.i18n.localize("CYPHER.Damage")} (${totalDamage} ${game.i18n.localize("CYPHER.Roll.TotalDamage")})` : ""}
          ${effectText ? ` — ${effectText}` : ""}
        </p>
      </div>`;

    await newRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: content,
      flags: { "cypher": { rerollable: false } }
    });
  }

  /**
   * Rerolls a depletion check (1 XP), keeping the better of the two results (the higher one,
   * since a higher result avoids depletion).
   */
  async _rerollDepletion(message, flags) {
    const item = this.items.get(flags.itemId);
    if (!item) return;
    if (!(await this.spendXP(CYPHER.xpCosts.reroll, game.i18n.localize("CYPHER.XP.Reroll")))) return;

    const newRoll = await new Roll(`1d${flags.dieMax}`).evaluate();
    const finalValue = Math.max(flags.originalRoll, newRoll.total);
    const depletes = finalValue <= flags.threshold;

    if (depletes && !item.system.depleted) await item.update({ "system.depleted": true });

    const content = `
      <div class="cypher-roll-card cypher-reroll-card">
        <h3>${game.i18n.localize("CYPHER.XP.RerollResult")}</h3>
        <p>${game.i18n.format("CYPHER.XP.RerollCompare", { old: flags.originalRoll, new: newRoll.total, final: finalValue })}</p>
        <p class="cypher-result ${depletes ? "failure" : "success"}">
          ${depletes ? game.i18n.localize("CYPHER.Depletion.LastUse") : game.i18n.localize("CYPHER.Depletion.StillWorks")}
        </p>
      </div>`;

    await newRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: content,
      flags: { "cypher": { rerollable: false } }
    });
  }

  /**
   * Player intrusion: spend 1 XP to alter the situation in the character's favor.
   */
  async usePlayerIntrusion(description) {
    if (!(await this.spendXP(CYPHER.xpCosts.playerIntrusion, game.i18n.localize("CYPHER.XP.PlayerIntrusion")))) return;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.XP.PlayerIntrusion")}</h3><p>${description || ""}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Character advancement                           */
  /* -------------------------------------------- */

  /**
   * Purchases an advancement slot for the current tier (4 XP). Automatically applies the
   * matching mechanical effect, and advances the character a tier once all 4 slots are bought.
   */
  async purchaseAdvancementSlot(index, extra = {}) {
    if (this.type !== "pc") return;
    const slots = this.system.advancementSlots.map(s => ({ ...s }));
    const slot = slots[index];
    if (!slot || slot.bought) return;
    if (!slot.type) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.ChooseAdvancementType"));
      return;
    }
    if (slot.type === "other" && !slot.otherType) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.ChooseAdvancementType"));
      return;
    }

    if (!(await this.spendXP(CYPHER.xpCosts.advancementSlot, game.i18n.localize("CYPHER.Tab.advancement")))) return;

    const updates = {};
    let chatNote = "";

    switch (slot.type) {
      case "capabilities": {
        const dist = extra.distribution ?? {};
        for (const stat of CYPHER.stats) {
          const add = Number(dist[stat]) || 0;
          if (add) {
            updates[`system.stats.${stat}.pool.max`] = this.system.stats[stat].pool.max + add;
            updates[`system.stats.${stat}.pool.value`] = this.system.stats[stat].pool.value + add;
          }
        }
        chatNote = game.i18n.localize("CYPHER.Advancement.CapabilitiesNote");
        break;
      }
      case "perfection": {
        const stat = extra.stat || "might";
        updates[`system.stats.${stat}.edge`] = this.system.stats[stat].edge + 1;
        chatNote = game.i18n.format("CYPHER.Advancement.PerfectionNote", { stat: game.i18n.localize(`CYPHER.Stat.${stat}`) });
        break;
      }
      case "effort": {
        updates["system.effort"] = Math.min(6, this.system.effort + 1);
        chatNote = game.i18n.localize("CYPHER.Advancement.EffortNote");
        break;
      }
      case "skill": {
        if (extra.skillId) {
          const item = this.items.get(extra.skillId);
          if (item) {
            const order = ["inability", "none", "trained", "specialized", "expert"];
            const newLevel = item.system.level === "inability"
              ? "trained"
              : order[Math.min(order.length - 1, order.indexOf(item.system.level) + 1)];
            await item.update({ "system.level": newLevel });
            chatNote = game.i18n.format("CYPHER.Advancement.SkillNote", { name: item.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) });
          }
        } else if (extra.newSkillName?.trim()) {
          await this.createEmbeddedDocuments("Item", [{ name: extra.newSkillName.trim(), type: "skill", system: { level: "trained" } }]);
          chatNote = game.i18n.format("CYPHER.Advancement.SkillNote", { name: extra.newSkillName.trim(), level: game.i18n.localize("CYPHER.SkillLevel.trained") });
        }
        break;
      }
      case "other": {
        if (slot.otherType === "recovery") {
          updates["system.recoveryBonus"] = (this.system.recoveryBonus ?? 0) + 2;
          chatNote = game.i18n.localize("CYPHER.Advancement.OtherRecoveryNote");
        } else if (slot.otherType === "focus") {
          chatNote = game.i18n.localize("CYPHER.Advancement.OtherFocusNote");
        } else if (slot.otherType === "armor") {
          updates["system.canFreelyUseAllArmor"] = true;
          chatNote = game.i18n.localize("CYPHER.Advancement.OtherArmorNote");
        } else if (slot.otherType === "weapons") {
          updates["system.canFreelyUseAllWeapons"] = true;
          chatNote = game.i18n.localize("CYPHER.Advancement.OtherWeaponsNote");
        } else if (slot.otherType === "genre") {
          chatNote = game.i18n.localize("CYPHER.Advancement.OtherGenreNote");
        }
        break;
      }
    }

    slot.bought = true;
    updates["system.advancementSlots"] = slots;
    updates["system.resourcePoints"] = (this.system.resourcePoints ?? 0) + 1;

    await this.update(updates);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.Advancement.Purchased")}</h3><p>${chatNote}</p></div>`
    });

    const boughtCount = slots.filter(s => s.bought).length;
    if (boughtCount >= 4) await this._advanceTier();
  }

  /**
   * Advances the character a tier, resets advancement slots, and reminds about automatic
   * gains (a Focus ability, and a Genre ability at tiers 3/6/9...).
   */
  async _advanceTier() {
    const newTier = Math.min(6, this.system.tier + 1);
    const freshSlots = [
      { type: "", otherType: "", bought: false },
      { type: "", otherType: "", bought: false },
      { type: "", otherType: "", bought: false },
      { type: "", otherType: "", bought: false }
    ];
    await this.update({ "system.tier": newTier, "system.advancementSlots": freshSlots });

    let note = game.i18n.format("CYPHER.Advancement.NewTierFocus", { tier: newTier });
    if (newTier === 3 || newTier === 6 || (newTier > 6 && (newTier - 6) % 3 === 0)) {
      note += `<br>${game.i18n.format("CYPHER.Advancement.NewTierGenre", { tier: newTier })}`;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.format("CYPHER.Advancement.TierReached", { tier: newTier })}</h3><p>${note}</p></div>`
    });
  }

  /* -------------------------------------------- */
  /*  Recovery rolls                                 */
  /* -------------------------------------------- */

  /**
   * Takes a recovery: restores 1d6+Tier Pool points and removes wounds
   * based on the chosen interval.
   */
  async rollRecovery(interval = "hour") {
    const tier = this.system.tier ?? 1;
    const bonus = this.system.recoveryBonus ?? 0;
    const roll = await new Roll(`1d6 + @tier + @bonus`, { tier, bonus }).evaluate();

    let woundNote = "";
    if (this.type === "pc") {
      const updates = {};
      const w = this.system.wounds;

      if (interval === "tenMinutes") {
        updates["system.wounds.minor.current"] = 0;
        woundNote = game.i18n.localize("CYPHER.Recovery.RemovesAllMinor");
      } else if (interval === "hour") {
        if (w.moderate.current > 0) {
          updates["system.wounds.moderate.current"] = w.moderate.current - 1;
          woundNote = game.i18n.localize("CYPHER.Recovery.RemovesOneModerate");
        } else {
          updates["system.wounds.minor.current"] = 0;
          woundNote = game.i18n.localize("CYPHER.Recovery.RemovesAllMinor");
        }
      } else if (interval === "tenHours") {
        updates["system.wounds.moderate.current"] = 0;
        woundNote = game.i18n.localize("CYPHER.Recovery.RemovesAllModerateReminder");
      }

      if (!this.system.recoveries[interval]) updates[`system.recoveries.${interval}`] = true;
      if (Object.keys(updates).length) await this.update(updates);
    }

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<h3>${game.i18n.localize("CYPHER.Roll.Recovery")}</h3>
                <p>${game.i18n.localize(`CYPHER.Recovery.${interval}`)}</p>
                ${woundNote ? `<p>${woundNote}</p>` : ""}`
    });
    return roll;
  }

  /**
   * Rally: spend Might points to remove a wound. A major wound can only be rallied
   * in the Superhero genre (cost: 10 Might).
   */
  async rallyWound(severity) {
    if (this.type !== "pc") return;

    let cost;
    if (severity === "major") {
      if (!this.system.canRallyMajor) {
        ui.notifications.warn(game.i18n.localize("CYPHER.Warning.CannotRallyMajor"));
        return;
      }
      cost = CYPHER.rallyCostMajorSuperhero;
    } else {
      cost = CYPHER.rallyCost[severity];
    }

    const might = this.system.stats.might.pool.value;
    if (might < cost) {
      ui.notifications.error(game.i18n.localize("CYPHER.Warning.NotEnoughMightToRally"));
      return;
    }
    const current = this.system.wounds[severity].current;
    if (current <= 0) return;

    await this.update({
      "system.stats.might.pool.value": might - cost,
      [`system.wounds.${severity}.current`]: current - 1
    });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<p>${game.i18n.format("CYPHER.Roll.Rallied", { name: this.name, severity: game.i18n.localize(`CYPHER.Wound.${severity}`) })}</p>`
    });
  }

  /* -------------------------------------------- */
  /*  Custom stats                                   */
  /* -------------------------------------------- */

  /**
   * Adds a custom stat (in addition to Might/Speed/Intellect).
   */
  async addCustomStat(label) {
    if (this.type !== "pc" || !label?.trim()) return;
    const id = label.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `stat-${foundry.utils.randomID(6)}`;

    if (CYPHER.stats.includes(id) || this.system.customStats.some(s => s.id === id)) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Warning.CustomStatExists"));
      return;
    }

    const customStats = this.system.customStats.map(s => ({ ...s }));
    customStats.push({ id, label: label.trim(), pool: { max: 8, value: 8 }, edge: 0 });
    await this.update({ "system.customStats": customStats });
  }

  async deleteCustomStat(id) {
    if (this.type !== "pc") return;
    const customStats = this.system.customStats.filter(s => s.id !== id);
    await this.update({ "system.customStats": customStats });
  }

  /* -------------------------------------------- */
  /*  Champs Libres / Custom fields                 */
  /* -------------------------------------------- */

  /**
   * Adds a custom field (text, number, or checkbox) — to add any character element the
   * system doesn't already provide for, independent of genre.
   */
  async addCustomField(label, fieldType = "text") {
    if (this.type !== "pc" || !label?.trim()) return;
    if (!CYPHER.customFieldTypes.includes(fieldType)) fieldType = "text";

    const id = `field-${foundry.utils.randomID(8)}`;
    const customFields = this.system.customFields.map(f => ({ ...f }));
    customFields.push({
      id, label: label.trim(), fieldType,
      valueText: "", valueNumber: 0, valueBoolean: false
    });
    await this.update({ "system.customFields": customFields });
  }

  async deleteCustomField(id) {
    if (this.type !== "pc") return;
    const customFields = this.system.customFields.filter(f => f.id !== id);
    await this.update({ "system.customFields": customFields });
  }

  /* -------------------------------------------- */
  /*  Armor damage                                   */
  /* -------------------------------------------- */

  /**
   * Damages the worn armor (special attack or GM intrusion): reduces its Block-easing bonus
   * by a given number of steps, capped at the base bonus (can't go below 0). The Dodge
   * hindrance is never affected.
   */
  async damageArmor(steps = 1) {
    if (this.type !== "pc") return;
    const itemId = this.system.armor.itemId;
    if (!itemId) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Armor.NoArmorEquipped"));
      return;
    }
    const item = this.items.get(itemId);
    if (!item) return;

    const baseEase = this.system.armor.baseBlockEase ?? 0;
    if (baseEase <= 0) {
      ui.notifications.info(game.i18n.localize("CYPHER.Armor.NoBlockBonusToDamage"));
      return;
    }
    const newDamage = Math.min(baseEase, (item.system.blockEaseDamage ?? 0) + steps);
    await item.update({ "system.blockEaseDamage": newDamage });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.Armor.Damaged")}</h3><p>${game.i18n.format("CYPHER.Armor.DamagedNote", { name: this.name })}</p></div>`
    });
  }

  /**
   * Repairs the equipped armor, clearing all accumulated damage to its Block bonus.
   */
  async repairArmor() {
    if (this.type !== "pc") return;
    const itemId = this.system.armor.itemId;
    if (!itemId) return;
    const item = this.items.get(itemId);
    if (!item) return;
    await item.update({ "system.blockEaseDamage": 0 });
  }

  /* -------------------------------------------- */
  /*  Damage and wounds                              */
  /* -------------------------------------------- */

  /**
   * Applies damage. For a PC, converts the amount to a wound severity
   * (1-4 minor, 5-8 moderate, 9+ major) unless an explicit severity is given.
   */
  async applyDamage(amount, { severity = null, stat = null, ignoreArmor = false } = {}) {
    if (this.type !== "pc") return this._applyNpcDamage(amount, { ignoreArmor });

    // Direct Pool damage converts any overflow into a wound via the conversion table.
    if (stat) {
      const resolved = this._resolveStat(stat);
      if (!resolved) return;
      const pool = resolved.data.pool;
      const overflow = Math.max(0, amount - pool.value);
      const newValue = Math.max(0, pool.value - amount);
      await this.update({ [`${resolved.path}.pool.value`]: newValue });
      if (overflow > 0) {
        const woundSeverity = severity ?? this._convertDamageToWound(overflow);
        await this.addWound(woundSeverity);
      }
      return;
    }

    const woundSeverity = severity ?? this._convertDamageToWound(amount);
    await this.addWound(woundSeverity);
  }

  _convertDamageToWound(amount) {
    for (const tier of CYPHER.poolDamageToWound) {
      if (amount <= tier.max) return tier.severity;
    }
    return "major";
  }

  /**
   * Adds a wound of a given severity, with cascading overflow.
   */
  async addWound(severity) {
    if (this.type !== "pc") return;
    const w = this.system.wounds;
    let target = severity;

    if (target === "minor" && w.minor.current >= w.minor.max) target = "moderate";
    if (target === "moderate" && w.moderate.current >= w.moderate.max) target = "major";

    const newCurrent = w[target].current + 1;
    await this.update({ [`system.wounds.${target}.current`]: Math.min(newCurrent, w[target].max) });

    if (target === "major" && newCurrent >= w.major.max) {
      ui.notifications.error(game.i18n.format("CYPHER.Warning.CharacterDied", { name: this.name }));
    }

    await this._syncWoundStatusEffects();
  }

  async _applyNpcDamage(amount, { ignoreArmor = false } = {}) {
    const armor = ignoreArmor ? 0 : (this.system.armor ?? 0);
    const finalDamage = Math.max(0, amount - armor);
    const health = this.system.health;
    if (!health) return;
    const newValue = Math.max(0, health.value - finalDamage);
    await this.update({ "system.health.value": newValue });
    return finalDamage;
  }

  /**
   * Toggles the "Hindered" and "Dead" token status icons based on the current wound state.
   */
  async _syncWoundStatusEffects() {
    if (this.type !== "pc") return;
    const shouldBeHindered = !!this.system.hindered;
    const shouldBeDead = !!this.system.dead;

    if (this.statuses?.has("hindered") !== shouldBeHindered) {
      await this.toggleStatusEffect("hindered", { active: shouldBeHindered });
    }
    if (this.statuses?.has("dead") !== shouldBeDead) {
      await this.toggleStatusEffect("dead", { active: shouldBeDead });
    }
  }

  /* -------------------------------------------- */
  /*  Types                                         */
  /* -------------------------------------------- */

  /**
   * Applies the mechanical benefits of a Type dropped from a compendium.
   * The source Type is not embedded on the actor; its applied id is stored so
   * dropping it again cannot grant the benefits twice.
   */
  async applyType(typeItem, { stat = null, skillName = null } = {}) {
    if (this.type !== "pc" || typeItem?.type !== "type") return false;
    if (this.getFlag("cypher", "appliedTypeId")) {
      ui.notifications.warn(game.i18n.localize("CYPHER.Type.AlreadyApplied"));
      return false;
    }

    const system = typeItem.system;
    const poolBonuses = system.poolBonuses ?? {};
    const woundBonuses = system.woundBonuses ?? {};
    const chosenStat = stat && CYPHER.stats.includes(stat) ? stat : "might";
    const updates = {
      "system.type": typeItem.name,
      "system.genre": { Fantasy: "fantasy", "Science Fiction": "sciFi", Superheroes: "superhero" }[system.genre] ?? this.system.genre,
      "flags.cypher.appliedTypeId": typeItem.id ?? typeItem._id
    };

    for (const statName of CYPHER.stats) {
      const amount = Number(poolBonuses[statName]) || 0;
      if (!amount) continue;
      updates[`system.stats.${statName}.pool.max`] = this.system.stats[statName].pool.max + amount;
      updates[`system.stats.${statName}.pool.value`] = this.system.stats[statName].pool.value + amount;
    }
    if (system.edgeChoice) {
      updates[`system.stats.${chosenStat}.edge`] = this.system.stats[chosenStat].edge + Number(system.edgeChoice);
    }
    for (const severity of CYPHER.woundSeverities) {
      const amount = Number(woundBonuses[severity]) || 0;
      if (amount) updates[`system.wounds.${severity}.max`] = this.system.wounds[severity].max + amount;
    }
    if (system.freeWeapons) updates["system.canFreelyUseAllWeapons"] = true;
    if (system.freeArmor) updates["system.canFreelyUseAllArmor"] = true;

    await this.update(updates);

    const finalSkillName = skillName?.trim() || (system.skillOptions ?? []).find(value => value?.trim());
    let skillNote = "";
    if (finalSkillName) {
      const existing = this.items.find(item => item.type === "skill" && item.name.toLowerCase() === finalSkillName.toLowerCase());
      if (existing) {
        const order = ["inability", "none", "trained", "specialized", "expert"];
        const index = Math.max(0, order.indexOf(existing.system.level));
        const newLevel = order[Math.min(order.length - 1, index + 1)];
        await existing.update({ "system.level": newLevel });
        skillNote = game.i18n.format("CYPHER.Type.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) });
      } else {
        await this.createEmbeddedDocuments("Item", [{
          name: finalSkillName,
          type: "skill",
          system: { level: "trained", description: game.i18n.format("CYPHER.Type.GrantedFrom", { name: typeItem.name }) }
        }]);
        skillNote = game.i18n.format("CYPHER.Type.SkillGranted", { name: finalSkillName });
      }
    }

    const abilities = (system.abilities ?? []).map(ability => ({
      name: ability.name,
      type: "ability",
      system: {
        source: typeItem.name,
        tier: Number(ability.tier) || 1,
        enabler: Boolean(ability.enabler),
        cost: ability.cost ?? { stat: "none", amount: 0 },
        action: "none",
        description: ability.description ?? ""
      }
    }));
    if (abilities.length) await this.createEmbeddedDocuments("Item", abilities);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.format("CYPHER.Type.Applied", { name: typeItem.name })}</h3><p>${skillNote}</p></div>`
    });
    return true;
  }

  /* -------------------------------------------- */
  /*  Descriptors                                    */
  /* -------------------------------------------- */

  /**
   * Applies a CRD Descriptor to the character: increases the chosen Pool by the given amount
   * and creates (or advances) a trained Skill. Unlike a normal item, the Descriptor itself is
   * never embedded on the actor — only its effect is, mirroring how a Type or Focus work in
   * the CRD (see also system.descriptor, already shown in the header's character sentence).
   *
  * @param {Item} descriptorItem The Descriptor item (compendium or world) to apply
   * @param {object} [options]
  * @param {string} [options.stat] Chosen stat among statOptions (ignored if only one choice)
  * @param {string} [options.skillName] Chosen skill name (from skillOptions, or freely typed)
   */
  async applyDescriptor(descriptorItem, { stat = null, skillName = null } = {}) {
    if (this.type !== "pc" || descriptorItem?.type !== "descriptor") return;

    const statOptions = descriptorItem.system.statOptions ?? [];
    const chosenStat = stat && statOptions.includes(stat) ? stat : statOptions[0];
    const finalSkillName = skillName?.trim();
    if (!chosenStat || !finalSkillName) return;

    const amount = descriptorItem.system.statAmount ?? 2;
    await this.update({
      "system.descriptor": descriptorItem.name,
      [`system.stats.${chosenStat}.pool.max`]: this.system.stats[chosenStat].pool.max + amount,
      [`system.stats.${chosenStat}.pool.value`]: this.system.stats[chosenStat].pool.value + amount
    });

    // Advance an existing skill of the same name, or create a new trained skill, using the
    // same progression logic as purchaseAdvancementSlot's "skill" advancement.
    const order = ["inability", "none", "trained", "specialized", "expert"];
    const existing = this.items.find(i => i.type === "skill" && i.name.toLowerCase() === finalSkillName.toLowerCase());
    let chatNote;

    if (existing) {
      const newLevel = existing.system.level === "inability"
        ? "trained"
        : order[Math.min(order.length - 1, order.indexOf(existing.system.level) + 1)];
      await existing.update({ "system.level": newLevel });
      chatNote = game.i18n.format("CYPHER.Descriptor.SkillUpgraded", { name: existing.name, level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`) });
    } else {
      const [created] = await this.createEmbeddedDocuments("Item", [{
        name: finalSkillName,
        type: "skill",
        system: {
          level: "trained",
          description: game.i18n.format("CYPHER.Descriptor.GrantedFrom", { name: descriptorItem.name })
        }
      }]);
      chatNote = game.i18n.format("CYPHER.Descriptor.SkillGranted", { name: created.name });
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="cypher-roll-card">
        <h3>${game.i18n.format("CYPHER.Descriptor.Applied", { name: descriptorItem.name })}</h3>
        <p>${game.i18n.format("CYPHER.Descriptor.StatNote", { amount, stat: game.i18n.localize(`CYPHER.Stat.${chosenStat}`) })}</p>
        <p>${chatNote}</p>
      </div>`
    });
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }
}
