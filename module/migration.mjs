/**
 * World migration entry point reserved for future persisted-data migrations.
 *
 * The current 0.2.0-alpha.1 baseline does not require a world migration:
 * there are no supported pre-alpha worlds whose persisted data must be
 * transformed. Keep this function deliberately empty until a real migration
 * requirement exists; DataModel-level migrateData hooks remain independent.
 *
 * @returns {Promise<void>} Resolves without modifying the world.
 */
export async function migrateWorld() {
  // Intentionally empty for the current alpha baseline.
}
