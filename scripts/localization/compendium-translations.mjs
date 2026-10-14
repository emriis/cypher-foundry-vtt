/**
 * Guard French editorial proposals against their exact canonical English fields.
 * A proposal may only replace source-facing text, never a Pool cost, a formula,
 * a semantic duration, a reference, or another rule-bearing value.
 * Hashes establish freshness, not the quality or completeness of a translation:
 * conditions written in words still require an editorial review against the CRD.
 */
import { createHash } from "node:crypto";

/** Hash the exact UTF-8 authoring field, including markup and whitespace. */
export function sourceHash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Enumerate the explicitly supported display fields of a canonical document.
 * Array members use their stable scoped ID when present; legacy text-only arrays
 * use an ordinal, whose field hash detects changed ordering or changed contents.
 * Source identities, enum values and English reference locators stay canonical.
 * @param {object} document English normalized Item or JournalEntry.
 * @returns {Map<string,string>} Nonempty source-facing fields.
 */
export function translationFields(document) {
  const fields = new Map();
  function add(path, value) {
    if (typeof value === "string" && value.trim()) fields.set(path, value);
  }
  function entries(array, prefix, visit) {
    const selectors = new Set();
    for (const [index, entry] of (array ?? []).entries()) {
      const selector = entry?._id ?? entry?.id ?? index;
      if (!String(selector) || String(selector).includes(".")) throw new Error(`Unsupported scoped ID at ${prefix}: ${selector}`);
      if (selectors.has(String(selector))) throw new Error(`Duplicate scoped ID at ${prefix}: ${selector}`);
      selectors.add(String(selector));
      visit(entry, `${prefix}.${selector}`);
    }
  }
  add("name", document.name);
  add("system.description", document.system?.description);
  for (const key of ["properties", "skillOptions", "grantedSkills"]) {
    entries(document.system?.[key], `system.${key}`, (value, path) => add(path, value));
  }
  entries(document.system?.effects, "system.effects", (effect, prefix) => {
    for (const key of ["name", "description", "effort"]) add(`${prefix}.${key}`, effect[key]);
  });
  entries(document.system?.benefits, "system.benefits", (benefit, prefix) => {
    for (const key of ["name", "description"]) add(`${prefix}.${key}`, benefit[key]);
  });
  entries(document.system?.rollTables, "system.rollTables", (table, prefix) => {
    add(`${prefix}.name`, table.name);
    entries(table.results, `${prefix}.results`, (result, path) => add(`${path}.description`, result.description));
  });
  entries(document.system?.variants, "system.variants", (variant, prefix) => add(`${prefix}.name`, variant.name));
  entries(document.pages, "pages", (page, prefix) => {
    add(`${prefix}.name`, page.name);
    add(`${prefix}.text.content`, page.text?.content);
  });
  return fields;
}

/** Resolve a path without relying on a translated name or an array's sort order. */
export function fieldLocation(document, path) {
  const parts = path.split(".");
  let target = document;
  for (const [index, part] of parts.entries()) {
    const key = Array.isArray(target)
      ? target.findIndex((entry, ordinal) => String(entry?._id ?? entry?.id ?? ordinal) === part)
      : part;
    if (index === parts.length - 1) {
      if (!Object.hasOwn(target, key)) throw new Error(`Counterpart is missing ${path}.`);
      return { target, key };
    }
    target = target?.[key];
    if (target === undefined || target === null) throw new Error(`Counterpart is missing ${path}.`);
  }
}

/**
 * Compare typed rule data across languages after removing permitted display text.
 * A catalogue-aware UUID resolver compares logical source identities because
 * historical EN/FR counterparts can have different stable Foundry document IDs.
 * This does not change either document or infer mechanics from a name.
 */
export function mechanicalProjection(document, resolveReference = value => value) {
  const copy = structuredClone(document);
  for (const path of translationFields(copy).keys()) {
    const { target, key } = fieldLocation(copy, path);
    target[key] = "[localized text]";
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return typeof value === "string" ? resolveReference(value) : value;
  }
  return canonical({ type: copy.type ?? copy.document, system: copy.system ?? null,
    // Journal page structure and source formulas remain checked independently
    // of Foundry presentation metadata such as ownership, sorting and image paths.
    pages: copy.pages?.map(page => ({ type: page.type, text: page.text?.content })) ?? null });
}

/** Compare conservative tokens; these checks cannot prove prose semantics. */
export function translationSafetyErrors(source, translated, path) {
  const errors = [];
  const text = value => value.replace(/<[^>]*>/g, " ");
  function numbers(value, language) {
    const pattern = language === "en"
      ? /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g
      : /\d{1,3}(?:[\u00a0\u202f ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
    return (text(value).match(pattern) ?? []).map(token => {
      const normalized = language === "en" ? token.replaceAll(",", "") : token.replace(/[\u00a0\u202f ]/g, "").replace(",", ".");
      const [integer, fraction = ""] = normalized.split(".");
      const decimal = fraction.replace(/0+$/, "");
      return integer.replace(/^0+(?=\d)/, "") + (decimal ? `.${decimal}` : "");
    }).sort().join("|");
  }
  const markup = value => (value.match(/<[^>]*>/g) ?? []).join("");
  const references = value => (value.match(/@(?:UUID|Compendium)\[[^\]]*\]|\{[A-Za-z][A-Za-z0-9_]*\}/g) ?? []).sort().join("|");
  const dice = value => (value.match(/\b\d+d\d+(?:\s*[+−-]\s*\d+)?/gi) ?? []).map(value => value.replace(/\s/g, "")).sort().join("|");
  if (!translated.trim()) errors.push(`${path}: translation is empty.`);
  if (numbers(source, "en") !== numbers(translated, "fr")) errors.push(`${path}: numeric information differs.`);
  if (markup(source) !== markup(translated)) errors.push(`${path}: markup structure or attributes differ.`);
  if (references(source) !== references(translated)) errors.push(`${path}: references or variables differ.`);
  if (dice(source) !== dice(translated)) errors.push(`${path}: dice expressions differ.`);
  return errors;
}

/**
 * Validate a complete proposal and return a translated clone; never mutate inputs.
 * Stable IDs and mechanical fields come from the existing French counterpart.
 * Build callers must separately compare paired mechanical projections and resolve
 * localized skill labels consistently before materializing a whole catalogue.
 */
export function applyTranslation(english, french, proposal) {
  const logicalId = english.flags?.cypherFoundry?.crd?.logicalId;
  const counterpart = french.flags?.cypherFoundry?.crd;
  if (proposal.language !== "fr" || !["proposed", "reviewed"].includes(proposal.status)
      || proposal.logicalId !== logicalId || proposal.sourceLogicalId !== logicalId
      || counterpart?.language !== "fr" || (counterpart.sourceLogicalId ?? counterpart.logicalId) !== logicalId) {
    throw new Error(`Invalid translation identity or English/French counterpart for ${logicalId}.`);
  }
  const sources = translationFields(english);
  const seen = new Set();
  const changes = [];
  for (const field of proposal.fields ?? []) {
    if (!sources.has(field.path)) throw new Error(`${logicalId}: field is not translatable: ${field.path}.`);
    if (seen.has(field.path)) throw new Error(`${logicalId}: duplicate translated field ${field.path}.`);
    seen.add(field.path);
    if (field.sourceHash !== sourceHash(sources.get(field.path))) throw new Error(`${logicalId}: stale source at ${field.path}.`);
    if (typeof field.text !== "string") throw new Error(`${logicalId}: invalid translation at ${field.path}.`);
    const errors = translationSafetyErrors(sources.get(field.path), field.text, field.path);
    if (errors.length) throw new Error(`${logicalId}: ${errors.join(" ")}`);
    // Check every location before changing even the cloned document.
    fieldLocation(french, field.path);
    changes.push(field);
  }
  for (const path of sources.keys()) if (!seen.has(path)) throw new Error(`${logicalId}: missing translated field ${path}.`);
  const result = structuredClone(french);
  for (const { path, text } of changes) {
    const { target, key } = fieldLocation(result, path);
    target[key] = text;
  }
  return result;
}
