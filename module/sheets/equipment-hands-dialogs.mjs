/** Explicit hand/setup declarations. Services validate ownership, capacity and actual participants. */
import { equipmentItems, equipmentGrip, equipmentAttackProblem, handCapacity, configureEquipmentUse, setHandCapacity, minimumEquipmentHands } from "../applications/equipment-hands-service.mjs";

const label = key => game.i18n.localize(`CYPHER.EquipmentHands.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

/** Display current occupancy and unresolved prerequisites without writing during preparation. */
export function equipmentHandsDisplay(actor) {
  const entries = equipmentItems(actor).filter(item => ["attack", "shield", "equipment"].includes(item.type));
  return { capacity: handCapacity(actor), used: entries.reduce((sum, item) => { const use = equipmentGrip(item); return sum + (use?.held ? use.hands : 0); }, 0),
    items: entries.map(item => { const use = equipmentGrip(item); return { id: item.id, name: item.name,
      state: !use ? label("unknown") : use.held ? game.i18n.format("CYPHER.EquipmentHands.held", { hands: use.hands }) : label("carried"),
      problem: item.type === "attack" ? label(equipmentAttackProblem(item) ?? "ready") : "" }; }) };
}

/** Cancelled dialogs have no mutation. Zero hands explicitly declares an attack/object requiring no hands. */
export async function promptEquipmentUse(_event, target) {
  const actor = this.actor, item = actor.items.get(target.dataset.itemId);
  if (!item) return false;
  const use = equipmentGrip(item);
  const minimum = minimumEquipmentHands(item);
  const candidates = new Map([...(game.actors ?? []), ...(game.combat?.combatants?.contents ?? []).map(entry => entry.actor)]
    .filter(candidate => candidate && candidate.uuid !== actor.uuid && ["pc", "npc"].includes(candidate.type))
    .map(candidate => [candidate.uuid, candidate]));
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, position: { width: 560 },
    window: { title: label("configure") }, content: `<p>${escape(item.name)}</p><p>${label("hint")}</p>
      <div class="form-group"><label><input type="checkbox" name="held" ${use?.held !== false ? "checked" : ""}/>${label("hold")}</label></div>
      <div class="form-group"><label>${label("hands")}<input type="number" name="hands" min="0" step="1" required value="${use?.hands ?? Math.max(1, minimum)}"/></label></div>
      <p>${game.i18n.format("CYPHER.EquipmentHands.minimum", { hands: minimum })}</p>
      <p>${label("zeroHint")}</p>
      <div class="form-group"><label><input type="checkbox" name="deployed" ${use?.deployed ? "checked" : ""}/>${label("tripod")}</label></div>
      <div class="form-group"><label>${label("operators")}<select name="operators" multiple>
      ${[...candidates].map(([uuid, candidate]) => `<option value="${escape(uuid)}" ${use?.operators?.includes(uuid) ? "selected" : ""}>${escape(candidate.name)}</option>`).join("")}</select></label></div>
      <p>${label("crewHint")}</p>`,
    ok: { label: label("save"), callback: (_event, button) => {
      const fields = button.form.elements;
      return { held: fields.held.checked, hands: Number(fields.hands.value), deployed: fields.deployed.checked,
        operators: [...fields.operators.selectedOptions].map(option => option.value) };
    } } });
  if (!result) return false;
  const applied = await configureEquipmentUse(item, result);
  if (!applied) ui.notifications.warn(label("invalid"));
  return applied;
}

/** The GM may declare additional/fewer available hands without changing inventory or inferred species anatomy. */
export async function promptHandCapacity() {
  if (!game.user.isGM) return;
  const result = await foundry.applications.api.DialogV2.prompt({ rejectClose: false, window: { title: label("capacity") },
    content: `<label>${label("capacity")}<input type="number" name="capacity" min="0" step="1" value="${handCapacity(this.actor)}" required/></label>`,
    ok: { label: label("save"), callback: (_event, button) => Number(button.form.elements.capacity.value) } });
  if (result === null || result === undefined) return;
  if (!await setHandCapacity(this.actor, result)) ui.notifications.warn(label("handsFull"));
}

/** Ask for a missing/stowed grip before opening the attack's resource-choice dialog. */
export async function ensureEquipmentUse(sheet, item) {
  if (!equipmentGrip(item)?.held && !await promptEquipmentUse.call(sheet, null, { dataset: { itemId: item.id } })) return false;
  const problem = equipmentAttackProblem(item);
  if (problem) ui.notifications.warn(label(problem));
  return !problem;
}
