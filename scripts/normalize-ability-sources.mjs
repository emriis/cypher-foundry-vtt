/**
 * Migrates embedded Type/Focus abilities into standalone ability documents.
 *
 * The migration reads only repository source data. It deliberately does not
 * fetch or infer rules text from external sources.
 */
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const PACKS = {
  en: { abilities: "abilities-en", types: "types-en", foci: "foci-en" },
  fr: { abilities: "abilities-fr", types: "types-fr", foci: "foci-fr" }
};

function stableId(value) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return (
    (h1 >>> 0).toString(36).padStart(7, "0") +
    (h2 >>> 0).toString(36).padStart(7, "0")
  ).slice(0, 16);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortObject(entry)])
  );
}

function mechanicalSignature(ability) {
  const intrinsic = { ...ability };
  delete intrinsic.id;
  delete intrinsic.name;
  delete intrinsic.prerequisites;
  delete intrinsic.description;
  return JSON.stringify(sortObject(intrinsic));
}

function inferAction(ability) {
  if (["action", "firstAction", "lastAction"].includes(ability.action)) {
    return ability.action;
  }

  // Mixed Enabler/action abilities are intentionally left for a future
  // special-case model rather than being reduced to a misleading action.
  if (ability.enabler) return null;

  const text = String(ability.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .trim();

  if (/First action\.?$/i.test(text)) return "firstAction";
  if (/Last action\.?$/i.test(text)) return "lastAction";
  if (/Action\.?$/i.test(text)) return "action";
  return null;
}

async function readDocuments(pack) {
  const directory = path.join(root, "packs", pack, "_source");
  const names = (await fs.readdir(directory))
    .filter(name => name.endsWith(".json"))
    .sort();

  return Promise.all(names.map(async name => ({
    name,
    data: JSON.parse(
      await fs.readFile(path.join(directory, name), "utf8")
    )
  })));
}

async function resetDirectory(directory) {
  await fs.rm(directory, { recursive: true, force: true });
  await fs.mkdir(directory, { recursive: true });
}

async function writeDocument(directory, filename, document) {
  await fs.writeFile(
    path.join(directory, filename),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8"
  );
}

function toAbilityDocument(ability, id, language) {
  return {
    _id: id,
    _key: `!items!${id}`,
    name: ability.name,
    type: "ability",
    img: "icons/svg/book.svg",
    system: {
      key: ability.id,
      tier: ability.tier,
      enabler: Boolean(ability.enabler),
      repeatable: Boolean(ability.repeatable),
      cost: ability.cost ?? { stat: "none", amount: 0, options: [] },
      action: inferAction(ability),
      source: language === "en" ? "CRD" : "CRD English fallback",
      freeWeaponCategories: ability.freeWeaponCategories ?? [],
      freeArmorCategories: ability.freeArmorCategories ?? [],
      freeWeaponFamilies: ability.freeWeaponFamilies ?? [],
      freeWeaponSkillCategories: ability.freeWeaponSkillCategories ?? [],
      chooseWeaponAttackCategory: Boolean(
        ability.chooseWeaponAttackCategory
      ),
      grantedArmorItemCategory: ability.grantedArmorItemCategory ?? "",
      effects: ability.effects ?? [],
      rollTables: ability.rollTables ?? [],
      description: ability.description ?? ""
    },
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {
      cypher: {
        sourceLicense:
          "Full text from the Cypher Reference Document (CRD), used under the Cypher Open License."
      }
    }
  };
}

async function collectCanonicalAbilities() {
  const documents = [
    ...(await readDocuments(PACKS.en.types)),
    ...(await readDocuments(PACKS.en.foci))
  ];

  const abilities = new Map();

  for (const { data } of documents) {
    for (const ability of data.system?.abilities ?? []) {
      const signature = mechanicalSignature(ability);
      const key = `${ability.id}:${signature}`;
      if (!abilities.has(key)) {
        abilities.set(key, ability);
      }
    }
  }

  return abilities;
}

async function createAbilityPack(language, canonicalAbilities) {
  const directory = path.join(
    root,
    "packs",
    PACKS[language].abilities,
    "_source"
  );

  await resetDirectory(directory);

  const entries = new Map();
  const names = new Map();

  for (const [key, ability] of canonicalAbilities) {
    const id = stableId(key);
    entries.set(key, id);

    const variants = names.get(ability.name) ?? [];
    variants.push({ id, sourceId: ability.id, signature: mechanicalSignature(ability) });
    names.set(ability.name, variants);

    // The French Character Book/Notion dataset is not part of this repository.
    // Until its English entry is proven identical to the CRD, use CRD English.
    const content = language === "fr"
      ? { ...ability }
      : ability;

    await writeDocument(
      directory,
      `${ability.id}-${id}.json`,
      toAbilityDocument(content, id, language)
    );
  }

  return { entries, names };
}

function abilityRef(language, ability, entries) {
  const key = `${ability.id}:${mechanicalSignature(ability)}`;
  const id = entries.get(key);
  if (!id) {
    throw new Error(
      `No standalone ability for ${ability.id} (${ability.name})`
    );
  }

  return `Compendium.cypher.${PACKS[language].abilities}.Item.${id}`;
}

async function rewriteTypes(language, entries) {
  const directory = path.join(root, "packs", PACKS[language].types, "_source");

  for (const { name, data } of await readDocuments(PACKS[language].types)) {
    if (data._key.startsWith("!folders!")) continue;

    data.system.abilities = (data.system.abilities ?? [])
      .map(ability => abilityRef(language, ability, entries));

    await writeDocument(directory, name, data);
  }
}

async function rewriteFoci(language, entries) {
  const directory = path.join(root, "packs", PACKS[language].foci, "_source");

  for (const { name, data } of await readDocuments(PACKS[language].foci)) {
    if (data._key.startsWith("!folders!")) continue;

    const abilities = data.system.abilities ?? [];
    const refs = abilities.map(ability => abilityRef(language, ability, entries));
    const byId = new Map();

    abilities.forEach((ability, index) => {
      byId.set(ability.id, refs[index]);
    });

    const edges = [];
    for (const ability of abilities) {
      const to = abilityRef(language, ability, entries);

      for (const prerequisite of ability.prerequisites ?? []) {
        const from = byId.get(prerequisite);
        if (!from) {
          throw new Error(
            `Focus ${data.name}: unknown prerequisite ${prerequisite} for ${ability.id}`
          );
        }
        edges.push({ from, to });
      }
    }

    data.system.abilities = refs;
    data.system.flowchart = { edges };

    await writeDocument(directory, name, data);
  }
}

const canonicalAbilities = await collectCanonicalAbilities();
const english = await createAbilityPack("en", canonicalAbilities);
const french = await createAbilityPack("fr", canonicalAbilities);

await rewriteTypes("en", english.entries);
await rewriteFoci("en", english.entries);
await rewriteTypes("fr", french.entries);
await rewriteFoci("fr", french.entries);

const variants = [...english.names.entries()]
  .filter(([, values]) => values.length > 1)
  .map(([name, values]) => ({ name, variants: values }));

await fs.mkdir(path.join(root, "docs"), { recursive: true });
await fs.writeFile(
  path.join(root, "docs", "ability-name-variants.json"),
  `${JSON.stringify(variants, null, 2)}\n`,
  "utf8"
);

console.log(
  `Migrated ${canonicalAbilities.size} standalone ability variants; ` +
  `${variants.length} names have multiple mechanical variants.`
);
