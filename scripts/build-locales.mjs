/**
 * Compile domain-owned dictionaries into the two native Foundry locale files.
 * --check is read-only and is used by tests/CI to reject stale runtime artifacts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { flattenLocale, mergeLocaleFragments, missingLiteralKeys, parseLocale, validateLocalePair } from "./localization/locales.mjs";
import { CYPHER } from "../module/config.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

/** Audit finite dynamic namespaces and actual literal callers in this checkout. */
async function runtimeKeyErrors(root, dictionary) {
  const errors = [];
  const keys = flattenLocale(dictionary);
  const families = {
    "CYPHER.Stat": CYPHER.stats,
    "CYPHER.SkillLevel": Object.keys(CYPHER.skillLevels),
    "CYPHER.Wound": CYPHER.woundSeverities,
    "CYPHER.Recovery": CYPHER.recoveryIntervals,
    "CYPHER.Genre": CYPHER.genres,
    "CYPHER.PowerShift": CYPHER.powerShiftCategories,
    "CYPHER.PowerShiftDescription": CYPHER.powerShiftCategories,
    "CYPHER.WeaponFamily": CYPHER.weaponFamilies,
    "CYPHER.AttackSkill": CYPHER.attackSkillCategories,
    "CYPHER.AttackType": CYPHER.weaponCategories,
    "CYPHER.Attack.Configuration": ["primary", "alternate"],
    "CYPHER.Type.WeaponCategory": CYPHER.weaponCategories,
    "CYPHER.Type.ArmorCategory": CYPHER.weaponCategories
  };
  for (const [prefix, values] of Object.entries(families)) {
    for (const value of values) if (!Object.hasOwn(keys, `${prefix}.${value}`)) errors.push(`Missing dynamic key ${prefix}.${value}.`);
  }
  const files = ["cypher.mjs"];
  for (const directory of ["module", "templates"]) {
    files.push(...(await fs.readdir(path.join(root, directory), { recursive: true }))
      .filter(file => /\.(?:mjs|hbs)$/.test(file)).map(file => path.join(directory, file)));
  }
  for (const file of files) {
    for (const key of missingLiteralKeys(await fs.readFile(path.join(root, file), "utf8"), dictionary)) errors.push(`${file}: missing ${key}.`);
  }
  return errors;
}

/** Read a language's fragments; filename equality also keeps domain ownership paired. */
export async function readLocaleSources(root, language) {
  const directory = path.join(root, "lang", "src", language);
  const names = (await fs.readdir(directory)).filter(name => name.endsWith(".json")).sort();
  const fragments = await Promise.all(names.map(async name => ({ name,
    value: parseLocale(await fs.readFile(path.join(directory, name), "utf8"), `${language}/${name}`)
  })));
  return { names, dictionary: mergeLocaleFragments(fragments) };
}

/**
 * Validate before writing either language so a rejected edit cannot leave half a pair.
 * @param {string} root Checkout to inspect or compile.
 * @param {{check?: boolean}} options Read-only verification when check is true.
 * @returns {Promise<object>} Compiled dictionaries for integration checks.
 */
export async function buildLocales(root = ROOT, { check = false } = {}) {
  const [en, fr] = await Promise.all([readLocaleSources(root, "en"), readLocaleSources(root, "fr")]);
  const errors = validateLocalePair(en.dictionary, fr.dictionary);
  errors.push(...await runtimeKeyErrors(root, en.dictionary));
  if (en.names.join("\n") !== fr.names.join("\n")) errors.push("EN/FR domain filenames differ.");
  // Check each domain too: moving just one translation to another domain hides
  // ownership drift even if the final combined dictionaries still match.
  for (const name of en.names) {
    if (!fr.names.includes(name)) continue;
    const [english, french] = await Promise.all(["en", "fr"].map(async language =>
      parseLocale(await fs.readFile(path.join(root, "lang/src", language, name), "utf8"), `${language}/${name}`)));
    errors.push(...validateLocalePair(english, french).map(error => `${name}: ${error}`));
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const dictionaries = { en: en.dictionary, fr: fr.dictionary };
  for (const [language, dictionary] of Object.entries(dictionaries)) {
    const file = path.join(root, "lang", `${language}.json`);
    const text = JSON.stringify(dictionary, null, 2) + "\n";
    if (check) {
      if ((await fs.readFile(file, "utf8")).replaceAll("\r\n", "\n") !== text) {
        throw new Error(`${language}.json is stale. Edit lang/src and run npm run build:lang.`);
      }
    } else await fs.writeFile(file, text, "utf8");
  }
  return dictionaries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await buildLocales(ROOT, { check: process.argv.includes("--check") });
    console.log(process.argv.includes("--check") ? "UI locale sources and runtime bundles match." : "Native Foundry locale bundles compiled.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
