/** Normalize individual CRD source families without changing their source authority.
 * Node tooling only. File-writing helpers must run in the isolated checkout during tests.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { root, LANGUAGES, CRD_VERSION } from "./context.mjs";
import { hash, slug } from "./identity.mjs";

/**
 * Normalize bilingual equipment records in the configured checkout.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function normalizeEquipmentSources() {
  for (const language of LANGUAGES) {
    const directory = path.join(root, "packs", `equipment-${language}`, "_source");

    for (const relativeFile of await fs.readdir(directory, { recursive: true })) {
      if (!relativeFile.endsWith(".json")) continue;

      const filePath = path.join(directory, relativeFile);
      const document = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      const provenance = document.flags?.cypherFoundry?.crd;
      if (!provenance?.logicalId) {
        throw new Error(`Equipment source "${filePath}" is missing its CRD logicalId.`);
      }

      // This migrator owns only the W4 equipment families whose canonical
      // identity is genre + price category + source name. Cyphers and future
      // artifact sources live in the equipment pack directory but have their
      // own CRD identity contracts and must not be normalized as equipment.
      const normalizedTypes = new Set(["equipment", "weapon", "armor", "shield"]);
      if (!normalizedTypes.has(document.crdType)) continue;

      const genre = String(provenance.section ?? "").replace(/ Equipment$/, "");
      const priceCategory = document.system?.priceCategory;
      if (!genre || !priceCategory || !document.name) {
        throw new Error(`Equipment source "${filePath}" is missing canonical identity fields.`);
      }

      // Equipment identity is the full canonical inventory tuple:
      // genre + price category + source name. The previous extractor omitted
      // price category, which collides for same-named entries at different prices.
      const logicalId = `equipment.${genre}.${priceCategory}.${document.name}`;
      provenance.logicalId = logicalId;
      if (provenance.language === "fr") provenance.sourceLogicalId = logicalId;

      const id = hash(logicalId).slice(0, 16);
      document._id = id;
      document._key = `!items!${id}`;

      // Generic CRD equipment has no physical-weight statistic. The
      // light/medium/heavy categories belong to weapons and armor, while
      // ordinary equipment weight is optional user-authored metadata.
      if (document.crdType === "equipment" || document.type === "equipment") {
        delete document.system.weight;
      }

      await fs.writeFile(filePath, JSON.stringify(document, null, 2) + "\n");
    }
  }
}

/**
 * Normalize bilingual Descriptor records in the configured checkout.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function normalizeDescriptorSources() {
  const descriptorPacks = LANGUAGES.map(language => ({
    language,
    pack: `descriptors-${language}`
  }));

  const english = new Map();
  const descriptorDirectories = [
    "standard",
    "species"
  ];

  for (const directory of descriptorDirectories) {
    const dir = path.join(root, "packs", "descriptors-en", "_source", directory);
    for (const file of await fs.readdir(dir)) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(dir, file);
      const document = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      const category = directory === "species" ? "species" : "descriptor";
      const slugValue = slug(path.basename(file, ".json"));
      const logicalId = category === "species"
        ? `descriptor.species.${slugValue}`
        : `descriptor.${slugValue}`;

      english.set(`${directory}/${file}`, {
        category,
        logicalId,
        name: document.name
      });
    }
  }

  for (const { language, pack } of descriptorPacks) {
    for (const directory of descriptorDirectories) {
      const dir = path.join(root, "packs", pack, "_source", directory);
      for (const file of await fs.readdir(dir)) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(dir, file);
        const document = JSON.parse(await fs.readFile(filePath, "utf8"));
        if (document._key?.startsWith("!folders!")) continue;

        const reference = english.get(`${directory}/${file}`);
        if (!reference) {
          throw new Error(
            `Missing English Descriptor source for ${directory}/${file}.`
          );
        }

        document.document = "Item";
        document.crdType = "descriptor";
        document.flags = {
          ...(document.flags ?? {}),
          cypherFoundry: {
            ...(document.flags?.cypherFoundry ?? {}),
            crd: {
              version: CRD_VERSION,
              logicalId: reference.logicalId,
              language,
              sourceKind: "record",
              section: reference.category === "species"
                ? `Character Creation — Species — ${reference.name}`
                : `Character Creation — Descriptor — ${reference.name}`,
              sourceLocator: reference.category === "species"
                ? `CRD — Species: ${reference.name}`
                : `CRD — Descriptor: ${reference.name}`,
              transformations: [
                "mechanical fields extracted from the CRD",
                "Descriptor source retained as a structured Foundry Item"
              ],
              ...(language === "fr"
                ? { sourceLogicalId: reference.logicalId }
                : {})
            }
          }
        };

        await fs.writeFile(
          filePath,
          JSON.stringify(document, null, 2) + "\n"
        );
      }
    }
  }
}

/**
 * Normalize bilingual Type records in the configured checkout.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function normalizeTypeSources() {
  for (const language of LANGUAGES) {
    const directory = path.join(
      root,
      "packs",
      `types-${language}`,
      "_source"
    );

    for (const file of await fs.readdir(directory)) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(directory, file);
      const document = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      const logicalId = `type.${slug(path.basename(file, ".json"))}`;
      document.document = "Item";
      document.crdType = "type";
      document.flags = {
        ...(document.flags ?? {}),
        cypherFoundry: {
          ...(document.flags?.cypherFoundry ?? {}),
          crd: {
            version: CRD_VERSION,
            logicalId,
            language,
            sourceKind: "record",
            section: `Character Creation — Type — ${document.name}`,
            sourceLocator: `CRD — Type: ${document.name}`,
            transformations: [
              "mechanical fields extracted from the CRD",
              "Type source retained as a structured Foundry Item"
            ],
            ...(language === "fr" ? { sourceLogicalId: logicalId } : {})
          }
        }
      };

      await fs.writeFile(
        filePath,
        JSON.stringify(document, null, 2) + "\n"
      );
    }
  }
}

/**
 * Normalize bilingual Focus records in the configured checkout.
 * Writes only the configured source checkout; callers validate in temporary storage.
 * @returns {Promise<void>} Resolves after source writes; errors propagate.
 */
export async function normalizeFocusSources() {
  for (const language of LANGUAGES) {
    const directory = path.join(
      root,
      "packs",
      `foci-${language}`,
      "_source"
    );

    for (const file of await fs.readdir(directory)) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(directory, file);
      const document = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (document._key?.startsWith("!folders!")) continue;

      const logicalId = `focus.${slug(path.basename(file, ".json"))}`;
      document.document = "Item";
      document.crdType = "focus";
      document.flags = {
        ...(document.flags ?? {}),
        cypherFoundry: {
          ...(document.flags?.cypherFoundry ?? {}),
          crd: {
            version: CRD_VERSION,
            logicalId,
            language,
            sourceKind: "record",
            section: `Character Creation — Focus — ${document.name} — Abilities`,
            sourceLocator: `CRD — Focus: ${document.name}`,
            transformations: [
              "mechanical fields extracted from the CRD",
              "Focus abilities represented as standalone Ability UUID references"
            ],
            ...(language === "fr" ? { sourceLogicalId: logicalId } : {})
          }
        }
      };

      await fs.writeFile(filePath, JSON.stringify(document, null, 2) + "\n");
    }
  }
}
