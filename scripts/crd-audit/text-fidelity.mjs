/**
 * Compare source-facing text with explicit CRD passages. Formatting whitespace
 * is ignored; punctuation, words, numbers, and named entry boundaries are not.
 * Search hints never establish fidelity: a contained fragment may be incomplete
 * or accidentally contain the next entry. Full Ability passages are checked too.
 */
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const referenceIndexes = new WeakMap();

/** Decode authored HTML for comparison without rewriting the stored source. */
export function plainText(value = "") {
  return String(value).replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|table|thead|tbody|tr|td|th|br)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
      if (entity.startsWith("#")) {
        const code = entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return String.fromCodePoint(code);
      }
      return ENTITIES[entity.toLowerCase()];
    }).replace(/\s+/gu, " ").trim();
}

/**
 * Reconstruct a reviewed field from explicit CRD paragraph selections. A label
 * may move to an Item/effect name, but omitted prose cannot be justified by a
 * stored hash. Each segment is reread from the actual supplied reference.
 */
export function reviewedPassage(source, paragraphs) {
  const segments = source.segments ?? source.ranges?.map(([start, end]) => ({ start, end }));
  if (!segments?.length) return null;
  const parts = segments.map(segment => {
    const text = paragraphs.filter(paragraph => paragraph.index >= segment.start && paragraph.index <= segment.end)
      .map(paragraph => plainText(paragraph.text)).filter(Boolean).join(" ");
    return segment.stripLeadingLabel ? text.slice(text.indexOf(":") + 1).trim() : text;
  });
  return { text: parts.join(" "), start: source.start, end: source.end, section: source.section };
}

/** Matching hint only. Curly quotes and dashes must still match in the result. */
export function searchText(value) {
  return plainText(value).replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—‑]/g, "-");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract whole named Ability occurrences, excluding neighbouring abilities,
 * headings, and GM callouts. Cost/name headers are represented in separate Item
 * fields. Different CRD occurrences remain separate candidates for review.
 */
export function abilityPassages(name, paragraphs, abilityNames) {
  const header = new RegExp(`^${escapeRegex(searchText(name))}(?: \\([^:]*\\))?:\\s*`, "i");
  const names = abilityNames.filter(value => value !== "Effort" && !/GM intrusions?/i.test(value));
  const nextAbility = new RegExp(`^(?:${names.map(value => escapeRegex(searchText(value))).join("|")})(?: \\([^:]*\\))?:`, "i");
  const result = [];
  for (const [index, paragraph] of paragraphs.entries()) {
    const match = header.exec(searchText(paragraph.text));
    if (!match) continue;
    const parts = [plainText(paragraph.text).slice(match[0].length)];
    let lastIndex = paragraph.index;
    for (const next of paragraphs.slice(index + 1)) {
      const text = plainText(next.text);
      if (!text) continue;
      const label = plainText(next.leadingLabel);
      const isBody = ["BodyText", "FirstParagraph"].includes(next.style);
      // An unknown costed header can reveal an Ability swallowed by extraction.
      // Uncosted sub-options such as Heavy Throw remain inside their parent.
      const otherNamedEntry = isBody && /\([^)]*\)$/.test(label)
        && text.startsWith(`${label}:`);
      if (/^(?:Heading|TypeHeaders|H2)/.test(next.style)
        || /GM intrusions?:/i.test(text) || (isBody && nextAbility.test(searchText(text))) || otherNamedEntry) break;
      parts.push(text);
      lastIndex = next.index;
    }
    result.push({ text: parts.join(" "), start: paragraph.index, end: lastIndex,
      section: paragraph.section, header: plainText(paragraph.text).slice(0, match[0].length).trim() });
  }
  return result;
}

/** Similarity identifies review candidates; it can never produce an exact pass. */
function similarity(left, right) {
  const words = text => new Set(searchText(text).split(/\s+/));
  const a = words(left), b = words(right);
  const shared = [...a].filter(word => b.has(word)).length;
  return 2 * shared / Math.max(1, a.size + b.size);
}

/** Classify a field, optionally against bounded source passages. Never guess a repair. */
export function compareText(value, paragraphs, passages = []) {
  const text = plainText(value);
  if (!text) return { status: "empty" };
  if (passages.length) {
    const exact = passages.filter(passage => plainText(passage.text) === text);
    if (exact.length) return { status: "exact-passage", locators: exact.map(({ start, end, section }) => ({ start, end, section })) };
    const typography = passages.filter(passage => searchText(passage.text) === searchText(text));
    if (typography.length) return { status: "punctuation-difference", candidates: typography };
    const ranked = passages.map(passage => ({ ...passage, similarity: similarity(text, passage.text) }))
      .sort((a, b) => b.similarity - a.similarity);
    return { status: "passage-difference", candidates: ranked.slice(0, 3) };
  }
  let reference = referenceIndexes.get(paragraphs);
  if (!reference) {
    let offset = 0;
    const spans = paragraphs.filter(paragraph => plainText(paragraph.text)).map(paragraph => {
      const text = plainText(paragraph.text);
      const start = offset;
      offset += text.length + 1;
      return { ...paragraph, text, start, end: offset - 1 };
    });
    const text = spans.map(span => span.text).join(" ");
    reference = { text, search: searchText(text), spans };
    referenceIndexes.set(paragraphs, reference);
  }
  const position = reference.text.indexOf(text);
  const foldedPosition = position < 0 ? reference.search.indexOf(searchText(text)) : position;
  if (foldedPosition >= 0) {
    const first = reference.spans.find(span => span.end > foldedPosition);
    const last = [...reference.spans].reverse().find(span => span.start < foldedPosition + text.length);
    const locator = { start: first.index, end: last.index, section: first.section };
    if (position >= 0) return { status: "exact-fragment", locators: [locator] };
    return { status: "punctuation-difference", candidates: [{ ...locator,
      text: reference.text.slice(foldedPosition, foldedPosition + text.length) }] };
  }
  // Multi-paragraph fields and tables need a reviewed section mapping. A global
  // substring match would incorrectly approve omitted headings or next entries.
  return { status: "needs-section-mapping" };
}
