/** Own short-lived fixture directories; never clean a caller-supplied path. */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function withTemporaryDirectory(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "cypher-test-"));
  try { return await run(root); }
  finally {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("cypher-test-")) {
      throw new Error("Refusing unexpected fixture cleanup");
    }
    await rm(root, { recursive: true, force: true });
  }
}
