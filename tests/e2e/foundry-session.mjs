const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

const GAMEMASTER_NAME = "gamemaster";

function normalizeUserName(value) {
  return String(value || "").trim().toLowerCase().replace(/\\s+/g, "");
}

export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  const gamemasterOption = page.locator("select option").filter({
    hasText: /^\\s*gamemaster\\s*$/i
  }).first();

  if (await gamemasterOption.count()) {
    const gamemasterValue = await gamemasterOption.getAttribute("value");
    const userSelect = gamemasterOption.locator("xpath=ancestor::select[1]");

    if (!gamemasterValue) {
      throw new Error(
        "Foundry exposed the gamemaster profile without a selectable value."
      );
    }

    await userSelect.selectOption(gamemasterValue);

    const selectedValue = await userSelect.inputValue();
    if (selectedValue !== gamemasterValue) {
      throw new Error(
        "Foundry did not select the gamemaster profile. " +
        `Expected value: ${gamemasterValue}; actual value: ${selectedValue}`
      );
    }

    const password = page.locator(
      'input[type="password"], input[name*="password" i]'
    ).first();

    if (await password.count()) {
      await password.fill("");
    }

    const form = userSelect.locator("xpath=ancestor::form[1]");
    const submit = form.locator(
      'button[type="submit"], input[type="submit"]'
    ).first();

    if (await submit.count()) {
      await submit.click();
    } else {
      const joinButton = page.getByRole("button", {
        name: /join game( session)?/i
      }).first();

      if (await joinButton.count()) {
        await joinButton.click();
      } else {
        await form.evaluate(formElement => {
          if (typeof formElement.requestSubmit === "function") {
            formElement.requestSubmit();
          } else {
            formElement.submit();
          }
        });
      }
    }
  } else {
    const availableUsers = await page.locator("select option").allTextContents();
    const normalizedUsers = availableUsers.map(normalizeUserName);

    throw new Error(
      "Foundry join page did not expose the required 'gamemaster' user. " +
      `Available users: ${JSON.stringify(availableUsers)}; ` +
      `normalized: ${JSON.stringify(normalizedUsers)}`
    );
  }

  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      ready: globalThis.game?.ready === true,
      view: globalThis.game?.view,
      url: location.href,
      title: document.title,
      body: document.body?.innerText?.slice(0, 4000) || ""
    }));

    if (state.ready) return;

    if (/game\\s*worlds|configuration and setup/i.test(state.body)) {
      throw new Error(
        "Foundry did not auto-launch the E2E world. " +
        "The browser reached Setup instead. " +
        `URL: ${state.url}\\n` +
        `Title: ${state.title}\\n` +
        `View: ${state.view}\\n` +
        `Setup content:\\n${state.body}`
      );
    }

    await page.waitForTimeout(250);
  }

  throw new Error(
    "Foundry did not become ready within 60 seconds. " +
    `URL: ${await page.url()}`
  );
}
