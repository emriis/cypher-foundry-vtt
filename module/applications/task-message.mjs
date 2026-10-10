/** Build localized task chat without rolling dice or mutating documents. */
/**
 * Format a completed task snapshot for chat.
 * @param {object} context Resolved values from the task pipeline.
 * @returns {string} Localized roll-card HTML.
 */
export function buildTaskMessage({
    applyIncomingWound, statLabel, defenseType, success, usingShield, shieldItem, incomingSeverity,
    weaponSource, isAttack, flavor, abilitySource, targetActor, difficulty, effectiveDifficulty,
    targetNumber, effortLevels, totalCost, woundHinder, extraHinderSteps, weaponRangeAdjudication,
    armorModifier, autoArmorSpeedHinder, damageBonus, totalDamage, effectText, refund
  }) {
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
    } else if (applyIncomingWound) {
      defenseNote = `<p class="cypher-defense-note failure">${game.i18n.format("CYPHER.Defense.Failed", { severity: game.i18n.localize(`CYPHER.Wound.${incomingSeverity}`) })}</p>`;
    }
  }

  const actionTimingKey = {
    firstAction: "CYPHER.Ability.ActionFirst",
    action: "CYPHER.Ability.ActionStandard",
    lastAction: "CYPHER.Ability.ActionLast"
  }[weaponSource.actionTiming];
  const weaponTimingNote = isAttack && actionTimingKey
    ? `<p class="cypher-weapon-timing">${game.i18n.localize("CYPHER.Ability.Action")}: ${game.i18n.localize(actionTimingKey)}</p>`
    : "";

  const messageFlavor = `
    <div class="cypher-roll-card">
      <h3>${flavor || game.i18n.localize("CYPHER.Roll.Task")}</h3>
      ${abilitySource ? `<p class="cypher-weapon-ability">${foundry.utils.escapeHTML(abilitySource.name)}${targetActor ? ` — ${foundry.utils.escapeHTML(targetActor.name)}` : ""}</p>` : ""}
      ${weaponTimingNote}
      <p>${statLabel} —
         ${game.i18n.localize("CYPHER.Roll.Difficulty")} ${difficulty}
         (${game.i18n.localize("CYPHER.Roll.Effective")}: ${effectiveDifficulty}) —
         ${game.i18n.localize("CYPHER.Roll.Target")}: ${effectiveDifficulty <= 0 ? game.i18n.localize("CYPHER.Roll.Routine") : targetNumber}</p>
      ${effortLevels ? `<p>${game.i18n.localize("CYPHER.Roll.EffortSpent")}: ${effortLevels} (${totalCost} ${game.i18n.localize("CYPHER.Roll.PoolPoints")})</p>` : ""}
      ${woundHinder ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.WoundHinder", { steps: woundHinder })}</p>` : ""}
      ${extraHinderSteps ? `<p class="cypher-hindered">${game.i18n.format("CYPHER.Roll.ExtraHinder", { steps: extraHinderSteps })}</p>` : ""}
      ${weaponRangeAdjudication?.atExtremeRange ? `<p class="cypher-hindered">${game.i18n.localize("CYPHER.Roll.ExtremeRangeHinder")}</p>` : ""}
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

  return messageFlavor;
}
