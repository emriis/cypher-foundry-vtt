/** Resolve standalone Ability identities, EN/FR pairing, and legacy parent references.
 * Node tooling only. File-writing helpers must run in the isolated checkout during tests.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { root, PARENT_PACKS } from "./context.mjs";
import { isEditorialArtifact, identity, buildLogicalId, provenance, hash, contentIdentityShape, localizedPairingMechanicalShape, localizedLooseMechanicalShape, inferAction } from "./identity.mjs";
import { sourceFiles } from "./sources.mjs";

/**
 * Build the English canonical registry and variant counts before resolving other languages.
 * @returns {Promise<{registry: Map<string, object>, byKey: Map<string, object[]>}>} Entries indexed by key/signature and grouped by source key.
 */
export async function collectEnglishRegistry() {
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

/**
 * Collect canonical identities for already standalone English Abilities.
 * @returns {Promise<object>} Index object containing exact, fallback, document-ID, key, tier, loose, and logical-ID maps.
 */
export async function collectStandaloneEnglishLogicalIds() {
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
  const byDocumentId = new Map();
  const byKey = new Map();
  const byKeyTier = new Map();
  const loose = new Map();
  const byLogicalId = new Map();

  for (const entry of entries) {
    const logicalId = buildLogicalId(
      entry.key,
      entry.signature,
      counts.get(entry.key)
    );
    byLogicalId.set(logicalId, entry);
    exact.set(`${entry.key}:${entry.signature}`, logicalId);

    const documentIds = byDocumentId.get(entry.document._id) ?? new Set();
    documentIds.add(logicalId);
    byDocumentId.set(entry.document._id, documentIds);

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

  return {
    exact,
    fallback,
    byDocumentId,
    byKey,
    byKeyTier,
    loose,
    byLogicalId
  };
}

async function collectFrenchEnglishReferencePairs() {
  const pairs = new Map();

  const addPair = (frenchId, englishId) => {
    if (!frenchId || !englishId) return;
    const ids = pairs.get(frenchId) ?? new Set();
    ids.add(englishId);
    pairs.set(frenchId, ids);
  };

  for (const parent of PARENT_PACKS) {
    const englishFiles = await sourceFiles(`${parent}-en`);
    const frenchFiles = await sourceFiles(`${parent}-fr`);
    const frenchByName = new Map(
      frenchFiles.map(file => [path.basename(file), file])
    );

    for (const englishFile of englishFiles) {
      const frenchFile = frenchByName.get(path.basename(englishFile));
      if (!frenchFile) continue;

      const english = JSON.parse(await fs.readFile(englishFile, "utf8"));
      const french = JSON.parse(await fs.readFile(frenchFile, "utf8"));
      if (english._key?.startsWith("!folders!") ||
          french._key?.startsWith("!folders!")) continue;

      const englishAbilities = english.system?.abilities ?? [];
      const frenchAbilities = french.system?.abilities ?? [];
      const length = Math.min(
        englishAbilities.length,
        frenchAbilities.length
      );

      for (let index = 0; index < length; index += 1) {
        const englishReference = englishAbilities[index];
        const frenchReference = frenchAbilities[index];
        const englishId = typeof englishReference === "string"
          ? englishReference.split(".").at(-1)
          : englishReference?.id;
        const frenchId = typeof frenchReference === "string"
          ? frenchReference.split(".").at(-1)
          : frenchReference?.id;
        addPair(frenchId, englishId);
      }
    }
  }

  return pairs;
}

const PENDING_FRENCH_TRANSLATION = "English source retained pending French translation";

/**
 * Keep an untranslated French fallback traceable to its canonical English CRD
 * record on creation and subsequent passes. It has no French parent reference
 * from which enrichment could reconstruct the original section or locator.
 */
function pendingFrenchProvenance(logicalId, sourceProvenance = {}) {
  return {
    ...sourceProvenance,
    logicalId,
    language: "fr",
    sourceLogicalId: logicalId,
    transformations: [
      ...(sourceProvenance.transformations ?? []),
      PENDING_FRENCH_TRANSLATION
    ]
  };
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

  const referencePairs = language === "fr"
    ? await collectFrenchEnglishReferencePairs()
    : new Map();
  const canonicalDocuments = new Map();
  const duplicateIds = new Map();

  for (const { file, document } of documents) {
    const key = document.system?.key;
    if (!key) continue;

    const signature = hash(JSON.stringify(contentIdentityShape(document.system ?? {})));
    let logicalId;
    if (language === "fr") {
      const pairedEnglishIds = referencePairs.get(document._id);
      const pairedLogicalIds = new Set();
      for (const englishId of pairedEnglishIds ?? []) {
        for (const candidate of englishLogicalIds.byDocumentId.get(englishId) ?? []) {
          pairedLogicalIds.add(candidate);
        }
      }
      const selectCandidate = candidates => {
        const allCandidates = [...(candidates ?? [])];
        const unusedCandidates = allCandidates.filter(
          candidate => !canonicalDocuments.has(candidate)
        );

        if (unusedCandidates.length === 1) {
          return unusedCandidates[0];
        }

        // A single already-canonical candidate is a duplicate source, not an
        // ambiguity. Let the duplicate handling below collapse it.
        if (unusedCandidates.length === 0 && allCandidates.length === 1) {
          return allCandidates[0];
        }

        return null;
      };

      if (!logicalId) {
        const pairedCandidates = [...(pairedLogicalIds ?? [])]
          .filter(candidate =>
            englishLogicalIds.byKey.get(key)?.has(candidate)
          );
        logicalId = selectCandidate(pairedCandidates);
      }
      if (!logicalId) {
        const exact = englishLogicalIds.exact.get(
          `${key}:${signature}`
        );
        if (exact) {
          logicalId = exact;
        }
      }
      if (!logicalId) {
        const fallbackKey = `${key}:${hash(
          JSON.stringify(localizedPairingMechanicalShape(document.system ?? {}))
        )}`;
        logicalId = selectCandidate(
          englishLogicalIds.fallback.get(fallbackKey)
        );
      }
      if (!logicalId) {
        logicalId = selectCandidate(
          englishLogicalIds.byKeyTier.get(
            `${key}:${document.system?.tier}`
          )
        );
      }
      if (!logicalId) {
        const looseKey = `${key}:${document.system?.tier}:${hash(
          JSON.stringify(localizedLooseMechanicalShape(document.system ?? {}))
        )}`;
        logicalId = selectCandidate(englishLogicalIds.loose.get(looseKey));
      }
      if (!logicalId) {
        logicalId = selectCandidate(englishLogicalIds.byKey.get(key));
      }
    } else {
      logicalId = buildLogicalId(key, signature, keyCounts.get(key));
    }

    if (!logicalId) {
      throw new Error(
        `French Ability "${document.name}" has no canonical English logical ID for key "${key}".`
      );
    }

    const canonical = canonicalDocuments.get(logicalId);
    if (canonical) {
      duplicateIds.set(document._id, canonical.document._id);
      await fs.rm(file, { force: true });
      continue;
    }
    canonicalDocuments.set(logicalId, { file, document });

    document.document = "Item";
    document.crdType = "ability";
  }

  if (language === "fr") {
    for (const [logicalId, entry] of englishLogicalIds.byLogicalId) {
      if (canonicalDocuments.has(logicalId)) continue;

      const source = entry.document;
      const sourceProvenance = source.flags?.cypherFoundry?.crd;
      const document = {
        ...source,
        flags: {
          ...(source.flags ?? {}),
          cypherFoundry: {
            ...(source.flags?.cypherFoundry ?? {}),
            crd: pendingFrenchProvenance(logicalId, sourceProvenance)
          }
        }
      };

      const targetFile = path.join(abilityDir, `${document._id}.json`);
      try {
        await fs.access(targetFile);
        throw new Error(
          `Cannot create fallback French ability "${logicalId}": ` +
          `source file "${targetFile}" already exists.`
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }

      canonicalDocuments.set(logicalId, { file: targetFile, document });
    }
  }

  if (duplicateIds.size) {
    for (const parent of PARENT_PACKS) {
      const files = await sourceFiles(`${parent}-${language}`);
      for (const file of files) {
        const document = JSON.parse(await fs.readFile(file, "utf8"));
        if (document._key?.startsWith("!folders!")) continue;
        let changed = false;
        document.system.abilities = (document.system?.abilities ?? []).map(uuid => {
          if (typeof uuid !== "string") return uuid;
          const id = uuid.split(".").at(-1);
          const replacement = duplicateIds.get(id);
          if (!replacement) return uuid;
          changed = true;
          return uuid.replace(/Item\.[A-Za-z0-9]{16}$/, `Item.${replacement}`);
        });
        if (document.system.flowchart) {
          for (const edge of document.system.flowchart.edges ?? []) {
            const from = duplicateIds.get(edge.from);
            const to = duplicateIds.get(edge.to);
            if (from) { edge.from = from; changed = true; }
            if (to) { edge.to = to; changed = true; }
          }
        }
        if (changed) await fs.writeFile(file, JSON.stringify(document, null, 2) + "\n");
      }
    }
  }

  // Duplicate IDs now point to their retained record. Derive provenance from
  // these final parent references, not the references that existed before
  // deduplication; otherwise the next pass can choose a different CRD section.
  const references = await collectReferenceProvenance(language);
  for (const [logicalId, { file, document }] of canonicalDocuments) {
    const reference = references.get(document._id) ?? {
      parent: "abilities",
      document: { name: "Ability Catalogue" }
    };
    const previousProvenance = document.flags?.cypherFoundry?.crd;
    const isPendingFrench = language === "fr"
      && previousProvenance?.transformations?.includes(PENDING_FRENCH_TRANSLATION);
    const sourceProvenance = englishLogicalIds.byLogicalId.get(logicalId)
      ?.document.flags?.cypherFoundry?.crd;
    document.flags = {
      ...(document.flags ?? {}),
      cypherFoundry: {
        ...(document.flags?.cypherFoundry ?? {}),
        crd: isPendingFrench ? pendingFrenchProvenance(logicalId, sourceProvenance) : provenance(
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

// Existing standalone sources are enriched in place. Only the legacy embedded
// format takes the rebuild path below, which replaces the Ability source folder.
/**
 * Convert legacy parent data or enrich existing standalone records for one language.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @param {string} language "en" or "fr" source pack suffix.
 * @param {object} english Canonical English registry.
 * @param {object} englishLogicalIds Canonical English logical-ID lookup.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function migrateLanguage(language, english, englishLogicalIds) {
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
