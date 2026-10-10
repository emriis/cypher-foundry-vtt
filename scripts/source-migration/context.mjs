/** Shared repository paths and CRD revision; helpers never choose a different source authority. */
import path from "node:path";
export const root = path.resolve(import.meta.dirname, "../..");
export const LANGUAGES = ["en", "fr"];
export const PARENT_PACKS = ["types", "foci"];
export const CRD_VERSION = "2026-07-29";
export const EDITORIAL_ARTIFACT_IDS = new Set(["fecb5c4df49a4667"]);
