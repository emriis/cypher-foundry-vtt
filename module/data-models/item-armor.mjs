const { StringField, HTMLField, BooleanField, NumberField } = foundry.data.fields;

export default class CypherArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Légère/Moyenne/Lourde : facilite le Blocage, handicape l'Esquive (voir CYPHER.armorCategories)
      // Light/Medium/Heavy: eases Block, hinders Dodge (see CYPHER.armorCategories)
      category: new StringField({ required: true, initial: "light", choices: ["light", "medium", "heavy"] }),
      // Le Type du personnage indique quelles armures il peut utiliser librement.
      // Sinon, le handicap d'esquive touche aussi toutes les tâches de Vitesse.
      // The character's Type says which armor categories they can freely use.
      // Otherwise, the dodge penalty also hinders all Speed tasks.
      freelyUsable: new BooleanField({ required: true, initial: false }),
      // Seule une armure Équipée à la fois est active sur le personnage.
      // Only one Equipped armor at a time is active on the character.
      equipped: new BooleanField({ required: true, initial: false }),
      // Dégâts subis par cette armure spécifique (attaque spéciale/intrusion MJ) — réduit
      // uniquement son bonus de Blocage, jamais son handicap d'Esquive.
      // Damage taken by this specific armor (special attack/GM intrusion) — reduces only
      // its Block bonus, never its Dodge hindrance.
      blockEaseDamage: new NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
