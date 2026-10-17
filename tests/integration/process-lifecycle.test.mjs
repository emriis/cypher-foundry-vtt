import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import test from "node:test";
import { stopOwnedProcess, waitForOwnedServer } from "../../scripts/process-lifecycle.mjs";
import { validateArchiveEntries, extractArchive } from "../../scripts/archive.mjs";
import { withTemporaryDirectory } from "../helpers/temporary-directory.mjs";

test("cleanup waits for actual child exit even after termination was requested", async () => {
  const child = spawn(process.execPath, ["-e", 'process.on("message", () => setTimeout(() => process.exit(0), 40)); process.send("ready");'],
    { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
  try {
    await once(child, "message");
    let exited = false;
    child.once("exit", () => { exited = true; });
    await stopOwnedProcess(child, () => child.send("stop"));
    assert.equal(exited, true);
    assert.equal(child.exitCode, 0);
  } finally { if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, "exit"); } }
});

test("Windows extraction rejects a real traversal ZIP before writing any entry", { skip: process.platform !== "win32" }, async () => {
  await withTemporaryDirectory(async directory => {
    const archive = path.join(directory, "fixture.zip");
    const destination = path.join(directory, "stage");
    const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($env:CYPHER_FIXTURE, 'Create')
try {
  foreach ($name in @('system.json', '../escaped')) {
    $entry = $zip.CreateEntry($name)
    $writer = [IO.StreamWriter]::new($entry.Open())
    try { $writer.Write('fixture') } finally { $writer.Dispose() }
  }
} finally { $zip.Dispose() }`;
    await promisify(execFile)("pwsh", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true, env: { ...process.env, CYPHER_FIXTURE: archive }
    });
    await assert.rejects(extractArchive(archive, destination), /Unsafe archive entry/);
    await assert.rejects(access(path.join(destination, "system.json")));
    await assert.rejects(readFile(path.join(directory, "escaped")));
  });
});
test("a server which exits before HTTP readiness reports its exit instead of waiting the whole timeout", async () => {
  await assert.rejects(waitForOwnedServer({ exitCode: 7, signalCode: null }, "http://127.0.0.1:1"), /code=7/);
});

test("the existing child handle stops an owned Node server on this platform before cleanup", async () => {
  const child = spawn(process.execPath, ["-e", 'setInterval(() => {}, 1000); process.send("ready");'],
    { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
  try {
    await once(child, "message");
    await stopOwnedProcess(child, force => child.kill(force ? "SIGKILL" : "SIGTERM"));
    assert.ok(child.exitCode !== null || child.signalCode !== null);
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill(); await once(child, "exit"); }
  }
});
test("archive paths reject traversal and absolute destinations before extraction", () => {
  for (const entry of ["../worlds/private", "packs/../../private", "C:/private", "/private", "..\\private"]) {
    assert.throws(() => validateArchiveEntries([entry]), /Unsafe/);
  }
  assert.doesNotThrow(() => validateArchiveEntries(["system.json", "module/actor.mjs", "packs/skills-en/CURRENT"]));
});
