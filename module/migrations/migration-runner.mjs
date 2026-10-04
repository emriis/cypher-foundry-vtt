import { migrateActor } from "./actor-schema-migrations.mjs";
import { migrateWorldTypeAndFocusAbilities } from "./legacy-content-migrations.mjs";

/**
 * Run all pending world migrations.
 *
 * This module owns migration orchestration and Foundry lifecycle concerns.
 * Individual schema/content transformations live in dedicated migration
 * modules so they can evolve independently and be tested in isolation.
 *
 * @returns {Promise<void>}
 */
export async function migrateWorld() {
  if (!game.user.isGM) return;

  await migrateWorldTypeAndFocusAbilities();

  const currentVersion = game.settings.get("cypher", "schemaVersion") ?? "0.0.0";
  const needsVersion = game.system.flags?.needsMigrationVersion;
  const compatibleVersion = game.system.flags?.compatibleMigrationVersion;

  if (!needsVersion || !foundry.utils.isNewerVersion(needsVersion, currentVersion)) {
    return;
  }

  if (
    compatibleVersion &&
    foundry.utils.isNewerVersion(compatibleVersion, currentVersion)
  ) {
    ui.notifications.error(
      game.i18n.format("CYPHER.Migration.TooOld", { version: currentVersion }),
      { permanent: true }
    );
    return;
  }

  ui.notifications.info(
    game.i18n.format("CYPHER.Migration.Begin", { version: needsVersion }),
    { permanent: true }
  );

  for (const actor of game.actors) {
    try {
      await migrateActor(actor, needsVersion);
    } catch (err) {
      console.error(
        `Cypher | Actor migration failed for ${actor.name}`,
        err
      );
    }
  }

  for (const pack of game.packs) {
    if (pack.locked || !["Actor", "Item"].includes(pack.documentName)) continue;

    const documents = await pack.getDocuments();

    for (const doc of documents) {
      try {
        if (doc.documentName === "Actor") {
          await migrateActor(doc, needsVersion);
        }
      } catch (err) {
        console.error(
          `Cypher | Migration failed for ${doc.name} (${pack.collection})`,
          err
        );
      }
    }
  }

  await game.settings.set("cypher", "schemaVersion", needsVersion);
  ui.notifications.info(
    game.i18n.format("CYPHER.Migration.Complete", { version: needsVersion }),
    { permanent: true }
  );
}
