/** Extract a built ZIP without relying on a Unix unzip executable on Windows. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
const exec = promisify(execFile);

/** Reject paths escaping the destination before any archive entries are written. */
export function validateArchiveEntries(entries) {
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/");
    if (normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized)
        || normalized.split("/").includes("..")) throw new Error(`Unsafe archive entry: ${entry}`);
  }
}

/** Extract only a runner-produced ZIP into a caller-owned staging directory. */
export async function extractArchive(archive, destination) {
  if (process.platform === "win32") {
    const script = `Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($env:CYPHER_ARCHIVE)
try {
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName.Replace([char]92, [char]47)
    if ($name.StartsWith('/') -or $name -match '^[A-Za-z]:' -or $name.Split('/') -contains '..') { throw 'Unsafe archive entry' }
  }
} finally { $zip.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($env:CYPHER_ARCHIVE, $env:CYPHER_STAGE, $true)`;
    await exec("pwsh", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true, env: { ...process.env, CYPHER_ARCHIVE: path.resolve(archive), CYPHER_STAGE: path.resolve(destination) }
    });
  } else {
    const { stdout } = await exec("unzip", ["-Z1", archive], { maxBuffer: 8 * 1024 * 1024 });
    validateArchiveEntries(stdout.trim().split("\n").filter(Boolean));
    await exec("unzip", ["-q", archive, "-d", destination]);
  }
}
