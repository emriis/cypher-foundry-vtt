/**
 * Inventory implemented consumers, not inferred rules. Each source Item gets a
 * conservative runtime assessment: accepting a field or posting prose to chat
 * is not the same as executing every mechanic described by the CRD.
 */
import { isStunstickHindrance } from "../../module/rules/weapon-effect-duration.mjs";

const WEAPON_FIELDS = {
  twoHanded: "equipment-hand state missing",
  requiresTripod: "deployment state missing",
  requiredOperators: "operator participation state missing"
};

/** Describe current application entrypoints and known gaps for one source Item. */
export function auditAutomation(document) {
  const system = document.system ?? {};
  const implemented = [], gaps = [];
  switch (document.type) {
    case "ability":
      if (system.key === "healing-hand") {
        implemented.push("healing-service/PC sheet: confirmed target, PC wound reduction/NPC Health, capacity, Edge, escalation and recovery reset");
      }
      if (["untamed-recovery", "mind-surge", "machine-not-flesh"].includes(system.key)) {
        implemented.push("recovery-service: source-bound daily extra action allowance, declared Pool/power restrictions");
      }
      if (["spray", "arc-spray"].includes(system.key)) {
        implemented.push("weapon-ability-service: costs, attacks, target damage; Spray tracked uses");
      }
      if ((system.effects ?? []).length) {
        implemented.push("ability-service: choose effect, charge base cost, post text");
        if (system.effects.some(effect => effect.endConditions?.length)) {
          implemented.push("ability-runtime-service: recovery expiration");
        }
        if (system.effects.some(effect => effect.modifiers?.length)) {
          implemented.push("ability-modifiers: explicit Pool maximum, Edge, wound capacity modifiers");
        }
        gaps.push("effect prose is not executed against targets");
      }
      if (system.rollTables?.length) implemented.push("ability-service: roll inline tables");
      for (const field of ["freeWeaponCategories", "freeArmorCategories", "freeWeaponFamilies", "freeWeaponSkillCategories"]) {
        if (system[field]?.length) implemented.push(`content-service: ${field} grant`);
      }
      if (system.chooseWeaponAttackCategory) implemented.push("content-service: choose attack category");
      if (system.grantedArmorItemCategory) implemented.push("content-service: create granted armor");
      if (!implemented.length) gaps.push("description and prerequisites available; no execution contract for this Ability");
      gaps.push("source-specific conditional effects and Effort options need individual contracts");
      break;
    case "type":
      implemented.push("content-service: Pool, Edge/wound capacity, familiar categories, referenced Abilities");
      gaps.push("referenced Ability automation inherits each Ability's limitations", "action economy and source-specific conditions are not fully modelled");
      break;
    case "focus":
      implemented.push("content-service: tier/prerequisite graph and referenced Ability grants");
      gaps.push("referenced Ability automation inherits each Ability's limitations");
      break;
    case "descriptor":
      implemented.push("content-service: Pool choice, skill training, species/descriptor selection guards");
      if (system.benefits?.some(benefit => benefit.passiveModifiers?.length)) {
        implemented.push("content-service/ability-modifiers: explicitly structured passive benefit modifiers");
      }
      if (system.benefits?.length) gaps.push("unstructured benefit clauses and conditional effects are not executed; individual execution contracts are required");
      break;
    case "skill":
      implemented.push("task/content services: selected skill modifier and advancement tier restrictions");
      gaps.push("GM/player identifies applicable task; special procedures/assets require explicit choices");
      break;
    case "attack":
      implemented.push("item/task services: familiarity, skill, damage, explicit range/one-handed adjudication, NPC persistence");
      if (system.mechanics?.cutsThroughMaterialsLevel != null) {
        implemented.push("object-service: physical material cutting threshold, attack roll, level damage, breaking/destruction and saved reroll correction");
        gaps.push("object material/tool compatibility is explicitly adjudicated; later target changes require manual reroll reconciliation");
      }
      for (const [field, limitation] of Object.entries(WEAPON_FIELDS)) {
        if (system.mechanics?.[field]) gaps.push(`${field}: ${limitation}`);
      }
      if (system.mechanics?.targetEffects?.length) {
        implemented.push("weapon-effect-service: level-gated NPC hindered/lose-next-action effects");
        if (system.mechanics.targetEffects.some(effect => effect.duration === "a round or two")) {
          implemented.push("weapon-effect-service/NPC sheet: one round by default, explicit GM extension to two");
        }
        if (system.mechanics.targetEffects.some(isStunstickHindrance)) {
          implemented.push("structured Stunstick hindrance: repeated hits keep two steps and the latest expiry");
        }
        gaps.push("NPC hindrance currently adjusts NPC attack level; other opposed tasks/passive defenses need contracts");
        gaps.push("additional effect kinds and target conditions need individual CRD contracts");
      }
      gaps.push("turn/action timing is presented but not enforced");
      break;
    case "armor":
    case "shield":
      implemented.push("equipment/damage services: equip, protection, damage/repair and hindrance");
      gaps.push("special note effects need explicit individual contracts");
      break;
    case "equipment":
      implemented.push("equipment-service: quantity/equipping/depletion tracking where declared");
      gaps.push("task assets, deployment, travel, environmental and special note effects are adjudicated");
      break;
    case "cypher":
      implemented.push("item-service: use/deplete");
      if (system.variants?.length) implemented.push("item-service: random variant resolution");
      if (system.rollTables?.length) implemented.push("item-service: inline table resolution");
      if (system.randomRange?.min != null) gaps.push("generation-table placement is stored, not a runtime effect roll");
      gaps.push("CRD power effect, targeting, duration and stat/damage consequences remain descriptive");
      break;
    default:
      implemented.push("Journal reference text");
      gaps.push("reference/navigation, not an executable rule document");
  }
  return { status: document.document === "JournalEntry" ? "reference" : "partial-or-adjudicated", implemented, gaps };
}
