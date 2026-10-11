import { test as base, expect } from "@playwright/test";
import { joinAsGamemaster } from "./foundry-session.mjs";

const MIN_CHROMIUM_MAJOR = 146;
const browserLogsByPage = new WeakMap();

function recordBrowserLog(page, ...parts) {
  const logs = browserLogsByPage.get(page) ?? [];
  logs.push(parts.map(part =>
    typeof part === "string" ? part : String(part)
  ).join(" "));
  browserLogsByPage.set(page, logs);
}

/** Set the dice input while preserving Foundry's real formulas and Roll objects. */
export async function setDiceUniform(page, value) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Dice uniform input must be in [0, 1).");
  }
  await page.evaluate(value => {
    CONFIG.Dice.randomUniform = () => value;
  }, value);
}

export const test = base.extend({
  deterministicDice: [async ({ e2ePage: page }, use) => {
    await page.evaluate(() => {
      globalThis.cypherE2EOriginalRandomUniform = CONFIG.Dice.randomUniform;
    });
    try {
      // Foundry maps u to ceil((1 - u) * faces).
      // d20 = 10, d6 = 3, d100 = 48; no natural-roll special outcomes.
      await setDiceUniform(page, 0.525);
      await use();
    } finally {
      await page.evaluate(() => {
        CONFIG.Dice.randomUniform = globalThis.cypherE2EOriginalRandomUniform;
        delete globalThis.cypherE2EOriginalRandomUniform;
      });
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
    await context.addInitScript(stepCount => {
      localStorage.setItem("core.tourProgress", JSON.stringify({
        core: { welcome: stepCount }
      }));
    }, welcome.steps.length);
    const page = await context.newPage();

    // Keep browser-side failures visible. In particular, an import/runtime
    // error in cypher.mjs can leave Foundry running with the generic core
    // Actor/Item classes, which otherwise looks like a sheet rendering bug.
    page.on("pageerror", error => {
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

    await joinAsGamemaster(page);

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

test.afterEach(async ({ e2ePage: page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const logs = browserLogsByPage.get(page) ?? [];
    console.error(
      "\n--- E2E browser diagnostics (failed test) ---\n" +
      (logs.join("\n") || "(No browser diagnostics captured)") +
      "\n--- End E2E browser diagnostics ---"
    );
  }

  browserLogsByPage.delete(page);

  await page.evaluate(async () => {
    // The duration scenario marks its temporary Combat explicitly; other
    // encounters are not cleanup targets, even inside a disposable world.
    for (const combat of game.combats ?? []) {
      if (combat.getFlag("cypher", "e2eOwned")) await combat.delete();
    }
    for (const actor of game.actors.filter(
      actor => actor.name.startsWith("E2E Cypher") ||
        actor.name.startsWith("E2E PC") ||
        actor.name.startsWith("E2E Item Actor")
    )) {
      if (actor.sheet?.rendered) await actor.sheet.close();
      await actor.delete();
    }

    for (const application of Object.values(ui.windows ?? {})) {
      if (application?.rendered) await application.close();
    }
  });
});

export { expect };
