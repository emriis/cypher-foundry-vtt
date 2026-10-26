/** Common cypher dialogs collect explicit choices; lifecycle services validate and persist them. */
import { cypherInventoryDisplay, discardCyphers, setCypherStash, setCypherForm, transferCypher, reconcileCypherTransfer } from "../applications/cypher-inventory-service.mjs";
import { cypherSourceChoices, drawCypher, acquireCypher, reconcileCypherAward } from "../applications/cypher-generation-service.mjs";
const label = key => game.i18n.localize(`CYPHER.CypherLife.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
const select = (name, key, choices) => `<label>${label(key)}<select name="${name}">${choices.map(([value, text]) => `<option value="${escape(value)}">${escape(text)}</option>`).join("")}</select></label>`;
const prompt = (key, content, read) => foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label(key) }, content,
  ok: { callback: (_event, button) => read(button.form) } });
const confirm = (key, content = "") => foundry.applications.api.DialogV2.confirm({ rejectClose: false, window: { title: label(key) }, content: `<p>${label("confirm")}</p>${content}` });
const warn = result => { if (!result) ui.notifications.warn(label("unavailable")); };

/** Generation previews are ephemeral. Cancelling the final award never changes inventory or a source. */
export async function promptCypherAward(_event, target) {
  if (!game.user.isGM) return;
  const random = target.dataset.action === "generateCypher";
  const input = await prompt("award", select("language", "language", [["en", "English"], ["fr", "Français"]])
    + (random ? select("table", "table", ["subtle", "manifest", "superhero"].map(key => [key, label(key)])) + `<p>${label("superheroHint")}</p>` : ""),
  form => ({ language: form.elements.language.value, table: form.elements.table?.value }));
  if (!input) return;
  let offer;
  if (random) offer = await drawCypher(input.table, { language: input.language, superheroConfirmed: input.table === "superhero" });
  else {
    const sources = await cypherSourceChoices(input.language);
    const uuid = await prompt("award", select("source", "source", sources.map(source => [source.uuid, source.name])), form => form.elements.source.value);
    offer = sources.find(source => source.uuid === uuid);
  }
  if (!offer) return;
  const source = await fromUuid(offer.uuid);
  if (!source || source.type !== "cypher") return;
  const boosts = source.system.cypherCategory === "powerBoost";
  const powers = source.system.powerLevels?.length ? source.system.powerLevels : [source.system.powerLevel].filter(Boolean);
  const details = `<p>${escape(source.name)}</p><p>${label("effectsDeferred")}</p>`
    + (offer.rolls?.length ? `<p>${offer.rolls.map(roll => `${label(roll.table)}: ${roll.value}`).join(" · ")}</p>` : "")
    + (offer.power ? `<p>${label(offer.power)}</p>` : powers.length ? select("power", "power", powers.map(key => [key, label(key)])) : "")
    + (boosts ? select("form", "form", ["subtle", "manifest"].map(key => [key, label(key)])) : "");
  const choice = await prompt("confirmAward", details, form => ({ power: offer.power ?? form.elements.power?.value ?? null, form: form.elements.form?.value ?? null }));
  if (!choice) return;
  warn(await acquireCypher(this.actor, offer.uuid, { ...choice, requestId: foundry.utils.randomID(), confirmed: true, rolls: offer.rolls ?? [] }));
}

/** Discard any selected live cyphers in one action, regardless of their form. */
export async function promptCypherDiscard() {
  const choices = cypherInventoryDisplay(this.actor).items.filter(item => item.canDiscard);
  if (!choices.length) return;
  const ids = await prompt("discard", `<p>${label("discardHint")}</p>${choices.map(item => `<label><input type="checkbox" name="cypher" value="${escape(item.id)}"/>${escape(item.name)}</label>`).join("")}`,
    form => Array.from(form.querySelectorAll('input[name="cypher"]:checked')).map(input => input.value));
  if (ids?.length) warn(await discardCyphers(this.actor, ids, { confirmed: true }));
}

/** Physical custody always uses the selected actual Actor, including targeted unlinked tokens. */
export async function promptCypherCustody(_event, target) {
  const item = this.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);
  if (!item) return;
  switch (target.dataset.action) {
    case "stashCypher": {
      const location = await prompt("stash", `<label>${label("location")}<input name="location" required/></label>`, form => form.elements.location.value.trim());
      if (location) warn(await setCypherStash(item, { stashed: true, location, confirmed: true })); break;
    }
    case "retrieveCypher":
      if (await confirm("retrieve", `<p>${escape(item.flags?.cypher?.stashLocation)}</p>`)) warn(await setCypherStash(item, { stashed: false, confirmed: true })); break;
    case "formCypher": {
      const form = await prompt("form", select("form", "form", ["subtle", "manifest"].map(key => [key, label(key)])), form => form.elements.form.value);
      if (form) warn(await setCypherForm(item, form)); break;
    }
    case "transferCypher": {
      const candidates = [...(game.actors?.contents ?? []), ...Array.from(game.user.targets ?? []).map(token => token.actor)].filter(actor => actor?.type === "pc" && actor.isOwner && actor.uuid !== this.actor.uuid);
      const choices = [...new Map(candidates.map(actor => [actor.uuid, actor])).values()];
      if (!choices.length) { warn(false); return; }
      const uuid = await prompt("transfer", `<p>${label("transferHint")}</p>` + select("destination", "destination", choices.map(actor => [actor.uuid, actor.name])), form => form.elements.destination.value);
      const destination = choices.find(actor => actor.uuid === uuid);
      if (destination) warn(await transferCypher(item, destination, { confirmed: true })); break;
    }
    case "reconcileCypherTransfer": {
      const input = await prompt("reconcile", `<p>${label("reconcileHint")}</p>` + select("state", "transferResult", [["transferred", label("transferred")], ["carried", label("carried")]])
        + `<label>${label("note")}<input name="note" required/></label>`, form => ({ transferred: form.elements.state.value === "transferred", note: form.elements.note.value.trim() }));
      if (input?.note) warn(await reconcileCypherTransfer(item, input)); break;
    }
  }
}

/** Resolve an uncertain award only after the GM has inspected/corrected the actual inventory. */
export async function promptCypherReconciliation(_event, target) {
  const note = await prompt("reconcile", `<p>${label("reconcileHint")}</p><label>${label("note")}<input name="note" required/></label>`, form => form.elements.note.value.trim());
  if (note) warn(await reconcileCypherAward(this.actor, target.dataset.acquisitionId, { confirmed: true, note }));
}
