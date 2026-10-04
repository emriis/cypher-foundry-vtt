import { CYPHER } from "../config.mjs";
import { getEligibleFocusAbilities } from "../rules/focus.mjs";
import {
  advanceSkillLevel,
  computeAdvancementEffects,
  computeTierAdvancement
} from "../rules/advancement.mjs";

/**
 * Execute an advancement purchase at the Foundry application boundary.
 *
 * @param {Actor} actor Character receiving the advancement.
 * @param {number} index Advancement slot index.
 * @param {object} extra User-selected advancement options.
 * @returns {Promise<void>}
 */
export async function purchaseAdvancementSlot(actor, index, extra = {}) {
    if (actor.type !== "pc") return;
    const slots = actor.system.advancementSlots.map(s => ({ ...s }));
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

    if (!(await actor.spendXP(
      CYPHER.xpCosts.advancementSlot,
      game.i18n.localize("CYPHER.Tab.advancement")
    ))) return;

    const { updates, skillAction } = computeAdvancementEffects(
      slot,
      extra,
      actor.system
    );

    let chatNote = "";
    if (skillAction?.type === "advance") {
      const item = actor.items.get(skillAction.skillId);
      if (item) {
        const newLevel = advanceSkillLevel(item.system.level);
        await item.update({ "system.level": newLevel });
        chatNote = game.i18n.format("CYPHER.Advancement.SkillNote", {
          name: item.name,
          level: game.i18n.localize(`CYPHER.SkillLevel.${newLevel}`)
        });
      }
    } else if (skillAction?.type === "create") {
      await actor.createEmbeddedDocuments("Item", [{
        name: skillAction.name,
        type: "skill",
        system: { level: "trained" }
      }]);
      chatNote = game.i18n.format("CYPHER.Advancement.SkillNote", {
        name: skillAction.name,
        level: game.i18n.localize("CYPHER.SkillLevel.trained")
      });
    } else if (slot.type === "capabilities") {
      chatNote = game.i18n.localize("CYPHER.Advancement.CapabilitiesNote");
    } else if (slot.type === "perfection") {
      const stat = extra.stat || "might";
      chatNote = game.i18n.format("CYPHER.Advancement.PerfectionNote", {
        stat: game.i18n.localize(`CYPHER.Stat.${stat}`)
      });
    } else if (slot.type === "effort") {
      chatNote = game.i18n.localize("CYPHER.Advancement.EffortNote");
    } else if (slot.type === "other") {
      const notes = {
        recovery: "CYPHER.Advancement.OtherRecoveryNote",
        focus: "CYPHER.Advancement.OtherFocusNote",
        armor: "CYPHER.Advancement.OtherArmorNote",
        weapons: "CYPHER.Advancement.OtherWeaponsNote",
        genre: "CYPHER.Advancement.OtherGenreNote"
      };
      chatNote = game.i18n.localize(notes[slot.otherType] ?? "");
    }

    slot.bought = true;
    updates["system.advancementSlots"] = slots;
    updates["system.resourcePoints"] =
      (actor.system.resourcePoints ?? 0) + 1;

    await actor.update(updates);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.localize("CYPHER.Advancement.Purchased")}</h3><p>${chatNote}</p></div>`
    });

    const boughtCount = slots.filter(s => s.bought).length;
    if (boughtCount >= 4) await advanceTier(actor);
  }

  /**
   * Advances the character a tier, resets advancement slots, and reminds about automatic
   * gains (a Focus ability, and a Genre ability at tiers 3/6/9...).
   */
export async function advanceTier(actor) {
    const { newTier, freshSlots } =
      computeTierAdvancement(actor.system.tier);
    const updates = { "system.tier": newTier, "system.advancementSlots": freshSlots };
    const focus = actor.getFlag("cypher", "appliedFocusGraph");
    const selectedFocusAbilities = actor.getFlag("cypher", "focusAbilityIds") ?? [];
    if (getEligibleFocusAbilities(focus, selectedFocusAbilities, newTier).length) {
      updates["flags.cypher.focusAbilityPendingTier"] = newTier;
    }
    await actor.update(updates);

    let note = game.i18n.format("CYPHER.Advancement.NewTierFocus", { tier: newTier });
    if (newTier === 3 || newTier === 6 || (newTier > 6 && (newTier - 6) % 3 === 0)) {
      note += `<br>${game.i18n.format("CYPHER.Advancement.NewTierGenre", { tier: newTier })}`;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="cypher-roll-card"><h3>${game.i18n.format("CYPHER.Advancement.TierReached", { tier: newTier })}</h3><p>${note}</p></div>`
    });
  }


