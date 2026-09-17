const { StringField, NumberField, HTMLField, ArrayField } = foundry.data.fields;

/**
 * A CRD Descriptor (e.g. "Compassionate", "Sneaky"...): a one-time trait package — a Pool
 * bonus and a choice of trained skill — that the player applies to their PC sheet by
 * dragging it there. This is deliberately NOT a persistent item on the actor: like a Type or
 * Focus, only its EFFECT (the Pool bonus + the created Skill item) remains on the sheet,
 * materialized through the PC's system.descriptor text field and the generated Skill item
 * (see CypherActor#applyDescriptor).
 */
export default class CypherDescriptorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Une ou deux stats au choix (ex. Gloomy : Vitesse OU Puissance). Si un seul élément,
      // aucun choix n'est proposé au moment de l'application.
      // One or two stat options to choose from (e.g. Gloomy: Speed OR Might). If only one
      // element, no choice is offered when applying.
      statOptions: new ArrayField(
        new StringField({ required: true, choices: ["might", "speed", "intellect"] }),
        { required: true, initial: ["intellect"] }
      ),
      statAmount: new NumberField({ required: true, integer: true, initial: 2, min: 1 }),

      // Noms de compétences au choix (2 à 4 en général). Une entrée "Autre (préciser)" est
      // toujours proposée en plus lors de l'application, pour couvrir les libellés du CRD
      // du type "ou similaire".
      // Skill names to choose from (usually 2 to 4). An "Other (specify)" entry is always
      // offered in addition when applying, to cover the CRD's "...or similar" phrasing.
      // blank:true pour permettre des emplacements de formulaire vides (voir le template de
      // fiche d'objet) ; les entrées vides sont filtrées par CypherActor#applyDescriptor.
      // blank:true to allow empty form slots (see the item sheet template); blank entries are
      // filtered out by CypherActor#applyDescriptor.
      skillOptions: new ArrayField(new StringField({ required: true, blank: true }), { required: true, initial: [] }),

      description: new HTMLField({ required: true, blank: true })
    };
  }
}
