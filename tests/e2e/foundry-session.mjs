const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

const GAMEMASTER_NAME = "gamemaster";
const GAMEMASTER_ROLE = /game\s*master|gamemaster|ma[iî]tre\s+de\s+jeu/i;

async function selectGamemaster(page) {
  const candidates = [
    page.locator("#join-username"),
    page.locator('input[name="username"]'),
    page.locator('select[name="username"]')
  ];

  let usernameInput = null;
  for (const candidate of candidates) {
    if (await candidate.count()) {
      usernameInput = candidate.first();
      break;
    }
  }

  if (!usernameInput) {
    usernameInput = page
      .getByRole("textbox", {
        name: /sélectionner un utilisateur|select (?:a )?user|username/i
      })
      .first();
  }

  await usernameInput.waitFor({
    state: "visible",
    timeout: 30_000
  });

  const tagName = await usernameInput.evaluate(element => element.tagName);
  if (tagName === "SELECT") {
    const options = await usernameInput.locator("option").allTextContents();
    const match = options.find(
      option => option.trim().toLowerCase() === GAMEMASTER_NAME
    );
    if (!match) {
      throw new Error(
        "Available users: " + options.join(", ") +
        ". Gamemaster profile was not found."
      );
    }
    await usernameInput.selectOption({ label: match });
  } else {
    await usernameInput.click();
    await usernameInput.fill(GAMEMASTER_NAME);
    await usernameInput.press("ArrowDown");
    await usernameInput.press("Enter");
  }

  const value = await usernameInput.inputValue();
  if (value.toLowerCase() !== GAMEMASTER_NAME) {
    throw new Error(
      "Available users: " +
      (await page.locator("#join-username option").allTextContents()).join(", ") +
      ". Foundry did not select the gamemaster profile. " +
      `Expected: ${GAMEMASTER_NAME}; actual: ${value}`
    );
  }
  return usernameInput;
}

export async function joinAsGamemaster(page) {
  await page.goto(FOUNDRY_URL);

  const usernameInput = await selectGamemaster(page);
  const joinForm = usernameInput.locator("xpath=ancestor::form[1]");

  const password = joinForm.locator('input[type="password"]').first();
  if (await password.count()) {
    await password.fill("");
  }

  const joinButton = joinForm.locator(
    'button[type="submit"], input[type="submit"]'
  ).first();
  await joinButton.waitFor({ state: "visible", timeout: 10_000 });

  await Promise.all([
    page.waitForURL(url => !url.pathname.endsWith("/join"), {
      timeout: 60_000
    }),
    joinForm.evaluate(form => form.requestSubmit())
  ]);

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

    if (/game\s*worlds|configuration and setup/i.test(state.body)) {
      throw new Error(
        "Foundry did not auto-launch the E2E world. " +
        "The browser reached Setup instead. " +
        `URL: ${state.url}\n` +
        `Title: ${state.title}\n` +
        `View: ${state.view}\n` +
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
