/** Source-locked chapter boundaries shared by authoring and editorial navigation. */
export const GENRE_CHAPTERS = [
  { key: "real-world", start: 457, end: 617, title: "The Real World Genre" },
  { key: "genre-abilities", start: 618, end: 641, title: "Genre Character Abilities from Types and Foci" },
  { key: "fantasy", start: 642, end: 1857, title: "Fantasy Genre" },
  { key: "science-fiction", start: 1858, end: 2906, title: "Science Fiction Genre" },
  { key: "superheroes", start: 2907, end: 3437, title: "Superheroes Genre" }
];
export const GENRE_JOURNAL_IDS = GENRE_CHAPTERS.map(chapter => `journal.crd-${chapter.key}`);
