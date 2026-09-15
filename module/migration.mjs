/**
 * Schema migration support for persisted Cypher documents.
 *
 * Each actor and item can store the system version it was last migrated against
 * in `flags.cypher.schemaVersion`. Add a `migrateToX` step and invoke it from
 * `migrateWorld` whenever a schema change is incompatible with saved data.
 */

/**
 * Runs pending world migrations.
 *
 * This entry point is intended to be called from the Foundry `ready` hook and
 * performs migrations only when the current user is a Game Master.
 *
 * @returns {Promise<void>}
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
      console.error(`Cypher | Actor migration failed for ${actor.name}`, err);
    }
  }

  // Also migrate actors/items stored in unlocked compendium packs.
  for (const pack of game.packs) {
    if (pack.locked || !["Actor", "Item"].includes(pack.documentName)) continue;
    const documents = await pack.getDocuments();
    for (const doc of documents) {
      try {
        if (doc.documentName === "Actor") await migrateActor(doc);
      } catch (err) {
        console.error(`Cypher | Migration failed for ${doc.name} (${pack.collection})`, err);
      }
    }
  }

  await game.settings.set("cypher", "schemaVersion", needsVersion);
  ui.notifications.info(game.i18n.format("CYPHER.Migration.Complete", { version: needsVersion }), { permanent: true });
}

/**
 * Migrates one actor and records the current migration version.
 *
 * Keep concrete schema transformations in this function as the data model evolves.
 *
 * @param {Actor} actor Actor document to migrate.
 * @returns {Promise<void>}
 */
async function migrateActor(actor) {
  const updates = {};

  // Example future migration:
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
