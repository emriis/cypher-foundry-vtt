/** 
 * Builds a temporary checkout and starts Foundry in an isolated user-data
 * directory. The configured installation is read only for its license.
 */
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import { closeSync, openSync } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { findServer, readCoreVersion } from "./foundry-discovery.mjs";
import { foundryServerArguments } from "./foundry-server-options.mjs";
import { createValidationWorkspace, removeValidationWorkspace } from "./validation-workspace.mjs";

import { discoverTests } from "./test-suites.mjs";
import { extractArchive } from "./archive.mjs";
import { stopOwnedProcess, waitForOwnedServer } from "./process-lifecycle.mjs";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");
let ROOT = SOURCE_ROOT;
const PORT = Number(process.env.FOUNDRY_PORT || 30000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORLD_ID = `cypher-e2e-${Date.now()}`;
const WORLD_TITLE = "Cypher Automated E2E";
const FOUNDRY_PID_FILE = path.join(
  os.tmpdir(),
  `cypher-foundry-e2e-${process.pid}.pid`
);
const FOUNDRY_LOG_PATH = path.join(
  os.tmpdir(),
  `cypher-foundry-e2e-${process.pid}.log`
);
const SHOW_FOUNDRY_LOGS =
  process.argv.includes("--debug-foundry-logs") ||
  /^(1|true|yes)$/i.test(
    process.env.FOUNDRY_E2E_SHOW_FOUNDRY_LOGS || ""
  );
const INCLUDE_PROPOSED_TRANSLATIONS = process.argv.includes("--proposed-translations");
const E2E_SPECS = await discoverTests(SOURCE_ROOT, "e2e");

async function getFoundryPaths() {
  if (process.env.FOUNDRY_DATA_PATH) {
    const dataPath = path.resolve(process.env.FOUNDRY_DATA_PATH);
    return {
      userDataPath: path.dirname(dataPath),
      dataPath
    };
  }

  let userDataPath;

  if (process.platform === "win32") {
    userDataPath = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "FoundryVTT"
    );
    const optionsPath = path.join(userDataPath, "Config", "options.json");

    try {
      const options = JSON.parse(await readFile(optionsPath, "utf8"));
      if (typeof options.dataPath === "string" && options.dataPath.trim()) {
        const configuredPath = path.resolve(options.dataPath);
        if (path.basename(configuredPath).toLowerCase() === "data") {
          return {
            userDataPath: path.dirname(configuredPath),
            dataPath: configuredPath
          };
        }
        return {
          userDataPath: configuredPath,
          dataPath: path.join(configuredPath, "Data")
        };
      }
    } catch {
      // Fall back to Foundry's default user-data root.
    }
  } else if (process.platform === "darwin") {
    userDataPath = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "FoundryVTT"
    );
  } else {
    userDataPath = path.join(
      process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
      "FoundryVTT"
    );
  }

  return {
    userDataPath,
    dataPath: path.join(userDataPath, "Data")
  };
}

async function ensureDataPath(userDataPath, dataPath) {
  await mkdir(dataPath, { recursive: true });

  const licensePath = path.join(userDataPath, "Config", "license.json");
  try {
    await readFile(licensePath, "utf8");
  } catch {
    throw new Error(
      "Foundry license.json was not found in the Foundry Config directory. " +
      "Start Foundry once and complete license/EULA setup, or set " +
      "FOUNDRY_DATA_PATH to the correct Data directory."
    );
  }
}

async function installSystem(dataPath) {
  const target = path.join(dataPath, "systems", "cypher");
  if (!validationWorkspace || target !== path.join(validationWorkspace,
    "foundry-user-data", "Data", "systems", "cypher")) {
    throw new Error("Refusing to install outside the owned E2E workspace.");
  }

  // Never layer one E2E installation over a previous system copy. Stale
  // templates or modules can otherwise survive between test runs.
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await extractArchive(path.join(ROOT, "dist", "system.zip"), target);
  const installed = JSON.parse(await readFile(path.join(target, "system.json"), "utf8"));
  if (installed.id !== "cypher") throw new Error("Packaged system has an unexpected ID");
}

async function createWorld(dataPath, coreVersion, systemVersion) {
  const worldPath = path.join(dataPath, "worlds", WORLD_ID);
  await mkdir(path.join(worldPath, "data"), { recursive: true });

  const manifest = {
    id: WORLD_ID,
    title: WORLD_TITLE,
    description: "Disposable Cypher system E2E world.",
    version: "1.0.0",
    coreVersion,
    compatibility: {
      minimum: String(coreVersion).split(".")[0],
      verified: coreVersion
    },
    system: "cypher",
    systemVersion,
    type: "world",
    resetKeys: false,
    safeMode: false
  };

  await writeFile(
    path.join(worldPath, "world.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  return worldPath;
}

function spawnFoundry(serverPath, userDataPath) {
  const args = foundryServerArguments({ port: PORT, worldId: WORLD_ID, userDataPath });

  // Run Foundry's Node server instead of the Electron executable for E2E.
  // Playwright supplies the browser, so Electron provides no test value here.
  // This also removes the Windows elevation and Chromium/GPU lifecycle
  // problems caused by controlling a separately elevated Electron process.
  // Keep the runner output focused on Playwright by default. Foundry logs are
  // captured separately and the tail is shown automatically if E2E fails.
  // Set FOUNDRY_E2E_SHOW_FOUNDRY_LOGS=true to stream Foundry logs live.
  if (SHOW_FOUNDRY_LOGS) {
    return spawn(process.execPath, [serverPath, ...args], {
      cwd: path.dirname(serverPath),
      stdio: "inherit",
      windowsHide: true,
      shell: false
    });
  }

  const logFd = openSync(FOUNDRY_LOG_PATH, "w");
  try {
    return spawn(process.execPath, [serverPath, ...args], {
      cwd: path.dirname(serverPath),
      stdio: ["ignore", logFd, logFd],
      windowsHide: true,
      shell: false
    });
  } finally {
    closeSync(logFd);
  }
}

function quoteWindowsArg(value) {
  const stringValue = String(value);
  if (/^[A-Za-z0-9_./:-]+$/.test(stringValue)) {
    return stringValue;
  }
  return "\"" + stringValue + "\"";
}

function windowsCommand(command, args) {
  return [
    command,
    ...args.map(quoteWindowsArg)
  ].join(" ");
}

function spawnScript(command, args, options = {}) {
  if (process.platform === "win32" && /\.cmd$/i.test(command)) {
    return spawn(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", windowsCommand(command, args)],
      {
        cwd: ROOT,
        stdio: "inherit",
        windowsHide: true,
        shell: false,
        ...options
      }
    );
  }

  return spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    windowsHide: true,
    shell: false,
    ...options
  });
}

async function runCommand(command, args, options = {}) {
  const started = performance.now();
  await new Promise((resolve, reject) => {
    const childProcess = spawnScript(command, args, options);
    childProcess.on("error", reject);
    childProcess.on("close", code => {
      console.log(`${args.join(" ")}: ${((performance.now() - started) / 1000).toFixed(1)}s`);
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

async function removeWorld(worldPath) {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      await rm(worldPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  throw lastError;
}

async function showFoundryLogTailOnFailure() {
  if (SHOW_FOUNDRY_LOGS || exitCode === 0) return;

  let content;
  try {
    content = await readFile(FOUNDRY_LOG_PATH, "utf8");
  } catch {
    return;
  }

  const lines = content.trimEnd().split(/\r?\n/);
  const tail = lines.slice(-120).join("\n");
  console.error("\n--- Foundry log tail (last 120 lines) ---");
  console.error(tail || "(Foundry log is empty)");
  console.error("--- End Foundry log tail ---");
  console.error("Full Foundry log: " + FOUNDRY_LOG_PATH);
}

async function removeStaleE2EWorlds(dataPath) {
  const worldsPath = path.join(dataPath, "worlds");

  let entries;
  try {
    entries = await readdir(worldsPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  const staleWorlds = entries
    .filter(entry =>
      entry.isDirectory() &&
      entry.name.startsWith("cypher-e2e-")
    )
    .map(entry => path.join(worldsPath, entry.name));

  for (const worldPath of staleWorlds) {
    console.log(
      "Removing stale E2E world: " + path.basename(worldPath)
    );
    await removeWorld(worldPath);
  }
}

async function runWindowsTaskkill(pid, force = false) {
  const args = ["/pid", String(pid), "/t"];
  if (force) args.push("/f");

  await new Promise((resolve, reject) => {
    const killer = spawn(
      "taskkill",
      args,
      { stdio: "ignore", windowsHide: true }
    );
    killer.on("error", reject);
    killer.on("close", () => resolve());
  });
}

async function stopProcess(child, foundryPid) {
  if (!Number.isInteger(foundryPid) || foundryPid <= 0) return;
  // The existing child handle can terminate our Node server on Windows without
  // a separate taskkill process. Reserve tree escalation for a failed shutdown.
  await stopOwnedProcess(child, force => process.platform === "win32" && force
    ? runWindowsTaskkill(foundryPid, true)
    : child.kill(force ? "SIGKILL" : "SIGTERM"));
}

const serverPath = await findServer();
const { userDataPath: licenseSource } = await getFoundryPaths();
const coreVersion = await readCoreVersion(serverPath);
const systemManifest = JSON.parse(
  await readFile(path.join(ROOT, "system.json"), "utf8")
);

let child;
let foundryPid;
let worldCreated = false;
let worldPath;
let exitCode = 1;
let validationWorkspace;
let userDataPath;
let dataPath;

try {
  const isolated = await createValidationWorkspace(SOURCE_ROOT);
  // The user's installation supplies activation metadata only. All builds,
  // test-world documents, and system installation below live in our temp root.
  validationWorkspace = isolated.workspace;
  ROOT = isolated.root;
  userDataPath = path.join(validationWorkspace, "foundry-user-data");
  dataPath = path.join(userDataPath, "Data");
  await mkdir(path.join(userDataPath, "Config"), { recursive: true });
  // Copy activation metadata without printing it or copying user settings/worlds.
  await cp(path.join(licenseSource, "Config", "license.json"),
    path.join(userDataPath, "Config", "license.json"));
  console.log(`Foundry Node server: ${serverPath}`);
  console.log(`Foundry User Data path: ${userDataPath}`);
  console.log(`Foundry Data path: ${dataPath}`);
  console.log(`Test world: ${WORLD_ID}`);

  // Recover worlds left by interrupted runs before starting Foundry.
  await removeStaleE2EWorlds(dataPath);

  try {
    const response = await fetch(BASE_URL);
    if (response.ok || response.status === 401) {
      throw new Error(
        `Foundry is already running at ${BASE_URL}. Close it before ` +
        "running the autonomous E2E suite."
      );
    }
  } catch (error) {
    if (error.message.includes("already running")) throw error;
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

  // Normalize and build only in the temporary checkout. Package after packs,
  // so the archive and the installed runtime contain the same generated data.
  // Build the current edited sources before installing the disposable system.
  // ROOT points to the temporary checkout, never the original repository here.
  await runCommand(npmCommand, ["run", "migrate:packs"]);
  await runCommand(npmCommand, ["run", "build:packs", "--", "--normalized-workspace", ...(INCLUDE_PROPOSED_TRANSLATIONS ? ["--include-proposed"] : [])]);
  await runCommand(npmCommand, ["run", "package"]);
  await runCommand(npmCommand, ["run", "test:build"], {
    env: { ...process.env, CYPHER_TEST_NORMALIZED_SOURCES: "true" }
  });
  await runCommand(process.execPath, ["scripts/verify-package.mjs"]);
  await runCommand(npmCommand, ["run", "check:system-syntax"]);
  await runCommand(npmCommand, ["run", "check:e2e-syntax"]);
  try {
    // Reuse a working browser without taking Playwright's installation lock or
    // writing outside the owned workspace. Install only when the preflight fails.
    await runCommand(npmCommand, ["run", "check:e2e-browser"]);
  } catch (error) {
    if (process.env.PLAYWRIGHT_SKIP_BROWSER_INSTALL === "true") throw error;
    await runCommand(process.execPath, ["node_modules/@playwright/test/cli.js", "install", "chromium"]);
    await runCommand(npmCommand, ["run", "check:e2e-browser"]);
  }

  await ensureDataPath(userDataPath, dataPath);
  await installSystem(dataPath);
  worldPath = path.join(dataPath, "worlds", WORLD_ID);
  worldCreated = true;
  await createWorld(
    dataPath,
    coreVersion,
    systemManifest.version
  );

  // Foundry's --dataPath option expects the user-data root. The actual
  // Data directory is the child directory resolved above.
  child = spawnFoundry(serverPath, userDataPath);
  child.once("error", error => {
    console.error("Unable to start Foundry:", error);
  });

  foundryPid = child.pid;
  if (!Number.isInteger(foundryPid) || foundryPid <= 0) {
    throw new Error("Foundry server did not expose a valid process ID.");
  }
  await writeFile(FOUNDRY_PID_FILE, String(foundryPid));
  console.log(`Foundry process ID: ${foundryPid}`);

  await waitForOwnedServer(child, BASE_URL);

  exitCode = await new Promise(resolve => {
    const testArgs = [
      "test",
      ...E2E_SPECS,
      "--config=playwright.config.mjs",
      ...process.argv.slice(2).filter(argument => !["--debug-foundry-logs", "--proposed-translations"].includes(argument))
    ];
    // Use Node directly so Windows cmd/npm cannot reinterpret a grep regex,
    // spaces, or shell metacharacters in user-supplied Playwright arguments.
    const testProcess = spawn(process.execPath, [
      path.join(ROOT, "node_modules", "@playwright", "test", "cli.js"),
      ...testArgs
    ], {
      cwd: ROOT,
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        FOUNDRY_URL: BASE_URL,
        FOUNDRY_E2E_WORLD_ID: WORLD_ID,
        CYPHER_E2E_TRANSLATION_PREVIEW: String(INCLUDE_PROPOSED_TRANSLATIONS)
      }
    });
    testProcess.on("error", error => {
      console.error("Unable to start Playwright:", error);
      resolve(1);
    });
    testProcess.on("close", code => resolve(code ?? 1));
  });
} finally {
  // Stop Foundry before deleting its world/LevelDB files so open handles cannot
  // race cleanup. Preserve failure diagnostics before removing the temp copy.
  let shutdownFailed = false;
  try { await stopProcess(child, foundryPid); }
  catch (error) {
    shutdownFailed = true;
    exitCode = 1;
    console.error("Foundry shutdown failed:", error);
  }
  await showFoundryLogTailOnFailure();

  if (exitCode === 0) {
    await rm(FOUNDRY_LOG_PATH, { force: true });
  }

  if (worldCreated && !shutdownFailed) {
    await removeWorld(worldPath);
  }

  if (!shutdownFailed) await rm(FOUNDRY_PID_FILE, { force: true });
  if (validationWorkspace && exitCode !== 0) {
    const reportPath = path.join(SOURCE_ROOT, "reports", WORLD_ID);
    try {
      await cp(path.join(ROOT, "test-results"), reportPath, { recursive: true });
      console.error("E2E diagnostics: " + reportPath);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (validationWorkspace && !shutdownFailed) await removeValidationWorkspace(validationWorkspace);
  if (shutdownFailed) console.error(`Retained owned workspace for shutdown recovery: ${validationWorkspace}`);
}

process.exitCode = exitCode;
