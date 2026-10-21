/**
 * CRD glossary contract shared by UI checks and compendium editorial review.
 * Pure functions only: no mutation or translation inferred from English prose.
 */
import { flattenLocale } from "./locales.mjs";

export const GLOSSARY_STATUSES = ["confirmed", "established", "proposed"];

/**
 * Check a source-labelled editorial lexicon against the actual Foundry UI.
 * Exact UI bindings are unambiguous: narrative matches are intentionally not.
 */
export function validateGlossary(glossary, english, french) {
  const errors = [];
  if (glossary?.schemaVersion !== 1 || !Array.isArray(glossary?.entries)) {
    return ["Glossary must declare schemaVersion 1 and an entries array."];
  }
  const en = flattenLocale(english), fr = flattenLocale(french);
  const ids = new Set(), bindings = new Set();
  for (const entry of glossary.entries) {
    if (!entry || typeof entry !== "object" ||
        !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(entry.id ?? "")) {
      errors.push("Invalid glossary entry ID: " + String(entry?.id));
      continue;
    }
    if (ids.has(entry.id)) errors.push("Duplicate glossary entry: " + entry.id);
    ids.add(entry.id);
    if (!GLOSSARY_STATUSES.includes(entry.status)) errors.push(entry.id + ": invalid status.");
    for (const field of ["english", "french", "context"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) {
        errors.push(entry.id + ": missing " + field + ".");
      }
    }
    if (!Array.isArray(entry.uiBindings)) {
      errors.push(entry.id + ": uiBindings must be an array.");
      continue;
    }
    for (const key of entry.uiBindings) {
      if (typeof key !== "string" || !key.startsWith("CYPHER.") && !key.startsWith("TYPES.")) {
        errors.push(entry.id + ": invalid UI key " + String(key));
        continue;
      }
      if (bindings.has(key)) errors.push("UI glossary key has multiple owners: " + key);
      bindings.add(key);
      if (!Object.hasOwn(en, key)) errors.push(entry.id + ": missing English UI key " + key);
      if (!Object.hasOwn(fr, key)) errors.push(entry.id + ": missing French UI key " + key);
      else if (fr[key].normalize("NFC").toLocaleLowerCase("fr") !==
          entry.french.normalize("NFC").toLocaleLowerCase("fr")) {
        errors.push(entry.id + ": " + key + " must use glossary term " + entry.french +
          " (currently " + fr[key] + ").");
      }
    }
  }
  if (!glossary.entries.length) errors.push("Glossary contains no entries.");
  return errors;
}

/**
 * Signals for human inclusive-writing review, NOT automatic forbidden language:
 * CRD quotations, examples and chosen character genders must remain faithful.
 * HTML markup itself, technical IDs and field selectors are excluded.
 */
export function inclusiveStyleHints(value) {
  const text = String(value ?? "").replace(/<[^>]*>/gu, " ").replace(/@\w+\[[^\]]+\]/gu, " ");
  const hints = [];
  const patterns = [
    { id: "gendered-player-generic", expression: /\b(?:le joueur|un joueur|les joueurs|chaque joueur)\b/giu,
      recommendation: "Préférer « la personne qui joue », « les personnes participantes » ou une formulation avec « vous » selon le contexte." },
    { id: "gendered-pairing", expression: /\b(?:il ou elle|ils ou elles|celui ou celle|ceux ou celles)\b/giu,
      recommendation: "Privilégier une expression épicène sans modifier le sens de l’exemple." },
    { id: "gender-parentheses", expression: /\b\p{L}+\((?:e|ne|se|ère)\)s?\b/giu,
      recommendation: "Éviter les parenthèses binaires ; privilégier les termes épicènes, puis le point médian si nécessaire." }
  ];
  for (const { id, expression, recommendation } of patterns) {
    const matches = [...text.matchAll(expression)];
    if (matches.length) hints.push({ id, count: matches.length,
      examples: matches.slice(0, 2).map(match => match[0]), recommendation });
  }
  return hints;
}

/**
 * Mechanical false friends deserve explicit contextual attention, not global
 * search-and-replace. An Asset is Atout; Edge is Avantage. This check is
 * advisory for *proposed* text and never changes any authored translation.
 */
export function mechanicalTerminologyHints(value) {
  const text = String(value ?? "").replace(/<[^>]*>/gu, " ");
  const cases = [
    { id: "roll-advantage-ambiguity", pattern: /\b(?:avantage|désavantage)\s+(?:sur|aux?)\s+(?:jets?|lancers?)\b/giu,
      detail: "Vérifier : Edge=Avantage (coût de réserve), Asset=Atout, faciliter/entraver modifie la difficulté ; pas de jet à avantage type D&D." },
    { id: "effort-level-vs-cost", pattern: /\b(?:points?|niveaux?)\s+d['’]effort\b/giu,
      detail: "Vérifier la différence entre niveaux d’Effort appliqués et points réellement payés après Avantage." }
  ];
  return cases.flatMap(({ id, pattern, detail }) => {
    const matches = [...text.matchAll(pattern)];
    return matches.length ? [{ id, count: matches.length, examples: matches.slice(0, 2).map(m => m[0]), detail }] : [];
  });
}

/**
 * Emit an inventory for editorial decisions. Drafts are not approved by
 * regexes. Never reject a faithful quotation or shift a proposed status here.
 */
export function reviewFrenchStyle(proposals, { sampleLimit = 80 } = {}) {
  const summary = { proposals: 0, fields: 0, statuses: {}, styleFlags: {}, mechanicsFlags: {} };
  const findings = [];
  for (const [logicalId, { file, proposal }] of proposals) {
    summary.proposals++;
    summary.statuses[proposal.status] = (summary.statuses[proposal.status] ?? 0) + 1;
    for (const field of proposal.fields) {
      summary.fields++;
      const inclusive = inclusiveStyleHints(field.text);
      const mechanics = mechanicalTerminologyHints(field.text);
      for (const finding of inclusive) summary.styleFlags[finding.id] = (summary.styleFlags[finding.id] ?? 0) + finding.count;
      for (const finding of mechanics) summary.mechanicsFlags[finding.id] = (summary.mechanicsFlags[finding.id] ?? 0) + finding.count;
      if ((inclusive.length || mechanics.length) && findings.length < sampleLimit) {
        findings.push({ logicalId, file, field: field.path, status: proposal.status,
          inclusive, mechanics, requiresHumanReview: true });
      }
    }
  }
  return { summary, findings, findingsTruncated: findings.length >= sampleLimit,
    policy: "Review hints only, not editorial approval or semantic certification. Preserve CRD examples, identities and mechanics." };
}
