import { test as base, expect } from "@playwright/test";
import { joinAsGamemaster } from "./foundry-session.mjs";

const MIN_CHROMIUM_MAJOR = 146;

export const test = base.extend({
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
    const page = await context.newPage();

    await joinAsGamemaster(page);

    // Foundry v14 opens its first-world tour automatically in a fresh E2E world.
    // It is unrelated to the system under test and can intercept sheet input.
    await page.evaluate(() => {
      const Tour = globalThis.foundry?.nue?.Tour;
      Tour?.activeTour?.exit();
    });

    await use(page);

    await page.evaluate(async () => {
      for (const actor of game.actors.filter(
        actor => actor.name.startsWith("E2E Cypher")
      )) {
        await actor.delete();
      }

      for (const actor of game.actors) {
        if (actor.sheet?.rendered) actor.sheet.close();
      }
    });

    await context.close();
  }, { scope: "worker" }]
});

export { expect };
