/** Final source chapters. Credits also own the document's front-matter title. */
export const FINAL_CHAPTERS = [
  { key: "rules-of-the-game", title: "Rules of the Game", start: 7381, end: 7985 },
  { key: "advancing-your-character", title: "Advancing Your Character", start: 7986, end: 8179 },
  { key: "credits", title: "Credits", start: 8180, end: 8201 }
];
export const FINAL_JOURNAL_IDS = FINAL_CHAPTERS.map(chapter => `journal.crd-${chapter.key}`);
