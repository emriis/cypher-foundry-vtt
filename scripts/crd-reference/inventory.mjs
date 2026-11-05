/** Keep the reviewed pre-library catalogue baseline separate from additive
 * reference chapters. New source batches must extend the explicit ID inventory.
 */
import { CHAPTER_IDS } from "./creation-chapters.mjs";

export const EXPECTED_CATALOGUE_COUNT = 1373 + CHAPTER_IDS.length;
export const REFERENCE_JOURNAL_IDS = [...CHAPTER_IDS];
