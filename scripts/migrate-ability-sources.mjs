/**
 * Migrates embedded Type/Focus abilities into standalone ability compendium
 * sources.
 *
 * The migration is deterministic. English definitions and structured mechanics
 * distinguish source variants; localized prose does not determine pairing.
 * Focus prerequisites become flowchart edges.
 *
 * Run with: npm run migrate:packs
 */
import { pathToFileURL } from "node:url";
import { normalizeDescriptorSources, normalizeTypeSources, normalizeFocusSources, normalizeEquipmentSources } from "./source-migration/normalization.mjs";
import { pruneAbilityArtifacts, pruneAbilityReferences, mergeGenreAbilities } from "./source-migration/cleanup.mjs";
import { collectEnglishRegistry, collectStandaloneEnglishLogicalIds, migrateLanguage } from "./source-migration/registry.mjs";


/**
 * Normalize editable compendium sources in this checkout, including EN/FR pairs.
 * The order matters: prune broken references, establish English identities,
 * resolve French counterparts, then normalize the other content families.
 * This rewrites JSON sources and may rebuild legacy Ability source directories;
 * validation callers must run it in their temporary checkout.
 * @returns {Promise<void>} Resolves after all source writes; errors propagate.
 */
export async function migrateAbilitySources() {
  const removedAbilityIds = await pruneAbilityArtifacts();
  await pruneAbilityReferences(removedAbilityIds);
  await mergeGenreAbilities();
  const english = await collectEnglishRegistry();
  let englishLogicalIds = await collectStandaloneEnglishLogicalIds();
  await migrateLanguage("en", english, englishLogicalIds);
  englishLogicalIds = await collectStandaloneEnglishLogicalIds();
  await migrateLanguage("fr", english, englishLogicalIds);
  const finalRemovedAbilityIds = await pruneAbilityArtifacts();
  await pruneAbilityReferences(finalRemovedAbilityIds);
  await normalizeDescriptorSources();
  await normalizeTypeSources();
  await normalizeFocusSources();
  await normalizeEquipmentSources();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrateAbilitySources();
  console.log("Standalone ability sources migrated.");
}
