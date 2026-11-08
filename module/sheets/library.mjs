/** Library navigation presents canonical compendium content without importing it.
 * Editorial help stays outside source Journal pages; task/cypher mechanics are
 * delegated to the existing dialogs and services rather than duplicated here.
 */
import { libraryIndex, libraryDocument, libraryActors, libraryGMActors, canCreateLibraryShortcut, createLibraryShortcut } from "../applications/library-service.mjs";
import { drawCypher } from "../applications/cypher-generation-service.mjs";
import { resolveDocumentReference } from "../applications/reference-resolver.mjs";
import { promptRollOptions } from "./dialogs.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const label = key => game.i18n.localize(`CYPHER.Library.${key}`);
const escape = value => foundry.utils.escapeHTML(String(value ?? ""));
let library;

/** Open one reusable client-local window. Content language never rewrites world data. */
export function openLibrary() {
  library ??= new CypherLibrary();
  return library.render({ force: true });
}

/** Collect the actual PC and stat before invoking the standard task workflow.
 * Cancellation at either dialog leaves resources and chat unchanged.
 */
export async function promptLibraryTask() {
  const actors = libraryActors();
  if (!actors.length) { ui.notifications.warn(label("NoActor")); return null; }
  const choice = await DialogV2.prompt({ rejectClose: false, window: { title: label("Task") },
    content: `<label>${label("Actor")}<select name="actor">${actors.map((actor, index) =>
      `<option value="${index}">${escape(actor.name)}${actor.isToken ? ` · ${label("Token")}` : ""}</option>`).join("")}</select></label>
      <label>${label("Stat")}<select name="stat">${["might", "speed", "intellect"].map(stat =>
      `<option value="${stat}">${game.i18n.localize(`CYPHER.Stat.${stat}`)}</option>`).join("")}</select></label>`,
    ok: { label: label("Continue"), callback: (_event, button) => ({
      index: Number(button.form.elements.actor.value), stat: button.form.elements.stat.value
    }) } });
  if (!choice) return null;
  const actor = actors[choice.index];
  if (!actor?.isOwner || !["might", "speed", "intellect"].includes(choice.stat)) return null;
  const options = await promptRollOptions(actor, { stat: choice.stat });
  if (!options || !actor.isOwner) return null;
  return actor.rollTask({ stat: choice.stat, ...options });
}

/** Preview existing CRD generation only. No award, world Item or chat message is created. */
export async function promptLibraryDraw(language) {
  if (!game.user.isGM || !["en", "fr"].includes(language)) return null;
  const table = await DialogV2.prompt({ rejectClose: false, window: { title: label("Draw") },
    content: `<p>${label("DrawHint")}</p><label>${game.i18n.localize("CYPHER.CypherLife.table")}<select name="table">${["subtle", "manifest", "superhero"].map(key =>
      `<option value="${key}">${game.i18n.localize(`CYPHER.CypherLife.${key}`)}</option>`).join("")}</select></label><p>${game.i18n.localize("CYPHER.CypherLife.superheroHint")}</p>`,
    ok: { label: label("Draw"), callback: (_event, button) => button.form.elements.table.value } });
  if (!table) return null;
  const result = await drawCypher(table, { language, superheroConfirmed: table === "superhero" });
  if (!result) { ui.notifications.warn(label("Unavailable")); return null; }
  const document = await resolveDocumentReference(result.uuid, "cypher");
  if (!document?.testUserPermission(game.user, "OBSERVER")) return null;
  const content = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
    `<p>@UUID[${document.uuid}]{${escape(result.name)}}</p><p>${result.rolls.map(roll =>
      `${escape(game.i18n.localize(`CYPHER.CypherLife.${roll.table}`))}: ${roll.value}`).join(" · ")}</p><p>${label("DrawHint")}</p>`, { secrets: false });
  await DialogV2.prompt({ rejectClose: false, window: { title: label("Draw") }, content, ok: { label: label("Close") } });
  return result;
}

/** Select a current actual Actor before opening its existing sheet. This is a
 * navigation aid only: no gameplay action, resource spend or document creation.
 * Revalidate after the dialog so a revoked permission or stale token is rejected.
 */
export async function promptLibraryGMSheet() {
  const actors = libraryGMActors();
  if (!actors.length) { ui.notifications.warn(label("NoGMActor")); return null; }
  const choice = await DialogV2.prompt({ rejectClose: false, window: { title: label("OpenSheet") },
    content: `<label>${label("Actor")}<select name="actor">${actors.map((actor, index) =>
      `<option value="${index}">${escape(actor.name)} · ${game.i18n.localize(`TYPES.Actor.${actor.type}`)}${actor.isToken ? ` · ${label("Token")}` : ""}</option>`).join("")}</select></label>`,
    ok: { label: label("OpenSheet"), callback: (_event, button) => Number(button.form.elements.actor.value) } });
  if (choice === null || choice === undefined || !Number.isInteger(choice)) return null;
  const actor = actors[choice];
  if (!actor || !libraryGMActors().includes(actor)) return null;
  await actor.sheet.render(true);
  return actor;
}

/** Reference chapters and practical resources share permission-checked reading. */
export class CypherLibrary extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "cypher-library", classes: ["cypher", "sheet", "cypher-library"],
    position: { width: 740, height: 720 }, window: { title: "CYPHER.Library.Title", resizable: true },
    actions: { reference: CypherLibrary.reference, language: CypherLibrary.language, page: CypherLibrary.page,
      task: CypherLibrary.task, draw: CypherLibrary.draw, gmSheet: CypherLibrary.gmSheet, shortcut: CypherLibrary.shortcut }
  };
  static PARTS = { content: { template: "systems/cypher/templates/library/home.hbs" } };
  contentLanguage = game.i18n.lang.startsWith("fr") ? "fr" : "en";
  selectedKey = null;
  selectedPageId = null;

  async _prepareContext() {
    const entries = await libraryIndex(this.contentLanguage);
    const document = this.selectedKey ? await libraryDocument(this.selectedKey, this.contentLanguage) : null;
    const pages = document?.documentName === "JournalEntry" ? document.pages.contents
      .filter(page => page.type === "text" && page.testUserPermission(game.user, "OBSERVER"))
      .sort((left, right) => left.sort - right.sort) : [];
    const enrich = (html, relativeTo) => foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { secrets: false, relativeTo });
    // Pagination and editorial labels come from the allowlisted destination,
    // never inferred from arbitrary Journal prose or world document flags.
    const section = entries.find(entry => entry.key === this.selectedKey)?.section;
    const editorial = ["guide", "cards", "gm"].includes(section);
    const paginated = section === "chapter" || editorial;
    const currentPage = pages.find(page => page.id === this.selectedPageId) ?? pages[0];
    const sourcePages = await Promise.all((paginated ? [currentPage].filter(Boolean) : pages)
      .map(async page => ({ name: page.name, html: await enrich(page.text.content, page) })));
    const navigation = entry => ({ ...entry, name: entry.name ?? label("Unavailable"), selected: entry.key === this.selectedKey });
    return { language: this.contentLanguage, english: this.contentLanguage === "en", french: this.contentLanguage === "fr",
      chapters: entries.filter(entry => entry.section === "chapter").map(navigation),
      guides: entries.filter(entry => entry.section === "guide").map(navigation),
      gmGuides: entries.filter(entry => entry.section === "gm").map(navigation),
      references: entries.filter(entry => entry.documentName === "JournalEntry" && ["quick", "cards"].includes(entry.section)).map(navigation),
      pageNavigation: paginated ? pages.map(page => ({ id: page.id, name: page.name, selected: page === currentPage })) : [],
      editorial, selectionLabel: label(editorial ? "PracticalResource" : "Canonical"),
      sourcePages, selectedName: document?.name, selected: Boolean(document),
      sourceLink: document ? await enrich(`@UUID[${document.uuid}]{${escape(document.name)}}`, document) : "",
      skillLink: entries.find(entry => entry.key === "athletics")?.uuid
        ? await enrich(`@UUID[${entries.find(entry => entry.key === "athletics").uuid}]{${escape(entries.find(entry => entry.key === "athletics").name)}}`) : "",
      canShortcut: canCreateLibraryShortcut(), isGM: game.user.isGM,
      unavailable: Boolean(this.selectedKey && !document) };
  }

  static async reference(_event, target) { this.selectedKey = target.dataset.key; this.selectedPageId = null; await this.render(); }
  static async page(_event, target) { this.selectedPageId = target.dataset.pageId; await this.render(); }
  static async language(_event, target) {
    if (!["en", "fr"].includes(target.dataset.language)) return;
    this.contentLanguage = target.dataset.language;
    await this.render();
  }
  static async task() { await promptLibraryTask(); }
  static async draw() { await promptLibraryDraw(this.contentLanguage); }
  static async gmSheet() { await promptLibraryGMSheet(); }
  static async shortcut() {
    const macro = await createLibraryShortcut();
    if (!macro) { ui.notifications.warn(label("ShortcutDenied")); return; }
    ui.notifications.info(label("ShortcutHint"));
    await macro.sheet.render(true);
  }
}

/** Register a native sidebar entry, independent of script-macro permission. */
export function registerLibraryButton() {
  Hooks.on("renderJournalDirectory", (_app, html) => {
    const container = html instanceof HTMLElement ? html : html?.[0];
    if (!container || container.querySelector(".cypher-library-button")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cypher-library-button";
    button.textContent = label("Title");
    button.addEventListener("click", () => openLibrary());
    (container.querySelector(".header-actions") ?? container.querySelector(".directory-header") ?? container).appendChild(button);
  });
}
