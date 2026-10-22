/** Render persisted intrusion state without coupling settlement to a sheet or dialog. */
export const intrusionLabel = key => game.i18n.localize(`CYPHER.Intrusion.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));

/** The same card is updated after settlement; an announcement failure cannot mint another award. */
export function intrusionMessageContent(record) {
  return `<div class="cypher-intrusion-card"><h3>${intrusionLabel(record.kind)}</h3>
    <p>${escape(record.sourceName)}</p><p>${escape(record.description)}</p>
    <p class="intrusion-state">${intrusionLabel(record.state)}</p>
    ${record.recipientName ? `<p>${intrusionLabel("Recipient")}: ${escape(record.recipientName)}</p>` : ""}
    <p>${intrusionLabel(["gm", "choice"].includes(record.kind) ? "ShareHint" : record.kind === "gmFree" ? "FreeHint" : "PlayerHint")}</p></div>`;
}
