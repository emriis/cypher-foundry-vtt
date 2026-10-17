import { test as base, expect } from "@playwright/test";
import { joinAsGamemaster } from "./foundry-session.mjs";

import { setDiceUniform, restoreDiceUniform, assertNoUnexpectedPageErrors } from "./browser-contracts.mjs";
export { setDiceUniform } from "./browser-contracts.mjs";

const MIN_CHROMIUM_MAJOR = 146;
const browserLogsByPage = new WeakMap();
const pageErrors = new WeakMap();
const ownedBaselines = new WeakMap();
const applicationBaselines = new WeakMap();

function recordBrowserLog(page, ...parts) {
  const logs = browserLogsByPage.get(page) ?? [];
  logs.push(parts.map(part =>
    typeof part === "string" ? part : String(part)
  ).join(" "));
  browserLogsByPage.set(page, logs);
}

export const test = base.extend({
  scenarioState: [async ({ e2ePage: page }, use, testInfo) => {
    await beginScenario(page);
    try { await use(); }
    finally { await endScenario(page, testInfo); }
  }, { auto: true }],
  deterministicDice: [async ({ e2ePage: page }, use) => {
    try {
      // Foundry maps u to ceil((1 - u) * faces).
      // d20 = 10, d6 = 3, d100 = 48; no natural-roll special outcomes.
      await setDiceUniform(page, 0.525);
      await use();
    } finally {
      await restoreDiceUniform(page);
    }
  }, { auto: true }],
  e2ePage: [async ({ browser }, use) => {
    const chromiumVersion = browser.version();
    const chromiumMajor = Number(chromiumVersion.split(".")[0]);

    if (
      !Number.isInteger(chromiumMajor) ||
      chromiumMajor < MIN_CHROMIUM_MAJOR
    ) {
      throw new Error(
        "Foundry E2E requires Chromium >= " +
        `${MIN_CHROMIUM_MAJOR}; Playwright launched ${chromiumVersion}.`
      );
    }

    const context = await browser.newContext();
    // Seed only this disposable browser's client setting before Foundry boots.
    // Exiting after game.ready races the delayed welcome tour: its pending start
    // can still render an overlay after exit has cleared the active tour.
    const foundryUrl = process.env.FOUNDRY_URL || "http://127.0.0.1:30000";
    const welcomeResponse = await context.request.get(
      new URL("tours/welcome.json", `${foundryUrl.replace(/\/$/, "")}/`).href
    );
    if (!welcomeResponse.ok()) {
      throw new Error(`Cannot load Foundry welcome tour: ${welcomeResponse.status()}`);
    }
    const welcome = await welcomeResponse.json();
    if (!Array.isArray(welcome.steps) || !welcome.steps.length) {
      throw new Error("Foundry welcome tour has no steps");
    }
    await context.addInitScript(({ stepCount, origin }) => {
      // Playwright also runs init scripts in about:blank and child frames.
      // Opaque origins reject localStorage access before Foundry even boots.
      if (location.origin !== origin) return;
      localStorage.setItem("core.tourProgress", JSON.stringify({
        core: { welcome: stepCount }
      }));
    }, { stepCount: welcome.steps.length, origin: new URL(foundryUrl).origin });
    const page = await context.newPage();

    // Keep browser-side failures visible. In particular, an import/runtime
    // error in cypher.mjs can leave Foundry running with the generic core
    // Actor/Item classes, which otherwise looks like a sheet rendering bug.
    page.on("pageerror", error => {
      const errors = pageErrors.get(page) ?? [];
      errors.push(error.stack || error.message);
      pageErrors.set(page, errors);
      recordBrowserLog(
        page,
        "[E2E pageerror]",
        error.stack || error.message
      );
    });

    page.on("console", message => {
      if (
        message.type() === "error" ||
        /cypher/i.test(message.text())
      ) {
        recordBrowserLog(
          page,
          `[E2E browser ${message.type()}] ${message.text()}`
        );
      }
    });

    page.on("requestfailed", request => {
      recordBrowserLog(
        page,
        "[E2E requestfailed]",
        request.url(),
        request.failure()?.errorText || "unknown error"
      );
    });

    try {
      await joinAsGamemaster(page);
    } catch (error) {
      // Scenario teardown cannot run when its worker page never initialized.
      // Emit captured browser failures here and preserve the original exception.
      const logs = browserLogsByPage.get(page) ?? [];
      console.error("\n--- E2E browser diagnostics (failed bootstrap) ---\n" +
        (logs.join("\n") || "(No browser diagnostics captured)") +
        "\n--- End E2E browser diagnostics ---");
      browserLogsByPage.delete(page);
      await context.close().catch(() => {});
      throw error;
    }

    const bootstrap = await page.evaluate(() => ({
      system: {
        id: game.system?.id ?? null,
        version: game.system?.version ?? null,
        cypherNamespace: Boolean(game.cypher),
        ready: game.ready === true
      },
      actor: {
        documentClass: CONFIG.Actor.documentClass?.name ?? null,
        pcModel: CONFIG.Actor.dataModels?.pc?.name ?? null
      },
      item: {
        documentClass: CONFIG.Item.documentClass?.name ?? null,
        abilityModel: CONFIG.Item.dataModels?.ability?.name ?? null
      }
    }));

    recordBrowserLog(
      page,
      "[E2E system bootstrap]\n" +
      JSON.stringify(bootstrap, null, 2)
    );

    // Do not let a missing system bootstrap masquerade as a selector/sheet
    // failure. The diagnostic above identifies the actual registration state.
    if (
      bootstrap.system.id !== "cypher" ||
      !bootstrap.system.cypherNamespace ||
      bootstrap.actor.documentClass !== "CypherActor" ||
      bootstrap.actor.pcModel !== "CypherPCData"
    ) {
      throw new Error(
        "Cypher system bootstrap is incomplete. " +
        "See [E2E system bootstrap] and browser diagnostics above."
      );
    }

    await expect(page.locator(".tour-overlay")).toHaveCount(0);

    await use(page);

    await page.evaluate(async () => {
      for (const actor of game.actors.filter(
        actor => actor.name.startsWith("E2E Cypher")
      )) {
        await actor.delete();
      }

      for (const actor of game.actors) {
        if (actor.sheet?.rendered) await actor.sheet.close();
      }
    });

    await context.close();
  }, { scope: "worker" }]
});

async function beginScenario(page) {
  applicationBaselines.set(page, await page.evaluate(() => [
    ...foundry.applications.instances.keys(),
    ...Object.values(ui.windows ?? {}).map(application => String(application.id ?? application.appId))
  ]));
  ownedBaselines.set(page, await page.evaluate(() => Object.fromEntries(
    ["combats", "scenes", "actors", "items", "messages", "journal", "tables", "users"]
      .map(name => [name, [...(game[name] ?? [])].map(document => document.id)])
  )));
}

async function endScenario(page, testInfo) {
  const errors = pageErrors.get(page) ?? [];
  // Keep the same buffer through cleanup so its exceptions cannot become green
  // or be attributed to the next scenario when the worker page is reused.
  pageErrors.set(page, errors);
  if (testInfo.status !== testInfo.expectedStatus) {
    const logs = browserLogsByPage.get(page) ?? [];
    console.error(
      "\n--- E2E browser diagnostics (failed test) ---\n" +
      (logs.join("\n") || "(No browser diagnostics captured)") +
      "\n--- End E2E browser diagnostics ---"
    );
  }

  browserLogsByPage.delete(page);

  const baseline = ownedBaselines.get(page);
  ownedBaselines.delete(page);
  const applicationIds = applicationBaselines.get(page) ?? [];
  applicationBaselines.delete(page);
  if (baseline) await page.waitForFunction(ids => {
    const original = new Set(ids);
    const rendered = [...game.messages].filter(message => !original.has(message.id) && message.visible)
      .every(message => document.querySelector(`#chat .chat-log [data-message-id="${message.id}"]`));
    // V14 posts transient cards asynchronously after persistence resolves. Deleting
    // a message while its hidden card/spacer is pending breaks the core animation.
    return rendered && !document.querySelector("#chat-notifications .message[hidden], #chat-notifications .spacer");
  }, baseline.messages, { timeout: 10_000 });
  if (baseline) await page.evaluate(async ({ baseline, applicationIds }) => {
    // IDs captured before this scenario establish ownership even after reload.
    // Close only scenario-owned document sheets and dialogs. Core UI services
    // can retain delayed callbacks and must not be torn down between scenarios.
    const originalApplications = new Set(applicationIds);
    const applications = new Set([...foundry.applications.instances.values(), ...Object.values(ui.windows ?? {})]);
    for (const application of applications) {
      if (originalApplications.has(String(application.id ?? application.appId))) continue;
      if ((application.document || application instanceof foundry.applications.api.DialogV2) && application.rendered) {
        await application.close();
      }
    }
    for (const [name, ids] of Object.entries(baseline)) {
      const existing = new Set(ids);
      for (const document of [...(game[name] ?? [])]) {
        if (!existing.has(document.id)) {
          if (document.sheet?.rendered) await document.sheet.close();
          await document.delete();
        }
      }
    }
  }, { baseline, applicationIds });
  pageErrors.delete(page);
  assertNoUnexpectedPageErrors(errors, testInfo.status !== testInfo.expectedStatus);
}

export { expect };
