/** CRD 2026-07-29: permanent follower grants from Builds Allies, Controls Beasts,
 * Explores, Leads, Talks to Machines and genre Retainer/Beast Companion.
 * Paragraphs identify the supplied CRD; keys are technical Ability identifiers.
 */
const grant = (family, level, count = 1, profile = {}) => ({ family, level, count, ...profile });
const followerFamilies = ["follower", "beast", "mount", "automaton", "machine", "retainer"];
export const FOLLOWER_ABILITIES = {
  "automaton-assistant": { paragraphs: [3578], grants: [grant("automaton", 2)], limit: 1 },
  "automaton-fleet": { paragraphs: [3599], grants: [grant("automaton", 2, 4)], limit: 1 },
  "beast-companion": { paragraphs: [883, 3921, 3923, 4115], grants: [grant("beast", 2)] },
  "retainer": { paragraphs: [2336], grants: [grant("retainer", 2)], limit: 1 },
  "basic-follower": { paragraphs: [4488, 4489], grants: [grant("follower", 2, 1, { tasks: 2, taskLevel: 3, charm: true })] },
  "expert-follower": { paragraphs: [4501, 4502, 4503], grants: [grant("follower", 3, 1, { tasks: 3, taskLevel: 4 })],
    alternative: { grants: [grant("follower", 2)], upgrade: { families: followerFamilies, below: 3, to: 3, count: 1 } } },
  "band-of-followers": { paragraphs: [4516, 4517], grants: [grant("follower", 3, 4, { tasks: 3, taskLevel: 4 })], limit: 1,
    alternative: { grants: [grant("follower", 2, 4)], upgrade: { families: followerFamilies, levels: [2], to: 3, count: 4 } } },
  "expert-automaton": { paragraphs: [3590, 3591, 3592], grants: [grant("automaton", 3)],
    alternative: { grants: [grant("automaton", 2)], upgrade: { families: ["automaton"], levels: [2, 3], add: 1, count: 1 } } },
  "mount": { paragraphs: [3936, 3937], grants: [grant("mount", 3)], limit: 1,
    alternative: { grants: [grant("beast", 2)], upgrade: { families: ["beast"], atMost: 3, to: 3, family: "mount", count: 1 } } },
  "machine-companion": { paragraphs: [5063], grants: [grant("machine", 3)], limit: 1 },
  "improved-machine-companion": { paragraphs: [5067], grants: [grant("machine", 5)], limit: 1,
    alternative: { grants: [], upgrade: { families: ["machine"], below: 5, to: 5, count: 1 } } },
  "automaton-evolution": { paragraphs: [3603], grants: [], upgrade: { families: ["automaton"], add: 1, count: 1 } },
  "improved-companion": { paragraphs: [3944], grants: [], limit: 3, upgrade: { families: ["beast", "mount"], add: 1, count: 1, modifiesTasks: true } },
  "improved-follower": { paragraphs: [4512, 4513], grants: [], oncePerTier: true,
    upgrade: { families: followerFamilies, add: 1, count: 1, newTask: true, modifiesTasks: true } }
};

/** Select one complete grant/upgrade alternative; callers cannot supply arbitrary quantities. */
export function followerAbilityPlan(key, variant = "new") {
  const rule = Object.hasOwn(FOLLOWER_ABILITIES, key) ? FOLLOWER_ABILITIES[key] : null;
  if (!rule || !["new", "upgrade"].includes(variant) || variant === "upgrade" && !rule.alternative) return null;
  const { alternative, ...base } = rule;
  return globalThis.structuredClone({ ...base, ...(variant === "upgrade" ? alternative : {}) });
}

/** Upgrade only an explicitly source-bound family and a source-permitted current level. */
export function followerUpgradeDelta(upgrade, family, level) {
  if (!upgrade?.families.includes(family) || !Number.isSafeInteger(level) || level < 1
    || upgrade.levels && !upgrade.levels.includes(level) || upgrade.below !== undefined && level >= upgrade.below
    || upgrade.atMost !== undefined && level > upgrade.atMost) return null;
  return upgrade.add ?? upgrade.to - level;
}
