import { spawn } from "node:child_process";

const command = process.platform === "win32"
  ? ["pwsh", ["-File", "scripts/package.ps1"]]
  : ["bash", ["scripts/package.sh"]];

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