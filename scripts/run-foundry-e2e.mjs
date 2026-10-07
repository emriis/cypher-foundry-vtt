/**
 * Starts Foundry with one disposable world in the user's normal Data
 * directory, runs the live Playwright suite, and removes only that world.
 */
import {
  cp,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { findApplication } from "./foundry-discovery.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = Number(process.env.FOUNDRY_PORT || 30000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORLD_ID = `cypher-e2e-${Date.now()}`;
const WORLD_TITLE = "Cypher Automated E2E";

function getDataPath() {
  if (process.env.FOUNDRY_DATA_PATH) {
    return path.resolve(process.env.FOUNDRY_DATA_PATH);
  }

  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      "FoundryVTT",
      "Data"
    );
  }

  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "FoundryVTT",
      "Data"
    );
  }

  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    "FoundryVTT",
    "Data"
  );
}

async function readCoreVersion(appPath) {
  const candidate = path.join(
    path.dirname(appPath),
    "resources",
    "app",
    "package.json"
  );

  try {
    const data = JSON.parse(await readFile(candidate, "utf8"));
    if (data.version) return data.version;
  } catch {
    // Fall back to the explicit environment variable below.
  }

  if (process.env.FOUNDRY_CORE_VERSION) {
    return process.env.FOUNDRY_CORE_VERSION;
  }

  throw new Error(
    "Unable to determine the Foundry core version. Set " +
    "FOUNDRY_CORE_VERSION explicitly."
  );
}

async function waitForServer(url, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 401) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(
    `Foundry did not become reachable at ${url}.` +
    (lastError ? ` Last error: ${lastError.message}` : "")
  );
}

async function ensureDataPath(dataPath) {
  await mkdir(path.join(dataPath, "Config"), { recursive: true });

  const licensePath = path.join(dataPath, "Config", "license.json");
  try {
    await readFile(licensePath, "utf8");
  } catch {
    throw new Error(
      "Foundry license.json was not found in the configured Data path. " +
      "Start Foundry once and complete license/EULA setup, or set " +
      "FOUNDRY_DATA_PATH to the correct Data directory."
    );
  }
}

async function installSystem(dataPath) {
  const target = path.join(dataPath, "systems", "cypher");
  const releasePaths = [
    "system.json",
    "cypher.mjs",
    "module",
    "templates",
    "css",
    "lang",
    "packs",
    "assets",
    "LICENSE.txt",
    "README.md"
  ];

  for (const relativePath of releasePaths) {
    const source = path.join(ROOT, relativePath);
    const destination = path.join(target, relativePath);
    await cp(source, destination, { recursive: true });
  }
}

async function createWorld(dataPath, coreVersion, systemVersion) {
  const worldPath = path.join(dataPath, "worlds", WORLD_ID);
  await mkdir(worldPath, { recursive: true });

  const manifest = {
    id: WORLD_ID,
    title: WORLD_TITLE,
    description: "Disposable Cypher system E2E world.",
    version: "1.0.0",
    coreVersion,
    system: "cypher",
    systemVersion,
    type: "world"
  };

  await writeFile(
    path.join(worldPath, "world.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );

  return worldPath;
}

function spawnFoundry(appPath, dataPath) {
  return spawn(
    appPath,
    [
      `--port=${PORT}`,
      "--noupnp",
      "--noupdate",
      `--world=${WORLD_ID}`,
      `--dataPath=${dataPath}`
    ],
    {
      cwd: path.dirname(appPath),
      stdio: "inherit",
      windowsHide: false
    }
  );
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    process.on("error", reject);
    process.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

function stopProcess(child) {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
  } else {
    child.kill("SIGTERM");
  }
}

const appPath = await findApplication();
const dataPath = getDataPath();
const coreVersion = await readCoreVersion(appPath);
const systemManifest = JSON.parse(
  await readFile(path.join(ROOT, "system.json"), "utf8")
);

let child;
let worldCreated = false;
let worldPath;
let exitCode = 1;

try {
  console.log(`Foundry executable: ${appPath}`);
  console.log(`Foundry Data path: ${dataPath}`);
  console.log(`Test world: ${WORLD_ID}`);

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
  await runCommand(npmCommand, ["run", "build:packs"]);

  await ensureDataPath(dataPath);
  await installSystem(dataPath);
  worldPath = path.join(dataPath, "worlds", WORLD_ID);
  worldCreated = true;
  await createWorld(
    dataPath,
    coreVersion,
    systemManifest.version
  );

  child = spawnFoundry(appPath, dataPath);
  child.once("error", error => {
    console.error("Unable to start Foundry:", error);
  });

  await waitForServer(BASE_URL);

  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  exitCode = await new Promise(resolve => {
    const testProcess = spawn(
      command,
      ["playwright", "test", "--config=playwright.config.mjs"],
      {
        cwd: ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: {
          ...process.env,
          FOUNDRY_URL: BASE_URL,
          FOUNDRY_E2E_WORLD_ID: WORLD_ID
        }
      }
    );
    testProcess.on("close", code => resolve(code ?? 1));
  });
} finally {
  stopProcess(child);

  if (child) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 5_000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  if (worldCreated) {
    await rm(worldPath, { recursive: true, force: true });
  }
}

process.exitCode = exitCode;
