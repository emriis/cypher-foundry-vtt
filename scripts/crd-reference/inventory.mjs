/** Keep the reviewed pre-library catalogue baseline separate from additive
 * reference chapters. New source batches must extend the explicit ID inventory.
 */
import { CHAPTER_IDS } from "./creation-chapters.mjs";
import { GENRE_JOURNAL_IDS } from "./genre-metadata.mjs";
import { DETAIL_JOURNAL_IDS } from "./detail-metadata.mjs";
import { CYPHER_JOURNAL_IDS } from "./cypher-metadata.mjs";
import { FINAL_JOURNAL_IDS } from "./final-metadata.mjs";
import { PLAYER_JOURNAL_IDS } from "../library-player-metadata.mjs";

export const REFERENCE_JOURNAL_IDS = [...CHAPTER_IDS, ...GENRE_JOURNAL_IDS, ...DETAIL_JOURNAL_IDS, ...CYPHER_JOURNAL_IDS, ...FINAL_JOURNAL_IDS];
export const EXPECTED_CATALOGUE_COUNT = 1373 + REFERENCE_JOURNAL_IDS.length + PLAYER_JOURNAL_IDS.length;
