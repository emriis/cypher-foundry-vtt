/** Compare source identities and structured mechanics without treating localization as a rule change.
 * Pure Node tooling calculations: these helpers do not read or write source files.
 */
import crypto from "node:crypto";
import { CRD_VERSION } from "./context.mjs";
import { plainText } from "../crd-audit/text-fidelity.mjs";

/**
 * Produce the SHA-256 signature used for deterministic source identities.
 * @param {string} value Source identity or migration input.
 * @returns {string} Lowercase hexadecimal SHA-256 digest.
 */
export function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Normalize a source identity component to lowercase ASCII words.
 * @param {string} value Source identity or migration input.
 * @returns {string} Hyphen-separated ASCII key component.
 */
export function slug(value) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Read only an explicit terminal CRD action marker; do not infer timing from an effect.
 * @param {object} ability Authored Ability data.
 * @returns {string|null} "firstAction", "lastAction", "action", or no explicit action.
 */
export function inferAction(ability) {
  if (ability.enabler) return null;

  const text = String(ability.description ?? "")
    .replace(/<[^>]+>/g, " ")
    .trim();

  if (/\bFirst action\.\s*$/i.test(text)) return "firstAction";
  if (/\bLast action\.\s*$/i.test(text)) return "lastAction";
  if (/\bAction\.\s*$/i.test(text)) return "action";
  return null;
}

// Names and prose vary between languages. Removing them makes identity checks
// compare structured mechanics instead of treating a translation as a new rule.
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

/**
 * Build a conservative English source-definition identity.
 * Partial structured fields cannot prove equivalence for rules still in prose.
 * Keep the English definition as evidence; never parse it into inferred mechanics.
 * French pairing removes this source text and uses explicit reference/ID pairs.
 * @param {object} ability Authored Ability data.
 * @returns {object} Structured mechanics plus the preserved English definition.
 */
export function contentIdentityShape(ability) {
  return {
    mechanics: stripEditorial(mechanicalShape(ability)),
    description: plainText(ability.description ?? "")
  };
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

/**
 * Identify editorial entries that must not become standalone playable Abilities.
 * @param {object} ability Authored Ability data.
 * @returns {boolean} Whether the entry is an intrusion/heading rather than a playable Ability.
 */
export function isEditorialArtifact(ability) {
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

/**
 * Compare translated mechanics while leaving tier/action differences to explicit pairing logic.
 * @param {object} ability Authored Ability data.
 * @returns {object} Pairing shape without names, descriptions, tier, or action.
 */
export function localizedPairingMechanicalShape(ability) {
  const shape = contentIdentityShapeWithoutDescription(ability);
  delete shape.mechanics.tier;
  delete shape.mechanics.action;
  return shape;
}

/**
 * Build the existing fallback comparison shape without inventing a translation match.
 * @param {object} ability Authored Ability data.
 * @returns {object} Pairing shape that also omits the enabler marker.
 */
export function localizedLooseMechanicalShape(ability) {
  const shape = localizedPairingMechanicalShape(ability);
  delete shape.mechanics.enabler;
  return shape;
}

/**
 * Combine a normalized source key and definition signature into stable technical identifiers.
 * @param {object} ability Authored Ability data.
 * @returns {{key: string, signature: string, id: string}} Source key, full definition digest, and 16-character Foundry ID.
 */
export function identity(ability) {
  const key = slug(ability.id || ability.name);
  const signature = hash(JSON.stringify(contentIdentityShape(ability)));
  return { key, signature, id: hash(`${key}\\0${signature}`).slice(0, 16) };
}

/**
 * Append a signature suffix only when a source key has distinct definitions.
 * @param {string} key Normalized source key.
 * @param {string} signature Full source-definition SHA-256 digest.
 * @param {number} variants Number of distinct definitions under that key.
 * @returns {string} Language-neutral logical ID used in CRD provenance.
 */
export function buildLogicalId(key, signature, variants) {
  const suffix = variants > 1 ? `-${signature.slice(0, 12)}` : "";
  return `ability.${key}${suffix}`;
}

function buildLocalizedLogicalId(key, sourceId, variants) {
  const suffix = variants > 1
    ? `-${hash(String(sourceId)).slice(0, 12)}`
    : "";
  return `ability.${key}${suffix}`;
}

/**
 * Describe the CRD source relationship preserved on the authored record.
 * @param {string} language "en" or "fr".
 * @param {string} parent Source family: "types", "foci", or "abilities".
 * @param {object} document Parent source record.
 * @param {object} ability Authored Ability data.
 * @param {string} logicalId Language-neutral Ability identity.
 * @returns {object} CRD version, section/locator, language, and recorded transformations.
 */
export function provenance(language, parent, document, ability, logicalId) {
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
