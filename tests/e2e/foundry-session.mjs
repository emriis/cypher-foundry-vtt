const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

const GAMEMASTER_NAME = "gamemaster";

async function selectGamemaster(page) {
  const usernameInput = page.locator(
    "#join-username, input[name=\"username\"]"
  ).first();

  if (await usernameInput.count()) {
    await usernameInput.waitFor({ state: "visible", timeout: 30_000 });
    await usernameInput.fill(GAMEMASTER_NAME);

    const value = await usernameInput.inputValue();
    if (value.toLowerCase() !== GAMEMASTER_NAME) {
      throw new Error(
        "Foundry did not accept the gamemaster username. " +
        `Expected: ${GAMEMASTER_NAME}; actual: ${value}`
      );
    }
    return usernameInput;
  }

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
    return userSelect;
  }

  throw new Error(
    "Foundry join page did not expose a gamemaster username input or " +
    "legacy gamemaster select."
  );
}

export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  await selectGamemaster(page);

  const password = page.locator(
    'input[type="password"], input[name*="password" i]'
  ).first();

  if (await password.count()) {
    await password.fill("");
  }

  const joinButton = page.getByRole("button", {
    name: /join game( session)?/i
  }).first();

  if (await joinButton.count()) {
    await joinButton.click();
  } else {
    const form = page.locator("form").filter({
      has: page.locator("#join-username, input[name=\"username\"]")
    }).first();

    if (await form.count()) {
      await form.evaluate(formElement => {
        if (typeof formElement.requestSubmit === "function") {
          formElement.requestSubmit();
        } else {
          formElement.submit();
        }
      });
    } else {
      throw new Error("Foundry join page did not expose its login form.");
    }
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
