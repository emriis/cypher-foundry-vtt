/** Await runner-owned children before deleting their files, on every platform. */
import { setTimeout as delay } from "node:timers/promises";

/** Wait for actual exit, not ChildProcess.killed (which only means a signal was sent). */
export async function waitForChildExit(child, timeoutMs = 10_000) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve, reject) => {
    const done = () => { clearTimeout(timer); child.off("exit", done); resolve(); };
    const timer = setTimeout(() => { child.off("exit", done); reject(new Error("Child shutdown timed out")); }, timeoutMs);
    child.once("exit", done);
  });
}

/** Gracefully stop an owned child, escalating only that child/tree after a bounded wait. */
export async function stopOwnedProcess(child, terminate, timeoutMs = 10_000) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await terminate(false);
  try { await waitForChildExit(child, timeoutMs); }
  catch {
    await terminate(true);
    await waitForChildExit(child, timeoutMs);
  }
}

/** HTTP readiness must not hide an already failed or exited server process. */
export async function waitForOwnedServer(child, url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Foundry exited before readiness: code=${child.exitCode}, signal=${child.signalCode}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(2000, timeoutMs)) });
      if (response.ok || response.status === 401) return;
    } catch (error) { lastError = error; }
    await delay(250);
  }
  throw new Error(`Foundry did not become reachable at ${url}. Last error: ${lastError?.message ?? "HTTP not ready"}`);
}
