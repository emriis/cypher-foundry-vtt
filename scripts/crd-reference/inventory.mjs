/** Keep the reviewed pre-library catalogue baseline separate from additive
 * reference chapters. New source batches must extend the explicit ID inventory.
 */
import { CHAPTER_IDS } from "./creation-chapters.mjs";
import { GENRE_JOURNAL_IDS } from "./genre-metadata.mjs";

export const REFERENCE_JOURNAL_IDS = [...CHAPTER_IDS, ...GENRE_JOURNAL_IDS];
export const EXPECTED_CATALOGUE_COUNT = 1373 + REFERENCE_JOURNAL_IDS.length;
