/**
 * Assemble domain-owned UI dictionaries for Foundry's native locale loader.
 * Authoring collisions are errors: silently replacing a string loses information.
 * This module is Node tooling and never runs in the Foundry browser.
 */

/**
 * Read JSON without silently discarding repeated object member names.
 * JSON.parse checks syntax first; a small token walk then checks object membership
 * before duplicate names disappear from the parsed JavaScript object.
 * @param {string} text JSON authoring source, including arrays and scalar values.
 * @param {string} label Filename used in actionable diagnostics.
 * @returns {*} Parsed JSON with unique members at every object scope.
 */
export function parseUniqueJSON(text, label = "JSON") {
  const result = JSON.parse(text);
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  let position = 0;
  function visit(prefix) {
    const token = tokens[position++];
    if (token === "{") {
      const keys = new Set();
      while (tokens[position] !== "}") {
        const key = JSON.parse(tokens[position++]);
        const field = prefix ? `${prefix}.${key}` : key;
        if (keys.has(key)) throw new Error(`${label}: duplicate key ${field}.`);
        keys.add(key);
        position++; // Colon: syntax has already been checked by JSON.parse.
        visit(field);
        if (tokens[position] === ",") position++;
      }
      position++;
    } else if (token === "[") {
      let index = 0;
      while (tokens[position] !== "]") {
        visit(prefix ? `${prefix}.${index++}` : String(index++));
        if (tokens[position] === ",") position++;
      }
      position++;
    }
  }
  visit("");
  return result;
}

/** Read a locale's namespace objects and string leaves with explicit key guards. */
export function parseLocale(text, label = "locale") {
  const result = parseUniqueJSON(text, label);
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`${label}: locale root must be an object.`);
  }
  function validate(object, prefix) {
    for (const [key, value] of Object.entries(object)) {
      const field = prefix ? `${prefix}.${key}` : key;
      if (key.includes(".") || ["__proto__", "constructor", "prototype"].includes(key)) {
        throw new Error(`${label}: unsupported member name ${field}.`);
      }
      if (typeof value === "string") continue;
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`${label}: ${field} must be a string or a namespace object.`);
      }
      validate(value, field);
    }
  }
  validate(result, "");
  return result;
}

/** Return string leaves indexed by their stable Foundry localization key. */
export function flattenLocale(value, prefix = "") {
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => {
    const field = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[field, child]] : Object.entries(flattenLocale(child, field));
  }));
}

/** Merge domains, allowing shared namespaces but never duplicate leaf ownership. */
export function mergeLocaleFragments(fragments) {
  const result = {};
  function merge(target, source, prefix, owner) {
    for (const [key, value] of Object.entries(source)) {
      const field = prefix ? `${prefix}.${key}` : key;
      if (Object.hasOwn(target, key)) {
        if (typeof value === "string" || typeof target[key] === "string") {
          const kind = typeof value === typeof target[key] ? "duplicate" : "namespace conflict";
          throw new Error(`${owner}: ${kind} at ${field}.`);
        }
      } else target[key] = typeof value === "string" ? value : {};
      if (typeof value !== "string") merge(target[key], value, field, owner);
    }
  }
  for (const { name, value } of fragments) merge(result, value, "", name);
  function sorted(value) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key,
      typeof value[key] === "string" ? value[key] : sorted(value[key])]));
  }
  return sorted(result);
}

/** Report missing keys and changed interpolation contracts without modifying data. */
export function validateLocalePair(english, french) {
  const en = flattenLocale(english), fr = flattenLocale(french);
  const errors = [];
  const variables = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort().join(",");
  for (const [key, value] of Object.entries(en)) {
    if (!Object.hasOwn(fr, key)) errors.push(`French locale is missing ${key}.`);
    else if (variables(value) !== variables(fr[key])) errors.push(`${key}: interpolation variables differ.`);
  }
  for (const key of Object.keys(fr)) if (!Object.hasOwn(en, key)) errors.push(`French locale has unexpected key ${key}.`);
  for (const [language, entries] of [["en", en], ["fr", fr]]) {
    for (const [key, value] of Object.entries(entries)) {
      if (/\{\{|\}\}/.test(value)) errors.push(`${language}/${key}: variables must use single braces.`);
      if (!value.trim()) errors.push(`${language}/${key}: translation is empty.`);
    }
  }
  return errors;
}

/**
 * Check complete literal keys in runtime code and templates. Prefixes used to
 * construct enum keys are checked separately against their finite value sets.
 * This intentionally does not pretend to execute arbitrary JavaScript expressions.
 */
export function missingLiteralKeys(text, dictionary) {
  const keys = flattenLocale(dictionary);
  return [...new Set([...text.matchAll(/["']((?:CYPHER|TYPES)\.[\w.-]+)["']/g)]
    .map(match => match[1]).filter(key => !key.endsWith(".") && !Object.hasOwn(keys, key)))].sort();
}
