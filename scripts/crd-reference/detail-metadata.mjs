/** Locked source boundaries for library tranche 2C. */
export const DETAIL_CHAPTERS = [
  { key: "foci", title: "Foci", start: 3438, end: 5229 },
  { key: "equipment", title: "Equipment", start: 5230, end: 5952 }
];
export const DETAIL_JOURNAL_IDS = DETAIL_CHAPTERS.map(chapter => `journal.crd-${chapter.key}`);
