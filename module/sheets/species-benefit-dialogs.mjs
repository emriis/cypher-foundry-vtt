/** Explicit applicability and preparation controls for source-bound species gifts. */
import { speciesBenefitDisplay, prepareSpeciesBenefit, chooseBenefitEnergy, refreshSpeciesBenefits,
  appliedSpeciesSource, reviewConditionalTraining } from "../applications/species-benefit-service.mjs";
const label = key => game.i18n.localize(`CYPHER.Benefit.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const prompt = (key, content, read) => foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label(key) }, content,
  ok: { callback: (_event, button) => read(button.form.elements) } });
const warn = result => { if (result === false || result === null) ui.notifications.warn(label("unavailable")); };

/** Known mechanical facts apply automatically; checkboxes confirm only conditions that depend on the current fiction. */
export function speciesConditionFields(actor, { isAttack = false, defenseType = null } = {}) {
  const rules = speciesBenefitDisplay(actor).filter(rule => rule.kind === "damage" && isAttack
    || rule.kind === "asset" && (rule.condition === "shapedBody" || !isAttack && !defenseType)
    || rule.kind === "training" && !isAttack && !defenseType
    || rule.kind === "intrusionImmunity" && ["stealth", "athletics", "recognizingMotive"].includes(rule.condition) && !isAttack && !defenseType);
  return rules.length ? `<fieldset><legend>${label("conditions")}</legend><p>${label("conditionsHint")}</p>${rules.map(rule => `<label><input type="checkbox" name="benefit" value="${escape(rule.id)}" ${rule.preparationSeconds && rule.preparation?.state !== "ready" || rule.needsEnergy && !rule.value ? "disabled" : ""}/>${escape(rule.name)} — ${game.i18n.localize(rule.conditionLabel)} ${escape(rule.value || rule.preparation?.scope || "")}</label>`).join("")}</fieldset>` : "";
}

/** Preparation lasts ten game minutes and is completed only after an explicit uninterrupted-work declaration. */
export async function promptSpeciesBenefit(_event, target) {
  const id = target.dataset.benefitId, action = target.dataset.action;
  if (action === "refreshSpeciesBenefits") {
    const confirmed = await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label("refresh") }, content: `<p>${label("refreshHint")}</p>` });
    if (confirmed) {
      const result = await refreshSpeciesBenefits(this.actor, { confirmed: true });
      if (typeof result === "number") ui.notifications.info(game.i18n.format("CYPHER.Benefit.refreshed", { count: result }));
      else warn(result);
    } return;
  }
  if (action === "reviewConditionalTraining") {
    const source = await appliedSpeciesSource(this.actor); if (!source) { warn(false); return; }
    const skills = this.actor.items.filter(item => item.type === "skill");
    const input = await prompt("review", `<p>${label("reviewHint")}</p><p>${escape(source.name)}</p>
      <label>${label("skill")}<select name="skill">${skills.map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join("")}</select></label>
      <label>${label("baseTraining")}<select name="level">${["inability", "practiced", "trained", "specialized", "expert"].map(level => `<option value="${level}">${game.i18n.localize(`CYPHER.SkillLevel.${level}`)}</option>`).join("")}</select></label>
      <label>${label("note")}<input name="note" required/></label>`, fields => ({ skillId: fields.skill.value, baseLevel: fields.level.value, note: fields.note.value.trim() }));
    if (input?.note) warn(await reviewConditionalTraining(this.actor, input.skillId, source.uuid, { ...input, confirmed: true })); return;
  }
  const rule = speciesBenefitDisplay(this.actor).find(rule => rule.id === id); if (!rule) return;
  if (action === "chooseBenefitEnergy") {
    const value = await prompt("chooseEnergy", `<label>${label("chosenEnergy")}<input name="energy" value="${escape(rule.value)}" required/></label>`, fields => fields.energy.value.trim());
    if (value) warn(await chooseBenefitEnergy(this.actor, id, value)); return;
  }
  if (action === "prepareBenefit") {
    const scope = await prompt("prepare", `<p>${label("prepareHint")}</p><label>${label("scope")}<input name="scope" required/></label>`, fields => fields.scope.value.trim());
    if (scope) warn(await prepareSpeciesBenefit(this.actor, id, { scope, confirmed: true })); return;
  }
  if (action === "finishBenefit") {
    const confirmed = await foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label("finish") }, content: `<p>${label("finishHint")}</p>` });
    if (confirmed) warn(await prepareSpeciesBenefit(this.actor, id, { completed: true, confirmed: true }));
  }
}
