/** Sheets collect declarations; the upgrade service validates and settles actual document writes. */
import { installCompanionUpgrade, activateCompanionUpgrade, resumeCompanionUpgrade, endCompanionUpgrade,
  companionUpgradeDisplay, configureCompanionUpgrade } from "../applications/companion-upgrade-service.mjs";
import { followerDisplay } from "../applications/follower-service.mjs";
import { fireAutomatonTurret } from "../applications/companion-turret-service.mjs";
const text = key => game.i18n.localize(`CYPHER.CompanionUpgrade.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const options = entries => entries.map(([id, name]) => `<option value="${escape(id)}">${escape(name)}</option>`).join("");
const check = (name, key) => `<label><input type="checkbox" name="${name}"/>${text(key)}</label>`;
const result = accepted => { if (!accepted) ui.notifications.warn(text("unavailable")); };

/** Clock changes refresh effective capacity without writing timed bonuses into saved Actor data. */
export function refreshCompanionUpgradeSheets() {
  const actors = new Set([...(game.actors?.contents ?? []), ...(globalThis.canvas?.tokens?.placeables ?? []).map(token => token.actor)]);
  for (const actor of actors) {
    if (!actor?.flags?.cypher?.companionEffects) continue;
    for (const sheet of Object.values(actor.apps ?? {})) if (sheet.rendered) sheet.render().catch(error => console.error("Cypher | Companion display refresh failed", error));
  }
}

/** One permanent installation per source key; the GM chooses a synchronized automaton. */
export async function promptCompanionInstall() {
  const display = companionUpgradeDisplay(this.actor);
  const sources = display.offers.filter(offer => !offer.senses);
  const followers = (await followerDisplay(this.actor)).filter(follower => follower.sourceAbility?.family === "automaton" && !follower.pending);
  if (!sources.length || !followers.length) return result(false);
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("install") },
    content: `<p>${text("installHint")}</p><label>${text("ability")}<select name="ability">${options(sources.map(item => [item.id, item.name]))}</select></label>`
      + `<label>${text("automaton")}<select name="follower">${options(followers.map(item => [item.id, item.name]))}</select></label>`,
    ok: { callback: (_event, button) => ({ itemId: button.form.elements.ability.value, followerId: button.form.elements.follower.value }) } });
  if (input) result(await installCompanionUpgrade(this.actor, input.itemId, input.followerId, { confirmed: true }));
}

/** Targets and token identity come from actual selections, without measuring invented geometry. */
export async function promptCompanionUpgrade(_event, target) {
  const bindingId = target.dataset.bindingId ?? target.dataset.itemId;
  const targets = Array.from(game.user.targets ?? []).map(token => token.actor).filter(Boolean);
  const operators = [...new Map([this.actor, ...(game.actors?.contents ?? []).filter(actor => actor.type === "pc"), ...targets.filter(actor => actor.type === "pc")].map(actor => [actor.uuid, actor])).values()];
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("activate") },
    content: `<p>${text("activationHint")}</p><p>${text("fieldTargets")}: ${targets.map(actor => escape(actor.name)).join(", ") || text("none")}</p>`
      + check("immediate", "immediate") + check("withinRange", "withinRange")
      + `<label>${text("operator")}<select name="operator">${options(operators.map(actor => [actor.uuid, actor.name]))}</select></label>`
      + `<label>${text("visionToken")}<select name="visionToken">${options([["", text("narrative")], ...tokens.map(token => [token.document.uuid, token.name])])}</select></label>`,
    ok: { callback: (_event, button) => { const fields = button.form.elements; return { confirmed: true, immediate: fields.immediate.checked,
      withinRange: fields.withinRange.checked, operatorUuid: fields.operator.value, visionTokenUuid: fields.visionToken.value || null,
      targetUuids: targets.map(actor => actor.uuid) }; } } });
  if (input) result(await activateCompanionUpgrade(this.actor, bindingId, input));
}

export async function finishCompanionUpgrade(_event, target) { result(await resumeCompanionUpgrade(this.actor, target.dataset.effectId)); }
export async function stopCompanionUpgrade(_event, target) { result(await endCompanionUpgrade(this.actor, target.dataset.effectId)); }

/** Circumstances can suspend vision or slow flight without purchasing the same effect again. */
export async function promptCompanionUpgradeCircumstances(_event, target) {
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("circumstances") },
    content: check("carrying", "carrying") + check("withinRange", "withinRange") + check("immediate", "immediate"),
    ok: { callback: (_event, button) => ({ carrying: button.form.elements.carrying.checked, withinRange: button.form.elements.withinRange.checked, immediate: button.form.elements.immediate.checked }) } });
  if (input) result(await configureCompanionUpgrade(this.actor, { ...input, followerId: target.dataset.followerId, effectId: target.dataset.effectId,
    targetUuids: Array.from(game.user.targets ?? []).map(token => token.actor?.uuid).filter(Boolean) }));
}

/** An autonomous hit is adjudicated against NPCs; PCs use the existing wound/Pool defense pipeline. */
export async function promptAutomatonTurret(_event, button) {
  const target = game.user.targets?.size === 1 ? [...game.user.targets][0]?.actor : null;
  if (!["pc", "npc"].includes(target?.type)) return result(false);
  const input = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: text("fire") },
    content: `<p>${text("fireHint")}</p><p>${escape(target.name)}</p>` + check("inRange", "inRange") + check("hitConfirmed", "hitConfirmed")
      + `<label>${text("roundId")}<input name="roundId" type="text"/></label>`
      + (target.type === "pc" ? `<p>${text("pcDamageHint")}</p><label>${text("severity")}<select name="severity">${options(["minor", "moderate", "major"].map(severity => [severity, game.i18n.localize(`CYPHER.Wound.${severity}`)]))}</select></label>` : ""),
    ok: { callback: (_event, button) => { const fields = button.form.elements; return { confirmed: true, inRange: fields.inRange.checked,
      hitConfirmed: fields.hitConfirmed.checked, roundId: fields.roundId.value,
      pcAttack: target.type === "pc" ? { damage: { mode: "wound", severity: fields.severity.value, wounds: 1, stat: "might" } } : null }; } } });
  if (input) result(await fireAutomatonTurret(this.actor, button.dataset.effectId, { ...input, target }));
}
