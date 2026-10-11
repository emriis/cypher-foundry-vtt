/** Remove editorial artifacts, repair their references, and merge explicit genre sources.
 * Node tooling only. File-writing helpers must run in the isolated checkout during tests.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { root, LANGUAGES, PARENT_PACKS, CRD_VERSION, EDITORIAL_ARTIFACT_IDS, PENDING_FRENCH_TRANSLATION } from "./context.mjs";
import { isEditorialArtifact, hash, contentIdentityShape, buildLogicalId } from "./identity.mjs";
import { sourceFiles } from "./sources.mjs";

/**
 * Remove recognized editorial source records and collect IDs for reference cleanup.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @returns {Promise<Set<string>>} Removed Foundry IDs whose parent references must be pruned next.
 */
export async function pruneAbilityArtifacts() {
  // Keep known editorial IDs in the removal set even when a stale source file
  // has already disappeared. Parent documents can otherwise retain orphaned
  // references to those artifacts indefinitely.
  const removedIds = new Set(EDITORIAL_ARTIFACT_IDS);

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

/**
 * Remove references/graph edges to explicitly pruned editorial IDs.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @param {Set<string>} removedIds IDs removed from the source catalogue.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function pruneAbilityReferences(removedIds) {
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

        if (Array.isArray(document.system.abilityTiers)) {
          const remaining = new Set(filtered);
          document.system.abilityTiers = document.system.abilityTiers.filter(
            entry => remaining.has(entry?.ability)
          );
        }

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

/**
 * Merge the explicit genre catalogue and repair parent references in editable sources.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function mergeGenreAbilities() {
  const manifestPath = path.join(root, "data", "crd-genre-abilities.json");
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    return;
  }

  if (manifest.version !== CRD_VERSION) {
    throw new Error(`Unsupported CRD genre ability manifest version: ${manifest.version}`);
  }

  const records = manifest.records ?? [];
  const existing = new Map();
  const variantCounts = new Map();
  const addVariant = key => {
    if (key) variantCounts.set(key, (variantCounts.get(key) ?? 0) + 1);
  };

  for (const file of await sourceFiles("abilities-en")) {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (document._key?.startsWith("!folders!")) continue;
    const identityKey = `${document.system?.key}:${hash(JSON.stringify(contentIdentityShape(document.system ?? {})))}`;
    existing.set(identityKey, { file, document });
    addVariant(document.system?.key);
  }

  for (const record of records) {
    if (!record.system?.key) continue;
    const identityKey = `${record.system.key}:${hash(JSON.stringify(contentIdentityShape(record.system)))}`;
    if (!existing.has(identityKey)) addVariant(record.system.key);
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
      system: { ...record.system, description: localized?.system?.description ?? record.system.description },
      flags: {
        cypherFoundry: {
          crd: {
            ...record.provenance,
            language,
            transformations: [...new Set([
              ...(record.provenance.transformations ?? []),
              ...(language === "fr" && !localized ? [PENDING_FRENCH_TRANSLATION] : [])
            ])],
            ...(language === "fr" ? { sourceLogicalId: record.logicalId } : {})
          }
        }
      }
    };
    await fs.writeFile(path.join(abilityDir, `${id}.json`), JSON.stringify(document, null, 2) + "\n");
  };

  for (const record of records) {
    const identityKey = `${record.system.key}:${hash(JSON.stringify(contentIdentityShape(record.system)))}`;
    const current = existing.get(identityKey);
    if (current?.document?.flags?.cypherFoundry?.crd?.logicalId) {
      record.logicalId = current.document.flags.cypherFoundry.crd.logicalId;
    } else {
      record.logicalId = buildLogicalId(record.system.key, hash(JSON.stringify(contentIdentityShape(record.system))), variantCounts.get(record.system.key));
    }
    record.provenance.logicalId = record.logicalId;

    if (!current) {
      await writeRecord("en", record);
      await writeRecord("fr", record);
      continue;
    }

    current.document.document = "Item";
    current.document.crdType = "ability";
    current.document.flags = {
      ...(current.document.flags ?? {}),
      cypherFoundry: {
        ...(current.document.flags?.cypherFoundry ?? {}),
        crd: record.provenance
      }
    };
    await fs.writeFile(current.file, JSON.stringify(current.document, null, 2) + "\n");

    const frFile = path.join(root, "packs", "abilities-fr", "_source", `${current.document._id}.json`);
    try {
      await fs.access(frFile);
    } catch {
      await writeRecord("fr", record);
    }
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}
