/**
 * Select the platform's packaging shell and forward its exit status to npm/CI.
 * The shell script owns archive creation and overwrites dist/system.zip and
 * dist/system.json. Tests must invoke this launcher in their isolated checkout.
 */
import { spawn, spawnSync } from "node:child_process";

function commandForPlatform() {
  if (process.platform !== "win32") {
    return ["bash", ["scripts/package.sh"]];
  }

  // Git for Windows normally provides bash.exe. Prefer the same packaging
  // implementation used by CI so Windows builds produce identical ZIP bytes.
  const bashCheck = spawnSync("bash", ["--version"], {
    stdio: "ignore",
    shell: false
  });
  if (bashCheck.status === 0) {
    return ["bash", ["scripts/package.sh"]];
  }

  return ["pwsh", ["-File", "scripts/package.ps1"]];
}

const command = commandForPlatform();
const child = spawn(command[0], command[1], {
  stdio: "inherit",
  shell: false
});

child.on("error", (error) => {
  console.error("Unable to run package command: " + error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error("Package command terminated by " + signal + ".");
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
