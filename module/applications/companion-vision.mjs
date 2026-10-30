/** Beast Eyes adds a native vision source, never ownership or control of the beast's token. */
import { liveCompanionEffects } from "./companion-upgrade-read.mjs";

/** Explicit token and range declarations remain necessary; hidden/off-level tokens keep core restrictions. */
export function beastEyesVision(token) {
  const document = token?.document, scene = globalThis.canvas?.scene, user = globalThis.game?.user;
  if (!document || !user || !globalThis.canvas?.visibility?.tokenVision || document.parent?.id !== scene?.id
    || document.hidden && !user.isGM || document.level && document.level !== canvas.level?.id) return false;
  const actors = [...(game.actors?.contents ?? []), ...(canvas.tokens?.placeables ?? []).map(placeable => placeable.actor)];
  return actors.some(owner => owner?.type === "pc" && owner.testUserPermission?.(user, "OWNER")
    && liveCompanionEffects(owner).some(effect => {
      if (effect.key !== "beast-eyes" || !effect.withinRange || effect.visionTokenUuid !== document.uuid || effect.npcUuid !== token.actor?.uuid) return false;
      const context = owner.flags?.cypher?.companionContext;
      return context?.id === effect.sensoryContext && context.state === "active" && context.npcUuid === effect.npcUuid
        && context.alive && (!context.calmed || context.friendly);
    }));
}

/** Foundry V13/V14 Token extension: native profiles, blindness and source initialization remain in core. */
export function createCompanionTokenClass(Base) {
  return class CompanionToken extends Base {
    get hasSight() { return super.hasSight || beastEyesVision(this); }
    _isVisionSource() { return super._isVisionSource() || beastEyesVision(this); }
  };
}

const sharedSources = new Set();
/** Re-evaluate on an actual Actor/time/scene update, including expiration after reload. */
export function refreshCompanionVision() {
  if (!globalThis.canvas?.ready) return;
  const previous = new Set(sharedSources); sharedSources.clear();
  for (const token of canvas.tokens.placeables) {
    const active = beastEyesVision(token);
    if (active) sharedSources.add(token.document.uuid);
    if (active || previous.has(token.document.uuid)) token.initializeVisionSource();
  }
}
