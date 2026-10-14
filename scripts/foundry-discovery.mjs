/**
 * Foundry VTT application discovery helpers used by the live E2E runner.
 *
 * Discovery is kept separate from the runner so installation-path behavior can
 * be tested without starting Foundry.
 */
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WINDOWS_EXECUTABLE = "Foundry Virtual Tabletop.exe";

/**
 * Build an ordered list of installation paths without touching the filesystem.
 * An explicit FOUNDRY_APP_PATH takes precedence over platform defaults. Windows
 * accepts either the executable itself or its containing installation folder.
 * @param {object} [options={}] Platform, environment, and home-directory inputs.
 * @returns {string[]} Candidate executable paths, in lookup order.
 */
export function getApplicationCandidates({
  platform = process.platform,
  env = process.env,
  homeDirectory = os.homedir()
} = {}) {
  if (env.FOUNDRY_APP_PATH) {
    const configuredPath = path.resolve(env.FOUNDRY_APP_PATH);
    return platform === "win32"
      ? [
          configuredPath,
          path.join(configuredPath, WINDOWS_EXECUTABLE)
        ]
      : [configuredPath];
  }

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA ||
      path.join(homeDirectory, "AppData", "Local");
    const programFiles = env.ProgramFiles || "C:\\Program Files";

    return [
      // Current per-user Windows installs live under LocalAppData/Programs.
      // Prefer that location over an older system-wide installation left behind.
      path.join(localAppData, "Programs", "Foundry Virtual Tabletop", WINDOWS_EXECUTABLE),
      path.join(
        localAppData,
        "Foundry Virtual Tabletop",
        WINDOWS_EXECUTABLE
      ),
      path.join(localAppData, "FoundryVTT", WINDOWS_EXECUTABLE),
      path.join(
        programFiles,
        "Foundry Virtual Tabletop",
        WINDOWS_EXECUTABLE
      ),
      path.join(programFiles, "FoundryVTT", WINDOWS_EXECUTABLE),
      path.join(
        programFiles,
        "FoundryVTT",
        "Foundry Virtual Tabletop",
        WINDOWS_EXECUTABLE
      )
    ];
  }

  if (platform === "darwin") {
    return [
      "/Applications/Foundry Virtual Tabletop.app/Contents/MacOS/Foundry Virtual Tabletop"
    ];
  }

  return ["/usr/bin/foundryvtt", "/usr/local/bin/foundryvtt"];
}

/**
 * Choose the first candidate that exists as a file; never launch it here.
 * @param {object} [options={}] Inputs passed to the candidate builder.
 * @returns {Promise<string>} Application path; throws when no candidate exists.
 */
export async function findApplication(options = {}) {
  const candidates = getApplicationCandidates(options);

  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // Try the next known installation path.
    }
  }

  throw new Error(
    "Foundry VTT executable was not found. Checked:\n" +
    candidates.map(candidate => `  - ${candidate}`).join("\n") +
    "\nSet FOUNDRY_APP_PATH to the executable path (or its installation " +
    "directory) to use a custom Foundry installation."
  );
}

/**
 * Locate the Node entry point without launching or modifying the installation.
 * FOUNDRY_SERVER_PATH explicitly selects a standalone app's main.js/main.mjs
 * and bypasses desktop discovery. Otherwise retain the desktop resources path.
 * An invalid explicit selection throws instead of switching installations.
 * @param {object} [options={}] Application-discovery inputs and environment.
 * @returns {Promise<string>} Absolute existing Node server entry point.
 */
export async function findServer(options = {}) {
  const env = options.env ?? process.env;
  const serverPath = env.FOUNDRY_SERVER_PATH
    ? path.resolve(env.FOUNDRY_SERVER_PATH)
    : path.join(path.dirname(await findApplication(options)), "resources", "app", "main.js");
  if (!["main.js", "main.mjs"].includes(path.basename(serverPath))) {
    throw new Error("FOUNDRY_SERVER_PATH must identify Foundry's main.js or main.mjs entry point.");
  }
  try {
    if ((await stat(serverPath)).isFile()) return serverPath;
  } catch {
    // Report the selected path; never fall back to a different app silently.
  }
  throw new Error(`Foundry Node server was not found: ${serverPath}`);
}

/**
 * Read the release belonging to the selected server, keeping world metadata and
 * the launched app aligned. Standalone packages can expose generation/build
 * instead of version; an explicit environment value is the last fallback.
 * @param {string} serverPath Absolute Foundry Node entry point.
 * @param {object} [options={}] Environment used for the version fallback.
 * @returns {Promise<string>} Core version, or throws when it cannot be determined.
 */
export async function readCoreVersion(serverPath, { env = process.env } = {}) {
  try {
    const data = JSON.parse(await readFile(path.join(path.dirname(serverPath), "package.json"), "utf8"));
    if (typeof data.version === "string" && data.version.trim()) return data.version;
    const { generation, build } = data.release ?? {};
    if (Number.isInteger(generation) && Number.isInteger(build)) return `${generation}.${build}`;
  } catch {
    // Fall back to explicit metadata when the selected package is unavailable.
  }
  if (env.FOUNDRY_CORE_VERSION) return env.FOUNDRY_CORE_VERSION;
  throw new Error("Unable to determine the Foundry core version. Set FOUNDRY_CORE_VERSION explicitly.");
}
