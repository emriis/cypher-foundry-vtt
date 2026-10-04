import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findApplication,
  getApplicationCandidates
} from "../../scripts/foundry-discovery.mjs";

test("Windows discovery includes the standard Foundry installation paths", () => {
  const candidates = getApplicationCandidates({
    platform: "win32",
    env: {
      LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local",
      ProgramFiles: "C:\\Program Files"
    }
  });

  assert.deepEqual(candidates, [
    path.join(
      "C:\\Users\\Test\\AppData\\Local",
      "Foundry Virtual Tabletop",
      "Foundry Virtual Tabletop.exe"
    ),
    path.join(
      "C:\\Users\\Test\\AppData\\Local",
      "FoundryVTT",
      "Foundry Virtual Tabletop.exe"
    ),
    path.join(
      "C:\\Program Files",
      "Foundry Virtual Tabletop",
      "Foundry Virtual Tabletop.exe"
    ),
    path.join(
      "C:\\Program Files",
      "FoundryVTT",
      "Foundry Virtual Tabletop.exe"
    )
  ]);
});

test("FOUNDRY_APP_PATH accepts a Windows installation directory", () => {
  const candidates = getApplicationCandidates({
    platform: "win32",
    env: {
      FOUNDRY_APP_PATH: "C:\\Tools\\Foundry"
    }
  });

  assert.deepEqual(candidates, [
    path.resolve("C:\\Tools\\Foundry"),
    path.join(
      path.resolve("C:\\Tools\\Foundry"),
      "Foundry Virtual Tabletop.exe"
    )
  ]);
});

test("findApplication ignores a configured installation directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cypher-discovery-"));
  const executable = path.join(root, "Foundry Virtual Tabletop.exe");

  try {
    await mkdir(root, { recursive: true });
    await writeFile(executable, "test", "utf8");

    const found = await findApplication({
      platform: "win32",
      env: { FOUNDRY_APP_PATH: root }
    });

    assert.equal(found, executable);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("findApplication reports every candidate when discovery fails", async () => {
  await assert.rejects(
    () => findApplication({
      platform: "linux",
      env: {}
    }),
    error => {
      assert.match(error.message, /Foundry VTT executable was not found/);
      assert.match(error.message, /\\/usr\\/bin\\/foundryvtt/);
      assert.match(error.message, /\\/usr\\/local\\/bin\\/foundryvtt/);
      return true;
    }
  );
});
