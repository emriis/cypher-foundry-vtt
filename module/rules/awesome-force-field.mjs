/** CRD 3363–3365 and Force Field cypher 7017–7019. */
export const FORCE_FIELD_SHAPES = ["cube", "sphere", "wall", "path"];
export const shatterCost = (remainingEdge, natural20 = false) => natural20 ? 0 : Math.max(0, 5 - remainingEdge);
/** Personal fields never count toward the escalating remote-field allocation. */
export const barrierEffort = active => Number.isSafeInteger(active) && active >= 0 ? active + 1 : null;
