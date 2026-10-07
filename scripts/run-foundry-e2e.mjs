    });
    process.on("error", reject);
    process.on("close", code => resolve({ code, output }));
  });
}

async function waitForWindowsProcessExit(pid, timeout = 30_000) {
  if (process.platform !== "win32" || !Number.isInteger(pid)) return;

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await runWindowsCommand(
      "tasklist",
      ["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"]
    );

    if (!String(result.output).includes(`"${pid}"`)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Foundry process ${pid} did not exit within ${timeout}ms.`);
}

async function waitForWorldRemoval(worldPath, timeout = 30_000) {
  const deadline = Date.now() + timeout;
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
      await runWindowsCommand("taskkill", [
        "/pid", String(pid), "/t", "/f"
      ]);
    }

    await waitForWindowsProcessExit(foundryPid);
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

  if (child) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 30_000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
