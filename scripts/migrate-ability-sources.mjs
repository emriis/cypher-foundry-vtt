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
const EDITORIAL_ARTIFACT_IDS = new Set([
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

function mechanicalEffectShape(effect) {
  return {
    id: effect.id ?? "",
    rollTables: effect.rollTables ?? []
  };
}

function mechanicalShape(ability) {
  return stripEditorial({
    tier: ability.tier,
    enabler: Boolean(ability.enabler),
    repeatable: Boolean(ability.repeatable),
    cost: ability.cost ?? { stat: "none", amount: 0, options: [] },
    action: ability.enabler ? null : ability.action ?? inferAction(ability),
    freeWeaponCategories: ability.freeWeaponCategories ?? [],
    freeArmorCategories: ability.freeArmorCategories ?? [],
    freeWeaponFamilies: ability.freeWeaponFamilies ?? [],
    freeWeaponSkillCategories: ability.freeWeaponSkillCategories ?? [],
    chooseWeaponAttackCategory: Boolean(ability.chooseWeaponAttackCategory),
    grantedArmorItemCategory: ability.grantedArmorItemCategory ?? "",
    effects: (ability.effects ?? []).map(mechanicalEffectShape),
    rollTables: ability.rollTables ?? []
  });
}

function contentIdentityShape(ability) {
  return stripEditorial({
    mechanics: mechanicalShape(ability),
    description: String(ability.description ?? "").trim()
  });
}

function contentIdentityShapeWithoutDescription(ability) {
  const shape = contentIdentityShape(ability);
  delete shape.description;
  return shape;
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

function mechanicalShapeWithoutActionAndEnabler(ability) {
  const shape = mechanicalShape(ability);
  delete shape.action;
  delete shape.enabler;
  return shape;
}

function mechanicallyMatchesExceptActionAndEnabler(left, right) {
  return JSON.stringify(
    mechanicalShapeWithoutActionAndEnabler(left)
  ) === JSON.stringify(
    mechanicalShapeWithoutActionAndEnabler(right)
  );
}

function isGmIntrusionEntry(ability) {
  return /\bgm intrusions\b/i.test(String(ability.name ?? ""));
}

function isEditorialArtifact(ability) {
  const id = String(ability.id ?? ability.key ?? "");
  const name = String(ability.name ?? "").trim();

  return isGmIntrusionEntry(ability) ||
    /(?:^|-)gm-intrusions$/i.test(id) ||
    /^Intrusions MJ\b/i.test(name) ||
    name === "At higher tiers";
}

function canonicalMechanicalShape(ability) {
  const shape = mechanicalShape(ability);
  delete shape.tier;
  return shape;
}

function localizedPairingMechanicalShape(ability) {
  const shape = contentIdentityShapeWithoutDescription(ability);
  delete shape.action;
  return shape;
}

function localizedLooseMechanicalShape(ability) {
  const shape = localizedPairingMechanicalShape(ability);
  delete shape.enabler;
  return shape;
}

function identity(ability) {
  const key = slug(ability.id || ability.name);
  const signature = hash(JSON.stringify(contentIdentityShape(ability)));
  return { key, signature, id: hash(`${key}\\0${signature}`).slice(0, 16) };
}

function buildLogicalId(key, signature, variants) {
  const suffix = variants > 1 ? `-${signature.slice(0, 12)}` : "";
  return `ability.${key}${suffix}`;
}

function buildLocalizedLogicalId(key, sourceId, variants) {
  const suffix = variants > 1
    ? `-${hash(String(sourceId)).slice(0, 12)}`
    : "";
  return `ability.${key}${suffix}`;
}

function provenance(language, parent, document, ability, logicalId) {
  const parentLabel = parent === "types"
    ? "Type"
    : parent === "foci"
      ? "Focus"
      : "Ability Catalogue";
  return {
    version: CRD_VERSION,
    logicalId,
    language,
    sourceKind: "record",
    section: parent === "abilities"
      ? `Ability Catalogue — ${document.name}`
      : `Character Creation — ${parentLabel} — ${document.name} — Abilities`,
    sourceLocator: parent === "abilities"
      ? `CRD — Ability: ${ability.name}`
      : `CRD — ${parentLabel}: ${document.name} — Ability: ${ability.name}`,
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

async function pruneAbilityArtifacts() {
  const removedIds = new Set();

  for (const language of LANGUAGES) {
    for (const file of await sourceFiles(`abilities-${language}`)) {
      const document = JSON.parse(await fs.readFile(file, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      if (isEditorialArtifact(document)) {
        removedIds.add(document._id);
        EDITORIAL_ARTIFACT_IDS.add(document._id);
        await fs.rm(file, { force: true });
      }
    }
  }

  return removedIds;
}

async function pruneAbilityReferences(removedIds) {
  if (!removedIds.size) return;

  for (const parent of PARENT_PACKS) {
    for (const language of LANGUAGES) {
      for (const file of await sourceFiles(`${parent}-${language}`)) {
        const document = JSON.parse(await fs.readFile(file, "utf8"));
        if (document._key?.startsWith("!folders!")) continue;

        const abilities = document.system?.abilities ?? [];
        const filtered = abilities.filter(uuid =>
          !removedIds.has(
            typeof uuid === "string" ? uuid.split(".").at(-1) : null
          )
        );

        if (filtered.length === abilities.length) continue;

        document.system.abilities = filtered;

        if (parent === "foci" && document.system.flowchart) {
          const remaining = new Set(
            filtered.map(uuid => uuid.split(".").at(-1))
          );
          document.system.flowchart.edges = (
            document.system.flowchart.edges ?? []
          ).filter(edge =>
            remaining.has(edge.from) && remaining.has(edge.to)
          );
        }

        await fs.writeFile(
          file,
          JSON.stringify(document, null, 2) + "\n"
        );
      }
    }
  }
}

async function mergeGenreAbilities() {
  const manifestPath = path.join(root, "data", "crd-genre-abilities.json");
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    return;
  }

  if (manifest.version !== CRD_VERSION) {
    throw new Error(
      `Unsupported CRD genre ability manifest version: ${manifest.version}`
    );
  }

  const records = manifest.records ?? [];
  const existing = new Map();

  for (const file of await sourceFiles("abilities-en")) {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;
    const identityKey = `${document.system?.key}:${hash(
      JSON.stringify(contentIdentityShape(document.system ?? {}))
    )}`;
    existing.set(identityKey, { file, document });
  }

  const writeRecord = async (language, record, localized) => {
    const abilityDir = path.join(root, "packs", `abilities-${language}`, "_source");
    await fs.mkdir(abilityDir, { recursive: true });

    const logicalId = record.logicalId;
    const id = hash(logicalId).slice(0, 16);
    const document = {
      _id: id,
      _key: `!items!${id}`,
      document: "Item",
      crdType: "ability",
      name: localized?.name ?? record.name,
      type: "ability",
      img: "icons/svg/upgrade.svg",
      system: {
        ...record.system,
        description: localized?.system?.description ?? record.system.description
      },
      flags: {
        cypherFoundry: {
          crd: {
            ...record.provenance,
            language,
            ...(language === "fr"
              ? { sourceLogicalId: record.logicalId }
              : {})
          }
        }
      }
    };

    await fs.writeFile(
      path.join(abilityDir, `${id}.json`),
      JSON.stringify(document, null, 2) + "\n"
    );
  };

  for (const record of records) {
    const identityKey = `${record.system.key}:${hash(
      JSON.stringify(contentIdentityShape(record.system))
    )}`;
    const current = existing.get(identityKey);

    if (!current) {
      await writeRecord("en", record);
      await writeRecord("fr", record);
      continue;
    }

    if (!current.document.flags?.cypherFoundry?.crd) {
      current.document.document = "Item";
      current.document.crdType = "ability";
      current.document.flags = {
        ...(current.document.flags ?? {}),
        cypherFoundry: {
          ...(current.document.flags?.cypherFoundry ?? {}),
          crd: record.provenance
        }
      };
      await fs.writeFile(
        current.file,
        JSON.stringify(current.document, null, 2) + "\n"
      );
    }

    const frFile = path.join(
      root,
      "packs",
      "abilities-fr",
      "_source",
      `${current.document._id}.json`
    );

    try {
      await fs.access(frFile);
    } catch {
      await writeRecord("fr", record);
    }
  }
}

async function collectEnglishRegistry() {
  const registry = new Map();
  const byKey = new Map();

  const register = (parent, document, ability) => {
    if (!ability || typeof ability !== "object" || isEditorialArtifact(ability)) {
      return;
    }

    const id = identity(ability);
    const entryKey = `${id.key}:${id.signature}`;
    if (!registry.has(entryKey)) {
      registry.set(entryKey, {
        ...id,
        ability,
        parent,
        document,
        provenance: null
      });
    }

    const entries = byKey.get(id.key) ?? [];
    if (!entries.some(entry => entry.signature === id.signature)) {
      entries.push(registry.get(entryKey));
      byKey.set(id.key, entries);
    }
  };

  for (const file of await sourceFiles("abilities-en")) {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;

    register("abilities", document, {
      id: document.system?.key,
      name: document.name,
      ...document.system
    });
  }

  for (const parent of PARENT_PACKS) {
    for (const file of await sourceFiles(`${parent}-en`)) {
      const document = JSON.parse(await fs.readFile(file, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      for (const ability of document.system?.abilities ?? []) {
        register(parent, document, ability);
      }
    }
  }

  const standaloneKeys = new Set();
  const variants = new Map();

  for (const entry of registry.values()) {
    if (entry.parent !== "abilities") continue;
    standaloneKeys.add(entry.key);
    variants.set(entry.key, (variants.get(entry.key) ?? 0) + 1);
  }

  for (const entry of registry.values()) {
    if (standaloneKeys.has(entry.key)) continue;
    variants.set(entry.key, (variants.get(entry.key) ?? 0) + 1);
  }

  for (const entry of registry.values()) {
    entry.logicalId = buildLogicalId(
      entry.key,
      entry.signature,
      variants.get(entry.key)
    );
    entry.provenance = provenance(
      "en",
      entry.parent,
      entry.document,
      entry.ability,
      entry.logicalId
    );
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

async function collectStandaloneEnglishLogicalIds() {
  const entries = [];
  for (const file of await sourceFiles("abilities-en")) {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;
    const key = document.system?.key;
    if (!key) continue;
    const signature = hash(JSON.stringify(contentIdentityShape(document.system)));
    entries.push({ key, signature, document });
  }

  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
  }

  const exact = new Map();
  const fallback = new Map();
  const byKey = new Map();
  const byKeyTier = new Map();
  const loose = new Map();

  for (const entry of entries) {
    const logicalId = buildLogicalId(
      entry.key,
      entry.signature,
      counts.get(entry.key)
    );
    exact.set(`${entry.key}:${entry.signature}`, logicalId);

    const fallbackKey = `${entry.key}:${hash(
      JSON.stringify(localizedPairingMechanicalShape(entry.document.system))
    )}`;
    const fallbackIds = fallback.get(fallbackKey) ?? new Set();
    fallbackIds.add(logicalId);
    fallback.set(fallbackKey, fallbackIds);

    const keyIds = byKey.get(entry.key) ?? new Set();
    keyIds.add(logicalId);
    byKey.set(entry.key, keyIds);

    const keyTier = `${entry.key}:${entry.document.system.tier}`;
    const tierIds = byKeyTier.get(keyTier) ?? new Set();
    tierIds.add(logicalId);
    byKeyTier.set(keyTier, tierIds);

    const looseKey = `${entry.key}:${entry.document.system.tier}:${hash(
      JSON.stringify(localizedLooseMechanicalShape(entry.document.system))
    )}`;
    const looseIds = loose.get(looseKey) ?? new Set();
    looseIds.add(logicalId);
    loose.set(looseKey, looseIds);
  }

  return { exact, fallback, byKey, byKeyTier, loose };
}

async function enrichStandaloneLanguage(language, englishLogicalIds) {
  const abilityDir = path.join(root, "packs", `abilities-${language}`, "_source");
  const files = await sourceFiles(`abilities-${language}`);
  const documents = [];

  for (const file of files) {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;
    documents.push({ file, document });
  }

  const keyCounts = new Map();
  for (const { document } of documents) {
    const key = document.system?.key;
    if (key) keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const references = await collectReferenceProvenance(language);

  for (const { file, document } of documents) {
    const key = document.system?.key;
    if (!key) continue;

    const reference = references.get(document._id);
    if (!reference) continue;

    const signature = hash(JSON.stringify(mechanicalShape(document.system ?? {})));
    let logicalId;
    if (language === "fr") {
      logicalId = englishLogicalIds.exact.get(`${key}:${signature}`);
      if (!logicalId) {
        const fallbackKey = `${key}:${hash(
          JSON.stringify(localizedPairingMechanicalShape(document.system ?? {}))
        )}`;
        const candidates = englishLogicalIds.fallback.get(fallbackKey);
        if (candidates?.size === 1) {
          logicalId = candidates.values().next().value;
        }
      }
      if (!logicalId) {
        const candidates = englishLogicalIds.byKeyTier.get(
          `${key}:${document.system?.tier}`
        );
        if (candidates?.size === 1) {
          logicalId = candidates.values().next().value;
        }
      }
      if (!logicalId) {
        const looseKey = `${key}:${document.system?.tier}:${hash(
          JSON.stringify(localizedLooseMechanicalShape(document.system ?? {}))
        )}`;
        const candidates = englishLogicalIds.loose.get(looseKey);
        if (candidates?.size) {
          logicalId = candidates.values().next().value;
        }
      }
      if (!logicalId) {
        const candidates = englishLogicalIds.byKey.get(key);
        if (candidates?.size) {
          logicalId = candidates.values().next().value;
        }
      }
    } else {
      logicalId = buildLogicalId(key, signature, keyCounts.get(key));
    }

    if (!logicalId) {
      throw new Error(
        `French Ability "${document.name}" has no canonical English logical ID for key "${key}".`
      );
    }

    document.document = "Item";
    document.crdType = "ability";
    document.flags = {
      ...(document.flags ?? {}),
      cypherFoundry: {
        ...(document.flags?.cypherFoundry ?? {}),
        crd: provenance(
          language,
          reference.parent,
          reference.document,
          { name: document.name },
          logicalId
        )
      }
    };

    await fs.writeFile(file, JSON.stringify(document, null, 2) + "\n");
  }

  return abilityDir;
}

async function migrateLanguage(language, english, englishLogicalIds) {
  const documents = await collectDocuments(language);
  const hasLegacyAbilities = documents.some(({ document }) =>
    (document.system?.abilities ?? []).some(
      ability => ability && typeof ability === "object" && !isEditorialArtifact(ability)
    )
  );
  if (!hasLegacyAbilities) {
    await enrichStandaloneLanguage(language, englishLogicalIds);
    return;
  }

  const registry = new Map();

  for (const { document } of documents) {
    for (const ability of document.system?.abilities ?? []) {
      if (!ability || typeof ability !== "object" || isEditorialArtifact(ability)) continue;
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
  const removedAbilityIds = await pruneAbilityArtifacts();
  await pruneAbilityReferences(removedAbilityIds);
  await mergeGenreAbilities();
  const english = await collectEnglishRegistry();
  const englishLogicalIds = await collectStandaloneEnglishLogicalIds();
  await migrateLanguage("en", english, englishLogicalIds);
  await migrateLanguage("fr", english, englishLogicalIds);
  const finalRemovedAbilityIds = await pruneAbilityArtifacts();
  await pruneAbilityReferences(finalRemovedAbilityIds);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrateAbilitySources();
  console.log("Standalone ability sources migrated.");
}
