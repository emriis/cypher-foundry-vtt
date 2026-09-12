const { StringField, NumberField, HTMLField, BooleanField } = foundry.data.fields;

export default class CypherAttackData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      attackType: new StringField({ required: true, initial: "light", choices: ["light", "medium", "heavy"] }),
      range: new StringField({ required: true, initial: "immediate", choices: ["immediate", "short", "long"] }),
      damage: new NumberField({ required: true, integer: true, initial: 2, min: 0 }),
      stat: new StringField({ required: true, initial: "might", choices: ["might", "speed"] }),
      // Le personnage peut-il utiliser cette arme sans handicap ? (déterminé par son Type,
      // ou par l'avancement "Autre : Armes"). Décoché par défaut pour les armes moyennes/lourdes
      // en Monde Réel — voir le rappel de genre dans l'en-tête de la fiche.
      // Can the character use this weapon without penalty? (determined by their Type, or by
      // the "Other: Weapons" advancement). Unchecked by default for Real World medium/heavy weapons.
      freelyUsable: new BooleanField({ required: true, initial: true }),
      equipped: new BooleanField({ required: true, initial: false }),
      description: new HTMLField({ required: true, blank: true })
    };
  }
}
