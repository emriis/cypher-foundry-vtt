/**
 * Migrates embedded Type/Focus abilities into standalone ability compendium
 * sources.
 *
 * The migration is deterministic. Localized names and descriptions never
 * determine technical identity; mechanical differences create distinct
 * ability documents. Focus prerequisites become flowchart edges.
 *
 * Run with: npm run migrate:packs
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const LANGUAGES = ["en", "fr"];
const PARENT_PACKS = ["types", "foci"];

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slug(value) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferAction(ability) {
  if (ability.enabler) return null;

  const text = String(ability.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .trim();

  if (/\bFirst action\.\s*$/i.test(text)) return "firstAction";
  if (/\bLast action\.\s*$/i.test(text)) return "lastAction";
  if (/\bAction\.\s*$/i.test(text)) return "action";
  return null;
}

function stripEditorial(value) {
  if (Array.isArray(value)) return value.map(stripEditorial);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["name", "description"].includes(key))
      .map(([key, nested]) => [key, stripEditorial(nested)])
  );
}

function mechanicalShape(ability) {
  return stripEditorial({
    tier: ability.tier,
    enabler: Boolean(ability.enabler),
    repeatable: Boolean(ability.repeatable),
    cost: ability.cost ?? { stat: "none", amount: 0, options: [] },
    action: ability.action ?? inferAction(ability),
    freeWeaponCategories: ability.freeWeaponCategories ?? [],
    freeArmorCategories: ability.freeArmorCategories ?? [],
    freeWeaponFamilies: ability.freeWeaponFamilies ?? [],
    freeWeaponSkillCategories: ability.freeWeaponSkillCategories ?? [],
    chooseWeaponAttackCategory: Boolean(ability.chooseWeaponAttackCategory),
    grantedArmorItemCategory: ability.grantedArmorItemCategory ?? "",
    effects: ability.effects ?? [],
    rollTables: ability.rollTables ?? []
  });
}

function identity(ability) {
  const key = slug(ability.id || ability.name);
  const signature = hash(JSON.stringify(mechanicalShape(ability)));
  return { key, signature, id: hash(`${key}\0${signature}`).slice(0, 16) };
}

async function sourceFiles(pack) {
  const dir = path.join(root, "packs", pack, "_source");
  return (await fs.readdir(dir))
    .filter(file => file.endsWith(".json"))
    .map(file => path.join(dir, file));
}

async function collectEnglishRegistry() {
  const registry = new Map();
  const byKey = new Map();

  for (const parent of PARENT_PACKS) {
    for (const file of await sourceFiles(`${parent}-en`)) {
      const document = JSON.parse(await fs.readFile(file, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      for (const ability of document.system?.abilities ?? []) {
        if (!ability || typeof ability !== "object") continue;
        const id = identity(ability);
        const entryKey = `${id.key}:${id.signature}`;
        if (!registry.has(entryKey)) registry.set(entryKey, { ...id, ability });

        const entries = byKey.get(id.key) ?? [];
        if (!entries.some(entry => entry.signature === id.signature)) {
          entries.push(registry.get(entryKey));
          byKey.set(id.key, entries);
        }
      }
    }
  }

  return { registry, byKey };
}

async function collectDocuments(language) {
  const documents = [];
  for (const parent of PARENT_PACKS) {
    for (const file of await sourceFiles(`${parent}-${language}`)) {
      const document = JSON.parse(await fs.readFile(file, "utf8"));
      if (!document._key?.startsWith("!folders!")) {
        documents.push({ parent, file, document });
      }
    }
  }
  return documents;
}

function resolveFrenchEntry(ability, english) {
  const id = identity(ability);
  const exact = english.registry.get(`${id.key}:${id.signature}`);
  if (exact) return { entry: exact, translated: true };

  const candidates = english.byKey.get(id.key) ?? [];
  if (candidates.length === 1) return { entry: candidates[0], translated: false };

  throw new Error(
    `French ability "${ability.name}" has no unambiguous CRD mechanical match for key "${id.key}".`
  );
}

async function migrateLanguage(language, english) {
  const documents = await collectDocuments(language);
  const hasLegacyAbilities = documents.some(({ document }) =>
    (document.system?.abilities ?? []).some(
      ability => ability && typeof ability === "object"
    )
  );
  if (!hasLegacyAbilities) return;

  const registry = new Map();

  for (const { document } of documents) {
    for (const ability of document.system?.abilities ?? []) {
      if (!ability || typeof ability !== "object") continue;
      const resolved = language === "fr"
        ? resolveFrenchEntry(ability, english)
        : {
            entry: english.registry.get(
              `${identity(ability).key}:${identity(ability).signature}`
            ),
            translated: true
          };

      if (!resolved.entry) continue;

      const key = `${resolved.entry.key}:${resolved.entry.signature}`;
      if (!registry.has(key)) {
        registry.set(key, {
          ...resolved.entry,
          localizedAbility: resolved.translated ? ability : resolved.entry.ability
        });
      }
    }
  }

  const abilityDir = path.join(root, "packs", `abilities-${language}`, "_source");
  await fs.rm(abilityDir, { recursive: true, force: true });
  await fs.mkdir(abilityDir, { recursive: true });

  for (const entry of registry.values()) {
    const ability = entry.localizedAbility;
    const canonical = entry.ability;
    const document = {
      _id: entry.id,
      _key: `!items!${entry.id}`,
      name: ability.name,
      type: "ability",
      img: "icons/svg/upgrade.svg",
      system: {
        key: entry.key,
        tier: canonical.tier,
        enabler: Boolean(canonical.enabler),
        repeatable: Boolean(canonical.repeatable),
        cost: canonical.cost ?? { stat: "none", amount: 0, options: [] },
        action: inferAction(canonical),
        freeWeaponCategories: canonical.freeWeaponCategories ?? [],
        freeArmorCategories: canonical.freeArmorCategories ?? [],
        freeWeaponFamilies: canonical.freeWeaponFamilies ?? [],
        freeWeaponSkillCategories: canonical.freeWeaponSkillCategories ?? [],
        chooseWeaponAttackCategory: Boolean(canonical.chooseWeaponAttackCategory),
        grantedArmorItemCategory: canonical.grantedArmorItemCategory ?? "",
        effects: canonical.effects ?? [],
        rollTables: canonical.rollTables ?? [],
        description: ability.description ?? canonical.description ?? ""
      }
    };
    await fs.writeFile(
      path.join(abilityDir, `${entry.id}.json`),
      JSON.stringify(document, null, 2) + "\n"
    );
  }

  for (const { parent, file, document } of documents) {
    const legacyAbilities = document.system?.abilities ?? [];
    const refs = [];
    const localIds = new Map();

    for (const ability of legacyAbilities) {
      const resolved = language === "fr"
        ? resolveFrenchEntry(ability, english)
        : {
            entry: english.registry.get(
              `${identity(ability).key}:${identity(ability).signature}`
            )
          };
      if (!resolved.entry) continue;

      refs.push(`Compendium.cypher.abilities-${language}.Item.${resolved.entry.id}`);
      localIds.set(ability.id, resolved.entry.id);
    }

    document.system.abilities = refs;

    if (parent === "foci") {
      document.system.flowchart = {
        edges: legacyAbilities.flatMap(ability =>
          (ability.prerequisites ?? []).map(prerequisite => ({
            from: localIds.get(prerequisite),
            to: localIds.get(ability.id)
          }))
        ).filter(edge => edge.from && edge.to)
      };
    }

    await fs.writeFile(file, JSON.stringify(document, null, 2) + "\n");
  }
}

export async function migrateAbilitySources() {
  const english = await collectEnglishRegistry();
  await migrateLanguage("en", english);
  await migrateLanguage("fr", english);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrateAbilitySources();
  console.log("Standalone ability sources migrated.");
}
