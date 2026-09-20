import { CYPHER } from "../config.mjs";

// Keep the label-to-fraction gap wide enough for checkbox placeholders while
// bounding it so a match cannot consume the following wound severity.
const WOUND_PATTERNS = {
  minor: /(?:minor|mineure?s?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i,
  moderate: /(?:moderate|mod[ée]r[ée]es?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i,
  major: /(?:major|majeures?)\s*:?[^\d]{0,120}?(\d+)\s*\/\s*(\d+)/i
};

/**
 * Parses wound values from a Character Builder export's free-form HTML notes.
 *
 * Each severity is parsed independently. A missing match falls back to the
 * configured default maximum for that severity.
 *
 * @param {string} notesHtml Raw notes HTML from the Character Builder export.
 * @returns {object} Parsed wound values keyed by severity.
 */
export function parseWoundsFromNotes(notesHtml) {
  const text = String(notesHtml ?? "").replace(/<[^>]+>/g, " ");
  const result = {};

  for (const severity of CYPHER.woundSeverities) {
    const match = text.match(WOUND_PATTERNS[severity]);
    if (match) {
      result[severity] = { current: Number(match[1]), max: Number(match[2]) };
    } else {
      result[severity] = { current: 0, max: CYPHER.defaultWoundMax[severity] };
      console.warn(`Cypher | Import : blessures "${severity}" introuvables dans les notes, repli sur ${CYPHER.defaultWoundMax[severity]}/0.`, notesHtml);
    }
  }

  return result;
}