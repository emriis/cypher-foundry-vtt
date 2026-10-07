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
}

export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  await selectGamemaster(page);

  const password = page.locator('input[type="password"]').first();
  if (await password.count()) {
    await password.fill("");
  }

  // In Foundry v14 the join screen is an application form. Target the form
  // containing the password field rather than relying on translated labels or
  // on the position of buttons on the page.
  const joinForm = page.locator("form").filter({
    has: page.locator('input[type="password"]')
  }).first();

  await joinForm.waitFor({ state: "visible", timeout: 10_000 });

  const joinButton = joinForm.locator("button").first();
  await joinButton.waitFor({ state: "visible", timeout: 10_000 });
  await joinButton.click();

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
