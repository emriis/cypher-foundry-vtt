const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

/**
 * Opens the live Foundry world and joins its fresh Gamemaster account.
 *
 * A disposable world always starts with a Gamemaster user without a password.
 */
export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  const userSelect = page.locator("select").first();
  if (await userSelect.count()) {
    const option = userSelect.locator("option").filter({
      hasText: /game\s*master/i
    });

    if (await option.count()) {
      const value = await option.first().getAttribute("value");
      await userSelect.selectOption(value);
    }

    const password = page.locator(
      'input[type="password"], input[name*="password" i]'
    ).first();

    if (await password.count()) {
      await password.fill("");
    }

    const joinButton = page.getByRole("button", {
      name: /join game( session)?/i
    });

    if (await joinButton.count()) {
      await joinButton.click();
    } else {
      await page.locator('input[type="submit"]').click();
    }
  }

  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      ready: globalThis.game?.ready === true,
      url: location.href,
      title: document.title,
      body: document.body?.innerText?.slice(0, 4000) || ""
    }));

    if (state.ready) return;

    if (/game\s*worlds|configuration and setup/i.test(state.body)) {
      throw new Error(
        "Foundry did not auto-launch the E2E world. " +
        "The browser reached Setup instead. " +
        `URL: ${state.url}\n` +
        `Title: ${state.title}\n` +
        `Setup content:\n${state.body}`
      );
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    "Foundry did not become ready within 60 seconds. " +
    `URL: ${await page.url()}`
  );
}
