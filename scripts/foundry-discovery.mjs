/**
 * Foundry VTT application discovery helpers used by the live E2E runner.
 *
 * Discovery is kept separate from the runner so installation-path behavior can
 * be tested without starting Foundry.
 */
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const WINDOWS_EXECUTABLE = "Foundry Virtual Tabletop.exe";

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
      path.join(programFiles, "FoundryVTT", WINDOWS_EXECUTABLE)
    ];
  }

  if (platform === "darwin") {
    return [
      "/Applications/Foundry Virtual Tabletop.app/Contents/MacOS/Foundry Virtual Tabletop"
    ];
  }

  return ["/usr/bin/foundryvtt", "/usr/local/bin/foundryvtt"];
}

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
