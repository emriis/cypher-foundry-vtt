const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

const GAMEMASTER_NAME = "gamemaster";

async function selectGamemaster(page) {
  const usernameInput = page.locator("input:visible").first();

  await usernameInput.waitFor({
    state: "visible",
    timeout: 30_000
  });

  await usernameInput.click();
  await usernameInput.fill(GAMEMASTER_NAME);

  await usernameInput.press("ArrowDown");
  await usernameInput.press("Enter");

  const value = await usernameInput.inputValue();
  if (value.toLowerCase() !== GAMEMASTER_NAME) {
    throw new Error(
      "Foundry did not select the gamemaster profile. " +
      `Expected: ${GAMEMASTER_NAME}; actual: ${value}`
    );
  }

  return usernameInput;
}

export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  await selectGamemaster(page);

  const password = page.locator('input[type="password"]').first();

  if (await password.count()) {
    await password.fill("");
  }

  const joinButton = page.locator(
    'button[type="submit"], form button'
  ).filter({ visible: true }).last();

  if (await joinButton.count()) {
    await joinButton.click();
  } else {
    const form = page.locator("form").first();

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
