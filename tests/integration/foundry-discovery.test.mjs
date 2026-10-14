import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findApplication,
  findServer,
  getApplicationCandidates,
  readCoreVersion
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
      "Programs",
      "Foundry Virtual Tabletop",
      "Foundry Virtual Tabletop.exe"
    ),
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
    ),
    path.join(
      "C:\\Program Files",
      "FoundryVTT",
      "Foundry Virtual Tabletop",
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
      assert.match(error.message, /\/usr\/bin\/foundryvtt/);
      assert.match(error.message, /\/usr\/local\/bin\/foundryvtt/);
      return true;
    }
  );
});

test("Given a desktop installation, when the Node server is discovered, then its default entry point and version share the same app", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "cypher-server-discovery-"));
  try {
    const app = path.join(root, "resources", "app");
    await mkdir(app, { recursive: true });
    await writeFile(path.join(root, "Foundry Virtual Tabletop.exe"), "fixture");
    await writeFile(path.join(app, "main.js"), "// fixture");
    await writeFile(path.join(app, "package.json"), JSON.stringify({ version: "14.368" }));
    const server = await findServer({ platform: "win32", env: { FOUNDRY_APP_PATH: root } });
    assert.equal(server, path.join(app, "main.js"));
    assert.equal(await readCoreVersion(server, { env: {} }), "14.368");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const filename of ["main.js", "main.mjs"]) {
  test(`Given an explicit ${filename} server, when discovery runs, then an unrelated executable is ignored and the selected app supplies the version`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cypher-server-override-"));
    try {
      const app = path.join(root, "chosen-node-app");
      await mkdir(app);
      const server = path.join(app, filename);
      await writeFile(server, "// fixture");
      await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "13.999" }));
      await writeFile(path.join(app, "package.json"), JSON.stringify({ release: { generation: 14, build: 369 } }));
      const resolved = await findServer({ env: { FOUNDRY_SERVER_PATH: server, FOUNDRY_APP_PATH: "missing.exe" } });
      assert.equal(resolved, server);
      assert.equal(await readCoreVersion(resolved, { env: {} }), "14.369");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("Given a missing explicit Node server, when discovery runs, then it fails without silently selecting another installation", async () => {
  await assert.rejects(findServer({ env: { FOUNDRY_SERVER_PATH: path.join(os.tmpdir(), "missing-cypher-server", "main.js") } }),
    /Foundry Node server was not found/);
});

test("Given no readable server package, when a version is explicitly configured, then that version remains the fallback", async () => {
  assert.equal(await readCoreVersion(path.join(os.tmpdir(), "missing-cypher-server", "main.js"),
    { env: { FOUNDRY_CORE_VERSION: "14.369" } }), "14.369");
});
