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
const FOUNDRY_PID_FILE = path.join(
  os.tmpdir(),
  `cypher-foundry-e2e-${process.pid}.pid`
);
const E2E_SPECS = [
  "tests/e2e/foundry-runtime.spec.mjs",
  "tests/e2e/foundry-gameplay.spec.mjs"
];

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

async function waitForPidFile(filePath, timeout = 10_000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      const pid = Number((await readFile(filePath, "utf8")).trim());
      if (Number.isInteger(pid) && pid > 0) return pid;
    } catch {
      // The PowerShell launcher has not written the PID yet.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error("Foundry launcher did not report its process ID.");
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

  // Never layer one E2E installation over a previous system copy. Stale
  // templates or modules can otherwise survive between test runs.
  await rm(target, { recursive: true, force: true });
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

function spawnFoundry(appPath, userDataPath) {
  const args = [
    `--port=${PORT}`,
    "--noupnp",
    "--noupdate",
    `--world=${WORLD_ID}`,
    `--dataPath=${userDataPath}`
  ];

  if (process.platform === "win32") {
    // Node can return EACCES for this Electron executable, while cmd.exe
    // introduces another quoting layer. PowerShell receives the executable
    // and argument list separately, so paths with spaces stay intact.
    const powershellScript =
      "$arguments = ConvertFrom-Json $env:FOUNDRY_ARGS_JSON; " +
      "$process = Start-Process -FilePath $env:FOUNDRY_EXE " +
      "-ArgumentList $arguments -PassThru; " +
      "Set-Content -Path $env:FOUNDRY_PID_FILE -Value $process.Id; " +
      "$process.WaitForExit();"

    return spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        powershellScript
      ],
      {
        cwd: path.dirname(appPath),
        stdio: "inherit",
        windowsHide: false,
        shell: false,
        env: {
          ...process.env,
          FOUNDRY_EXE: appPath,
          FOUNDRY_ARGS_JSON: JSON.stringify(args),
          FOUNDRY_PID_FILE
        }
      }
    );
  }

  return spawn(appPath, args, {
    cwd: path.dirname(appPath),
    stdio: "inherit",
    windowsHide: false,
    shell: false
  });
}

function quoteWindowsArg(value) {
  const stringValue = String(value);
  if (/^[A-Za-z0-9_./:-]+$/.test(stringValue)) {
    return stringValue;
  }
  return `"${stringValue}"`;
}

function windowsCommand(command, args) {
  return [
    command,
    ...args.map(quoteWindowsArg)
  ].join(" ");
}

function spawnScript(command, args, options = {}) {
  if (process.platform === "win32") {
    return spawn(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", windowsCommand(command, args)],
      {
        cwd: ROOT,
        stdio: "inherit",
        windowsHide: false,
        shell: false,
        ...options
      }
    );
  }

  return spawn(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false,
    ...options
  });
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const childProcess = spawnScript(command, args);
    childProcess.on("error", reject);
    childProcess.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}: ${command}`));
    });
  });
}

async function waitForWindowsProcessExit(pid, timeout = 30_000) {
  if (process.platform !== "win32" || !Number.isInteger(pid)) return;

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await new Promise(resolve => {
      const probe = spawn(
        "tasklist",
        ["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"],
        { stdio: ["ignore", "pipe", "ignore"], windowsHide: true }
      );
      let output = "";
      probe.stdout.on("data", chunk => {
        output += chunk;
      });
      probe.on("close", () => resolve(output));
      probe.on("error", () => resolve(""));
    });

    if (!String(result).includes(`"${pid}"`)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Process ${pid} did not exit within ${timeout}ms.`);
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

async function stopProcess(child, foundryPid) {
  if (process.platform === "win32") {
    const pids = [foundryPid, child?.pid]
      .filter(pid => Number.isInteger(pid) && pid > 0);

    for (const pid of pids) {
      await new Promise((resolve, reject) => {
        const killer = spawn(
          "taskkill",
          ["/pid", String(pid), "/t", "/f"],
          { stdio: "ignore", windowsHide: true }
        );
        killer.on("error", reject);
        killer.on("close", () => resolve());
      });
    }

    for (const pid of pids) {
      try {
        await waitForWindowsProcessExit(pid, 5_000);
      } catch {
        await new Promise((resolve, reject) => {
          const killer = spawn(
            "powershell.exe",
            [
              "-NoProfile",
              "-NonInteractive",
              "-Command",
              "Stop-Process -Id " + pid +
                " -Force -ErrorAction SilentlyContinue"
            ],
            { stdio: "ignore", windowsHide: true }
          );
          killer.on("error", reject);
          killer.on("close", () => resolve());
        });
        await waitForWindowsProcessExit(pid, 10_000);
      }
    }
    return;
  }

  if (child && !child.killed) child.kill("SIGTERM");
}

const appPath = await findApplication();
const { userDataPath, dataPath } = await getFoundryPaths();
const coreVersion = await readCoreVersion(appPath);
const systemManifest = JSON.parse(
  await readFile(path.join(ROOT, "system.json"), "utf8")
);

let child;
let foundryPid;
let worldCreated = false;
let worldPath;
let exitCode = 1;

try {
  console.log(`Foundry executable: ${appPath}`);
  console.log(`Foundry User Data path: ${userDataPath}`);
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
  const command = process.platform === "win32" ? "npx.cmd" : "npx";

  // Build the exact release artifact before installing the system used by Foundry.
  await runCommand(npmCommand, ["run", "package"]);
  await runCommand(npmCommand, ["run", "build:packs"]);
  await runCommand(npmCommand, ["run", "check:system-syntax"]);
  await runCommand(npmCommand, ["run", "check:e2e-syntax"]);
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_INSTALL !== "true") {
    await runCommand(command, ["playwright", "install", "chromium"]);
  }
  await runCommand(npmCommand, ["run", "check:e2e-browser"]);

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
  child = spawnFoundry(appPath, userDataPath);
  child.once("error", error => {
    console.error("Unable to start Foundry:", error);
  });

  if (process.platform === "win32") {
    foundryPid = await waitForPidFile(FOUNDRY_PID_FILE);
  }

  await waitForServer(BASE_URL);

  exitCode = await new Promise(resolve => {
    const testArgs = [
      "playwright",
      "test",
      ...E2E_SPECS,
      "--config=playwright.config.mjs"
    ];
    const testProcess = spawnScript(command, testArgs, {
      env: {
        ...process.env,
        FOUNDRY_URL: BASE_URL,
        FOUNDRY_E2E_WORLD_ID: WORLD_ID
      }
    });
    testProcess.on("error", error => {
      console.error("Unable to start Playwright:", error);
      resolve(1);
    });
    testProcess.on("close", code => resolve(code ?? 1));
  });
} finally {
  await stopProcess(child, foundryPid);

  if (worldCreated) {
    await removeWorld(worldPath);
  }

  await rm(FOUNDRY_PID_FILE, { force: true });
}

process.exitCode = exitCode;