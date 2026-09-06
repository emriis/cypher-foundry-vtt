/**
 * Migrations de schéma — suit le modèle du système dnd5e : chaque acteur/objet stocke la
 * version du système avec laquelle il a été mis à jour pour la dernière fois (drapeau
 * `flags.cypher.schemaVersion`) ; si elle est antérieure à `needsMigrationVersion` (déclaré
 * dans system.json), on fait tourner les fonctions de migration correspondantes.
 *
 * Schema migrations — follows the dnd5e system's pattern: every actor/item stores the system
 * version it was last updated against (`flags.cypher.schemaVersion` flag); if it's older than
 * `needsMigrationVersion` (declared in system.json), the matching migration functions run.
 *
 * Ce fichier est un point de départ volontairement minimal : aucune migration concrète n'est
 * encore nécessaire (V1 du système, aucun monde existant). Ajoutez une fonction migrateToX()
 * et un appel dans migrateWorld() à chaque futur changement de schéma qui casse la
 * compatibilité avec des données déjà enregistrées.
 * This file is a deliberately minimal starting point: no concrete migration is needed yet
 * (system V1, no existing worlds). Add a migrateToX() function and a call in migrateWorld()
 * for every future schema change that breaks compatibility with already-saved data.
 */

/**
 * Lance la migration du monde si nécessaire. À appeler dans le hook "ready", MJ uniquement.
 * Runs world migration if needed. Call this in the "ready" hook, GM only.
 */
export async function migrateWorld() {
  if (!game.user.isGM) return;

  const currentVersion = game.settings.get("cypher", "schemaVersion") ?? "0.0.0";
  const needsVersion = game.system.flags?.needsMigrationVersion;
  const compatibleVersion = game.system.flags?.compatibleMigrationVersion;

  if (!needsVersion || !foundry.utils.isNewerVersion(needsVersion, currentVersion)) return;

  if (compatibleVersion && foundry.utils.isNewerVersion(compatibleVersion, currentVersion)) {
    ui.notifications.error(game.i18n.format("CYPHER.Migration.TooOld", { version: currentVersion }), { permanent: true });
    return;
  }

  ui.notifications.info(game.i18n.format("CYPHER.Migration.Begin", { version: needsVersion }), { permanent: true });

  for (const actor of game.actors) {
    try {
      await migrateActor(actor);
    } catch (err) {
      console.error(`Cypher | Échec de la migration de l'acteur ${actor.name}`, err);
    }
  }

  // Migre aussi les acteurs/objets à l'intérieur des compendiums non verrouillés
  // Also migrates actors/items inside unlocked compendium packs
  for (const pack of game.packs) {
    if (pack.locked || !["Actor", "Item"].includes(pack.documentName)) continue;
    const documents = await pack.getDocuments();
    for (const doc of documents) {
      try {
        if (doc.documentName === "Actor") await migrateActor(doc);
      } catch (err) {
        console.error(`Cypher | Échec de la migration de ${doc.name} (${pack.collection})`, err);
      }
    }
  }

  await game.settings.set("cypher", "schemaVersion", needsVersion);
  ui.notifications.info(game.i18n.format("CYPHER.Migration.Complete", { version: needsVersion }), { permanent: true });
}

/**
 * Migre un acteur individuel. Ajoutez vos appels de migration concrets ici.
 * Migrates a single actor. Add your concrete migration calls here.
 */
async function migrateActor(actor) {
  const updates = {};

  // Exemple de structure pour une future migration :
  // Example structure for a future migration:
  //
  // if (foundry.utils.isNewerVersion("0.2.0", actor.getFlag("cypher", "schemaVersion") ?? "0.0.0")) {
  //   updates["system.someOldField"] = undefined;
  //   updates["system.someNewField"] = actor.system.someOldField ?? defaultValue;
  // }

  if (Object.keys(updates).length) {
    updates["flags.cypher.schemaVersion"] = game.system.flags?.needsMigrationVersion;
    await actor.update(updates);
  } else {
    await actor.setFlag("cypher", "schemaVersion", game.system.flags?.needsMigrationVersion);
  }
}
