import { importFromBuilder } from "./applications/import-service.mjs";

/**
 * Character Builder import UI and compatibility facade.
 *
 * Foundry dialogs, sidebar hooks, and the historical module/import.mjs API
 * stay here. Import orchestration and mapping live in the application service.
 */
export {
  importFromBuilder,
  buildActorData,
  extractFreelyUsableCategories,
  extractSpeciesAsDescriptor,
  mapItems,
  parseWoundsFromNotes
} from "./applications/import-service.mjs";

/**
 * Opens a file picker for a Character Builder JSON export and starts the import.
 */
export async function openImportDialog() {
  const content = `
    <div class="form-group">
      <label>${game.i18n.localize("CYPHER.Import.PickFile")}</label>
      <input type="file" name="file" accept=".json,application/json"/>
    </div>
    <p class="cypher-import-hint">${game.i18n.localize("CYPHER.Import.Hint")}</p>`;

  await foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize("CYPHER.Import.Title") },
    content,
    ok: {
      label: game.i18n.localize("CYPHER.Import.Button"),
      callback: async (event, button) => {
        const file = button.form.file?.files?.[0];
        if (!file) {
          ui.notifications.warn(game.i18n.localize("CYPHER.Import.NoFile"));
          return;
        }
        let jsonData;
        try {
          jsonData = JSON.parse(await file.text());
        } catch (err) {
          console.error("Cypher | Échec de la lecture du fichier d'import :", err);
          ui.notifications.error(game.i18n.localize("CYPHER.Import.ParseError"));
          return;
        }
        await importFromBuilder(jsonData);
      }
    }
  });
}

/**
 * Registers the Character Builder import button in the Actors directory.
 *
 * Registration is best-effort because Foundry's sidebar DOM can vary between
 * versions. The importer functions remain available to macros independently.
 */
export function registerImportButton() {
  Hooks.on("renderActorDirectory", (app, html) => {
    const container = html instanceof HTMLElement ? html : html?.[0];
    if (!container || container.querySelector(".cypher-import-button")) return;

    const target = container.querySelector(".header-actions")
      ?? container.querySelector(".directory-header")
      ?? container;
    if (!target) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "cypher-import-button";
    button.innerHTML = `<i class="fa-solid fa-file-import"></i> ${game.i18n.localize("CYPHER.Import.Button")}`;
    button.addEventListener("click", () => openImportDialog());
    target.appendChild(button);
  });
}
