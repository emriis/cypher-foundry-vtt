/**
 * Public migration entry point retained for compatibility.
 *
 * The orchestration logic now lives in `migrations/migration-runner.mjs`.
 * Keeping this module as a small facade avoids changing the Foundry bootstrap
 * import while giving future migrations a clear home.
 */
export { migrateWorld } from "./migrations/migration-runner.mjs";
