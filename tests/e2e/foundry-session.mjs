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

  await page.waitForFunction(
    () => globalThis.game?.ready === true
      || /game worlds|configuration and setup/i.test(
        document.body?.innerText || ""
      ),
    null,
    { timeout: 60_000 }
  );

  const ready = await page.evaluate(() => globalThis.game?.ready === true);
  if (!ready) {
    throw new Error(
      "Foundry did not launch the E2E world. The browser remained on " +
      "the Setup screen; check the Foundry startup log for world " +
      "availability errors."
    );
  }
}
