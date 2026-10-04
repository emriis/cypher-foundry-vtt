import { test as base, expect } from "@playwright/test";
import { joinAsGamemaster } from "./foundry-session.mjs";

export const test = base.extend({
  page: [async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await joinAsGamemaster(page);
    await use(page);

    await context.close();
  }, { scope: "worker" }]
});

export { expect };
