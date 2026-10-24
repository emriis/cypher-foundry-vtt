/**
 * Construct French compendium documents from canonical English documents.
 * No French _source directory is read or generated: translations/fr owns prose,
 * while the English source owns identities, rules, relationships and provenance.
 */
export function frenchReference(value) {
  if (typeof value === "string") {
    return value.replace(/Compendium\.cypher\.([a-z-]+)-en\.(Item|JournalEntry)\./g,
      "Compendium.cypher.$1-fr.$2.");
  }
  if (Array.isArray(value)) return value.map(frenchReference);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) =>
      [key, frenchReference(child)]));
  }
  return value;
}

export function deriveFrenchCatalogue(englishRecords) {
  const records = [];
  for (const record of englishRecords) {
    if (!record.pack.endsWith("-en")) {
      throw new Error("French input must derive exclusively from English sources: " + record.pack);
    }
    const source = record.document;
    const id = source.flags?.cypherFoundry?.crd?.logicalId;
    if (!id || record.logicalId !== id) {
      throw new Error("Missing canonical CRD identity: " + record.file);
    }
    const document = frenchReference(structuredClone(source));
    document.flags.cypherFoundry.crd.language = "fr";
    document.flags.cypherFoundry.crd.sourceLogicalId = id;
    records.push({
      ...record,
      pack: record.pack.replace(/-en$/, "-fr"),
      file: record.file.replace(/-en\/_source\//, "-fr/_source/"),
      document
    });
  }
  return records;
}
