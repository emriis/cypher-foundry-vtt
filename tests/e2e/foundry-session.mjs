const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

const GAMEMASTER_OPTION = /game\\s*master|gamemaster|ma[iî]tre\\s+de\\s+jeu/i;

export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  const userSelect = page.locator("select").first();
  if (await userSelect.count()) {
    const options = userSelect.locator("option");
    const optionCount = await options.count();
    let gamemasterValue = null;

    for (let index = 0; index < optionCount; index += 1) {
      const option = options.nth(index);
      const text = (await option.textContent()) || "";
      if (GAMEMASTER_OPTION.test(text)) {
        gamemasterValue = await option.getAttribute("value");
        break;
      }
    }

    if (gamemasterValue === null) {
      const availableUsers = await options.allTextContents();
      throw new Error(
        "Foundry join page did not expose a Gamemaster user. " +
        `Available users: ${JSON.stringify(availableUsers)}`
      );
    }

    await userSelect.selectOption(gamemasterValue);

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
      await form.evaluate(formElement => {
        if (typeof formElement.requestSubmit === "function") {
          formElement.requestSubmit();
        } else {
          formElement.submit();
        }
      });
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

    if (/game\\s*worlds|configuration and setup/i.test(state.body)) {
      throw new Error(
        "Foundry did not auto-launch the E2E world. " +
        "The browser reached Setup instead. " +
        `URL: ${state.url}\\n` +
        `Title: ${state.title}\\n` +
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
