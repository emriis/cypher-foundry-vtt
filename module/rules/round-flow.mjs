/** CRD 7645–7693: per-round execution order, separate from rolled initiative. */
export const ROUND_MODES = ["normal", "first", "last", "prepare", "wait"];

/** Build a fresh round in initiative order; prior preparation can grant an optional First action. */
export function createRoundFlow(ids, plans = [], round = 1, prepared = []) {
  if (!Number.isSafeInteger(round) || round < 1 || new Set(ids).size !== ids.length
    || plans.some(plan => !ids.includes(plan.combatantId) || !ROUND_MODES.includes(plan.mode))
    || new Set(plans.map(plan => plan.combatantId)).size !== plans.length) return null;
  const choices = ids.map(id => {
    const ready = prepared.some(entry => entry.combatantId === id && entry.round === round);
    const plan = plans.find(entry => entry.combatantId === id) ?? { combatantId: id, mode: ready ? "first" : "normal", confirmed: ready };
    if (["first", "last", "prepare"].includes(plan.mode) && plan.confirmed !== true) return null;
    return { ...plan, readied: ready };
  });
  if (choices.includes(null)) return null;
  const queue = [];
  const add = (plan, phase) => queue.push({ id: `${round}:${plan.combatantId}:${phase}`, combatantId: plan.combatantId,
    phase, readied: plan.readied, used: false, activityUsed: false, done: false });
  for (const plan of choices.filter(plan => plan.mode === "first")) add(plan, "first");
  for (const plan of choices.filter(plan => ["normal", "prepare"].includes(plan.mode))) add(plan, plan.mode);
  for (const plan of choices.filter(plan => plan.mode === "first")) add(plan, "followUp");
  for (const plan of choices.filter(plan => plan.mode === "last")) add(plan, "last");
  return { version: 1, round, plans: choices, queue, cursor: -1, entered: [], prepared: [], revision: 0,
    rewindAnchor: null, shieldLosses: [],
    waiting: choices.filter(plan => plan.mode === "wait").map(plan => ({ combatantId: plan.combatantId,
      trigger: plan.trigger ?? "", phase: "normal" })), nextPlans: [], history: [] };
}

/** Decide what an accepted task may consume; defenses and paid rerolls are handled outside this rule. */
export function roundActionKind(flow, combatantId, { isAttack = false, actionTiming = null,
  minorActivity = false, extraAction = false } = {}) {
  const step = flow?.queue?.[flow.cursor];
  if (!step || step.combatantId !== combatantId || step.done || step.phase === "prepare") return null;
  if (minorActivity) return !isAttack && ["normal", "followUp"].includes(step.phase) && !step.activityUsed ? "activity" : null;
  if (step.phase === "followUp") return null;
  if (!extraAction && step.used) return null;
  if (step.phase === "first" && actionTiming && actionTiming !== "firstAction" && !step.readied) return null;
  if (step.phase === "last" && actionTiming && actionTiming !== "lastAction" && !extraAction) return null;
  if (actionTiming === "lastAction" && step.phase !== "last" && !(step.phase === "first" && step.readied)) return null;
  return extraAction ? "extra" : "primary";
}

/** Move an unspent ordinary turn into the waiting list without duplicating its follow-up. */
export function holdRoundTurn(flow, trigger = "") {
  const step = flow.queue[flow.cursor];
  if (!step || step.phase !== "normal" || step.used || step.activityUsed || step.done) return null;
  return { ...flow, queue: flow.queue.filter(entry => entry.id !== step.id), cursor: flow.cursor - 1,
    waiting: [...flow.waiting, { combatantId: step.combatantId, phase: "normal", trigger }], revision: flow.revision + 1 };
}

/** Insert a waiting turn immediately before the declared event/current turn. */
export function resumeRoundTurn(flow, combatantId, triggerConfirmed = false) {
  const waiting = flow.waiting.find(entry => entry.combatantId === combatantId);
  if (!waiting || waiting.trigger && !triggerConfirmed) return null;
  const queue = flow.queue.map(entry => ({ ...entry }));
  const cursor = Math.max(0, flow.cursor);
  queue.splice(cursor, 0, { id: `${flow.round}:${combatantId}:normal`, combatantId,
    phase: "normal", used: false, activityUsed: false, done: false });
  return { ...flow, queue, cursor, waiting: flow.waiting.filter(entry => entry !== waiting), revision: flow.revision + 1 };
}

/** Complete one slot; preparing a whole round creates eligibility only for the following round. */
export function completeRoundStep(flow) {
  const queue = flow.queue.map(entry => ({ ...entry })), step = queue[flow.cursor];
  const prepared = [...flow.prepared];
  if (step && !step.done) {
    step.done = true;
    if (step.phase === "prepare") prepared.push({ combatantId: step.combatantId, round: flow.round + 1 });
  }
  return { ...flow, queue, prepared, cursor: flow.cursor + 1, revision: flow.revision + 1 };
}
