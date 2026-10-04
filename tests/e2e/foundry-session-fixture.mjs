import { test as base, expect } from "@playwright/test";
import { joinAsGamemaster } from "./foundry-session.mjs";

export const test = base.extend({
  page: [async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await joinAsGamemaster(page);
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
