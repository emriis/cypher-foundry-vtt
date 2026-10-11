/**
 * Check explicit source headers without deriving mechanics from descriptive
 * prose. Base costs are only one part of a rule: additional wounds, Effort,
 * escalation, targets, and prerequisites need their own reviewed contracts.
 */

/**
 * Compare a stored Ability base cost with source occurrences whose complete
 * description already matched. Complex headers stay visible for human review.
 * @param {object} system Authored Ability fields.
 * @param {object[]} paragraphs Independently matched CRD paragraph records.
 * @returns {object} Evidence status, source headers, and any cost mismatch.
 */
export function auditAbilityBaseCost(system, paragraphs) {
  const headers = paragraphs.map(paragraph => ({
    text: paragraph.text.split(":", 1)[0], index: paragraph.index, section: paragraph.section
  }));
  const parsed = headers.flatMap(header => {
    const match = / \((\d+)\+? (Might|Speed|Intellect)(?: or (Might|Speed|Intellect))?\)$/.exec(header.text);
    return match ? [{ ...header, amount: Number(match[1]), stats: [match[2], match[3]].filter(Boolean).map(value => value.toLowerCase()) }] : [];
  });
  if (!parsed.length) return { status: "not-checked", headers,
    limitation: "No supported explicit Pool-cost header; do not infer missing or complex costs." };
  const cost = system.cost ?? {};
  const stats = cost.stat === "choice" ? cost.options ?? [] : [cost.stat];
  const matches = parsed.some(header => header.amount === cost.amount
    && new Set(stats).size === header.stats.length && header.stats.every(stat => stats.includes(stat)));
  return { status: matches ? "checked-base-cost" : "base-cost-mismatch", headers: parsed,
    ...(matches ? {} : { storedCost: cost }),
    limitation: "Base Pool cost only; variable costs, Effort, and extra consequences are not certified." };
}
