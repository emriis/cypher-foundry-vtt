/** Execute the shared suite inventory without shell-dependent globs. Never normalizes sources. */
import { spawn } from "node:child_process";
import path from "node:path";
import { discoverTests } from "./test-suites.mjs";

const root = path.resolve(import.meta.dirname, "..");
const [suite = "all", ...options] = process.argv.slice(2);
const files = await discoverTests(root, suite);
if (!files.length) throw new Error(`No tests discovered for ${suite}`);
const child = spawn(process.execPath, ["--test", "--test-reporter=spec", ...options, ...files],
  { cwd: root, stdio: "inherit", windowsHide: true });
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("close", code => { process.exitCode = code ?? 1; });
