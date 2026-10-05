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
const CRD_VERSION = "2026-07-29";
const KNOWN_EDITORIAL_ARTIFACT_IDS = new Set([
  "fecb5c4df49a4667"
]);

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

function mechanicalShapeWithoutAction(ability) {
  const shape = mechanicalShape(ability);
  delete shape.action;
  return shape;
}

function mechanicallyMatchesExceptAction(left, right) {
  return JSON.stringify(mechanicalShapeWithoutAction(left)) ===
    JSON.stringify(mechanicalShapeWithoutAction(right));
}

function isGmIntrusionEntry(ability) {
  return /\bgm intrusions\b/i.test(String(ability.name ?? ""));
}

function isEditorialArtifact(ability) {
  return isGmIntrusionEntry(ability) ||
    String(ability.name ?? "").trim() === "At higher tiers";
}

function identity(ability) {
  const key = slug(ability.id || ability.name);
  const signature = hash(JSON.stringify(mechanicalShape(ability)));
  return { key, signature, id: hash(`${key}\\0${signature}`).slice(0, 16) };
}

function buildLogicalId(key, signature, variants) {
  const suffix = variants > 1 ? `-${signature.slice(0, 12)}` : "";
  return `ability.${key}${suffix}`;
}

function provenance(language, parent, document, ability, logicalId) {
  const parentLabel = parent === "types" ? "Type" : "Focus";
  return {
    version: CRD_VERSION,
    logicalId,
    language,
    sourceKind: "record",
    section: `Character Creation — ${parentLabel} — ${document.name} — Abilities`,
    sourceLocator: `CRD — ${parentLabel}: ${document.name} — Ability: ${ability.name}`,
    transformations: [
      "mechanical fields extracted from the CRD",
      "source occurrence converted to a standalone Ability Item"
    ],
    ...(language === "fr" ? { sourceLogicalId: logicalId } : {})
  };
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
        if (!ability || typeof ability !== "object" || isEditorialArtifact(ability)) continue;
        const id = identity(ability);
        const entryKey = `${id.key}:${id.signature}`;
        if (!registry.has(entryKey)) registry.set(entryKey, {
          ...id,
          ability,
          parent,
          document,
          provenance: null
        });

        const entries = byKey.get(id.key) ?? [];
        if (!entries.some(entry => entry.signature === id.signature)) {
          entries.push(registry.get(entryKey));
          byKey.set(id.key, entries);
        }
      }
    }
  }

  const variants = new Map();
  for (const entry of registry.values()) {
    variants.set(entry.key, (variants.get(entry.key) ?? 0) + 1);
  }
  for (const entry of registry.values()) {
    entry.logicalId = buildLogicalId(entry.key, entry.signature, variants.get(entry.key));
    entry.provenance = provenance("en", entry.parent, entry.document, entry.ability, entry.logicalId);
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

function resolveFrenchEntry(ability, english, standaloneEnglish) {
  const id = identity(ability);
  const exact = english.registry.get(`${id.key}:${id.signature}`);
  if (exact) return { entry: exact, translated: true };

  const standalone = standaloneEnglish.get(
    `${id.key}:${id.signature}`
  );
  if (standalone) return { entry: standalone, translated: true };

  const candidates = [
    ...(english.byKey.get(id.key) ?? []),
    ...[...standaloneEnglish.values()].filter(entry => entry.key === id.key)
  ];
  const description = String(ability.description ?? "").trim();
  const descriptionMatches = candidates.filter(entry =>
    description &&
    description === String(
      entry.ability?.description ?? entry.description ?? ""
    ).trim()
  );
  const uniqueDescriptionMatches = new Map(
    descriptionMatches.map(entry => [`${entry.key}:${entry.signature}`, entry])
  );

  if (uniqueDescriptionMatches.size === 1) {
    return {
      entry: [...uniqueDescriptionMatches.values()][0],
      translated: false
    };
  }

  const mechanicalMatches = candidates.filter(entry =>
    mechanicallyMatchesExceptAction(ability, entry.ability ?? entry)
  );
  const uniqueMatches = new Map(
    mechanicalMatches.map(entry => [`${entry.key}:${entry.signature}`, entry])
  );

  if (uniqueMatches.size === 1) {
    return {
      entry: [...uniqueMatches.values()][0],
      translated: false
    };
  }

  if (candidates.length === 1) {
    return { entry: candidates[0], translated: false };
  }

  throw new Error(
    `French ability "${ability.name}" has no unambiguous CRD mechanical match for key "${id.key}".`
  );
}

async function collectReferenceProvenance(language) {
  const references = new Map();

  for (const parent of PARENT_PACKS) {
    for (const file of await sourceFiles(`${parent}-${language}`)) {
      const document = JSON.parse(await fs.readFile(file, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      for (const reference of document.system?.abilities ?? []) {
        const match = String(reference).match(
          /Item\.([A-Za-z0-9]{16})$/
        );
        if (!match || references.has(match[1])) continue;

        references.set(match[1], {
          parent,
          document
        });
      }
    }
  }

  return references;
}

async function enrichStandaloneLanguage(language, english, diagnostics) {
  const abilityDir = path.join(root, "packs", `abilities-${language}`, "_source");
  const files = await sourceFiles(`abilities-${language}`);
  const documents = [];

  for (const file of files) {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;
    documents.push({ file, document });
  }

  const identities = documents.map(({ document }) => ({
    document,
    identity: identity({
      id: document.system.key,
      name: document.name,
      ...document.system
    })
  }));
  const variants = new Map();
  for (const { identity: id } of identities) {
    const entryKey = `${id.key}:${id.signature}`;
    if (!variants.has(entryKey)) variants.set(entryKey, id);
  }
  const keyVariantCounts = new Map();
  for (const id of variants.values()) {
    keyVariantCounts.set(id.key, (keyVariantCounts.get(id.key) ?? 0) + 1);
  }

  const standaloneEnglish = new Map();
  if (language === "fr") {
    for (const file of await sourceFiles("abilities-en")) {
      const source = JSON.parse(await fs.readFile(file, "utf8"));
      if (source._key?.startsWith("!folders!") ||
          isEditorialArtifact(source.system)) continue;
      const standalone = {
        id: source.system?.key,
        name: source.name,
        ...source.system
      };
      const id = identity(standalone);
      const logicalId = source.flags?.cypherFoundry?.crd?.logicalId ??
        buildLogicalId(id.key, id.signature, 1);
      standaloneEnglish.set(`${id.key}:${id.signature}`, {
        ...id,
        ability: standalone,
        logicalId
      });
    }
  }

  const references = await collectReferenceProvenance(language);

  for (const { file, document } of documents) {
    const key = document.system?.key;
    if (!key) continue;

    const standalone = {
      id: key,
      name: document.name,
      ...document.system
    };
    const id = identity(standalone);
    let match;
    try {
      match = language === "fr"
        ? resolveFrenchEntry(standalone, english, standaloneEnglish).entry
        : english.registry.get(`${id.key}:${id.signature}`);
    } catch (error) {
      diagnostics.push({
        code: "UNRESOLVED_FRENCH_ABILITY",
        language,
        ability: document.name,
        key: id.key,
        file,
        message: error.message
      });
      continue;
    }
    const logicalId = match?.logicalId ??
      buildLogicalId(
        id.key,
        id.signature,
        keyVariantCounts.get(id.key) ?? 1
      );
    const reference = references.get(document._id);
    const sourceParent = reference?.parent ?? "types";
    const sourceDocument = reference?.document ?? {
      name: "Standalone Ability Catalogue"
    };

    document.document = "Item";
    document.crdType = "ability";
    if (language === "fr" && match) {
      const canonicalAction = match.ability?.action ??
        inferAction(match.ability ?? match);
      if (standalone.action !== canonicalAction) {
        document.system.action = canonicalAction;
      }
    }

    document.flags = {
      ...(document.flags ?? {}),
      cypherFoundry: {
        ...(document.flags?.cypherFoundry ?? {}),
        crd: {
          ...provenance(
            language,
            sourceParent,
            sourceDocument,
            { name: document.name },
            logicalId
          ),
          ...(language === "fr" && match
            ? { sourceLogicalId: match.logicalId }
            : {})
        }
      }
    };

    await fs.writeFile(file, JSON.stringify(document, null, 2) + "\n");
  }

  const abilityIds = new Set(documents.map(({ document }) => document._id));
  for (const parent of PARENT_PACKS) {
    for (const file of await sourceFiles(`${parent}-${language}`)) {
      const document = JSON.parse(await fs.readFile(file, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;
      const references = document.system?.abilities ?? [];
      const missing = references.filter(reference => {
        const match = String(reference).match(/Item\.([A-Za-z0-9]{16})$/);
        return match && !abilityIds.has(match[1]);
      });
      const unexpected = missing.filter(reference => {
        const match = String(reference).match(/Item\.([A-Za-z0-9]{16})$/);
        return !KNOWN_EDITORIAL_ARTIFACT_IDS.has(match?.[1]);
      });
      if (unexpected.length) {
        diagnostics.push({
          code: "UNRESOLVED_ABILITY_REFERENCE",
          language,
          parent,
          file,
          message: `Unresolved ${language} ${parent} ability references: ${unexpected.join(", ")}`
        });
      }
      document.system.abilities = references.filter(reference => {
        const match = String(reference).match(/Item\.([A-Za-z0-9]{16})$/);
        return !match || abilityIds.has(match[1]);
      });
      await fs.writeFile(file, JSON.stringify(document, null, 2) + "\n");
    }
  }

  return abilityDir;
}

async function migrateLanguage(language, english, diagnostics) {
  const documents = await collectDocuments(language);
  const hasLegacyAbilities = documents.some(({ document }) =>
    (document.system?.abilities ?? []).some(
      ability => ability && typeof ability === "object" && !isGmIntrusionEntry(ability)
    )
  );
  if (!hasLegacyAbilities) {
    await enrichStandaloneLanguage(language, english, diagnostics);
    return;
  }

  const registry = new Map();

  for (const { document } of documents) {
    for (const ability of document.system?.abilities ?? []) {
      if (!ability || typeof ability !== "object" || isEditorialArtifact(ability)) continue;
      let resolved;
      try {
        resolved = language === "fr"
          ? resolveFrenchEntry(ability, english)
          : {
              entry: english.registry.get(
                `${identity(ability).key}:${identity(ability).signature}`
              ),
              translated: true
            };
      } catch (error) {
        diagnostics.push({
          code: "UNRESOLVED_LEGACY_ABILITY",
          language,
          parent: document.name,
          ability: ability.name,
          key: identity(ability).key,
          message: error.message
        });
        continue;
      }

      if (!resolved.entry) {
        diagnostics.push({
          code: "MISSING_CANONICAL_ABILITY",
          language,
          parent: document.name,
          ability: ability.name,
          key: identity(ability).key,
          message: `No canonical English ability matched ${ability.name}.`
        });
        continue;
      }

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
    const localizedProvenance = language === "fr"
      ? { ...entry.provenance, language: "fr", sourceLogicalId: entry.logicalId }
      : entry.provenance;
    const document = {
      _id: entry.id,
      _key: `!items!${entry.id}`,
      document: "Item",
      name: ability.name,
      type: "ability",
      img: "icons/svg/upgrade.svg",
      crdType: "ability",
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
      },
      flags: {
        cypherFoundry: {
          crd: localizedProvenance
        }
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
      let resolved;
      try {
        resolved = language === "fr"
          ? resolveFrenchEntry(ability, english)
          : {
              entry: english.registry.get(
                `${identity(ability).key}:${identity(ability).signature}`
              )
            };
      } catch (error) {
        diagnostics.push({
          code: "UNRESOLVED_LEGACY_ABILITY_REFERENCE",
          language,
          parent,
          ability: ability.name,
          key: identity(ability).key,
          message: error.message
        });
        continue;
      }
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
  const diagnostics = [];
  const english = await collectEnglishRegistry();
  await migrateLanguage("en", english, diagnostics);
  await migrateLanguage("fr", english, diagnostics);

  if (diagnostics.length) {
    const counts = new Map();
    for (const diagnostic of diagnostics) {
      counts.set(diagnostic.code, (counts.get(diagnostic.code) ?? 0) + 1);
    }
    console.error("Ability migration validation failed:");
    for (const [code, count] of counts) {
      console.error(`  ${code}: ${count}`);
    }
    for (const diagnostic of diagnostics) {
      console.error(
        `  [${diagnostic.code}] ${diagnostic.language} ` +
        `${diagnostic.key ?? ""} — ${diagnostic.message}`
      );
    }
    throw new Error(
      `Ability migration validation found ${diagnostics.length} error(s).`
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrateAbilitySources();
  console.log("Standalone ability sources migrated.");
}
