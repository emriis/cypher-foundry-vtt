/** Apply only the incremental update forms used by service fixtures, without cleaning or preparation. */
export function applyDocumentUpdate(document, changes) {
  function merge(target, patch) {
    for (const [key, value] of Object.entries(patch)) {
      if (key.startsWith("-=")) { delete target[key.slice(2)]; continue; }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        target[key] ??= {};
        merge(target[key], value);
      } else target[key] = structuredClone(value);
    }
  }
  for (const [key, value] of Object.entries(changes)) {
    const parts = key.split(".");
    let target = document;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    merge(target, { [parts.at(-1)]: value });
  }
  return document;
}
