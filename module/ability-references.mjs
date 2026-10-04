/**
 * Shared identity helpers for standalone ability documents.
 *
 * Keep this module free of Foundry globals so source migration and runtime
 * DataModel migrations can use the same deterministic identity.
 */

export function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortObject(entry)])
  );
}

export function abilityMechanicalSignature(ability) {
  const intrinsic = { ...ability };
  delete intrinsic.id;
  delete intrinsic.name;
  delete intrinsic.prerequisites;
  delete intrinsic.description;
  return JSON.stringify(sortObject(intrinsic));
}

export function abilityDocumentId(ability) {
  const key = `${ability.id}:${abilityMechanicalSignature(ability)}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;

  for (let i = 0; i < key.length; i += 1) {
    const code = key.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  return (
    (h1 >>> 0).toString(36).padStart(8, "0") +
    (h2 >>> 0).toString(36).padStart(8, "0")
  ).slice(0, 16);
}

export function abilityPackForLanguage(language) {
  return language === "fr" ? "abilities-fr" : "abilities-en";
}

export function abilityUuid(ability, language) {
  return `Compendium.cypher.${abilityPackForLanguage(language)}.Item.${abilityDocumentId(ability)}`;
}
