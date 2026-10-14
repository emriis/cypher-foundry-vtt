const FOUNDRY_URL =
  process.env.FOUNDRY_URL || "http://127.0.0.1:30000";

const GAMEMASTER_NAME = "gamemaster";
const GAMEMASTER_ROLE = /game\s*master|gamemaster|ma[iî]tre\s+de\s+jeu/i;

/**
 * Wait for the seeded user's control across native and legacy join forms.
 * Native options may store a Foundry User ID, so their displayed profile label
 * establishes which user was selected. Search inputs still submit a username.
 * @param {import("@playwright/test").Page} page Disposable Foundry login page.
 * @returns {Promise<import("@playwright/test").Locator>} Selected username control.
 */
export async function selectGamemaster(page) {
  const usernameLabel = /sélectionner un utilisateur|select (?:a )?user|username/i;
  const candidates = [
    page.locator("#join-username"),
    page.locator('input[name="username"]'),
    page.locator('select[name="username"]'),
    page.getByRole("combobox", { name: usernameLabel }),
    page.getByRole("textbox", { name: usernameLabel })
  ];
  // ApplicationV2 can mount after navigation completes. A locator union keeps
  // every supported control eligible while waiting, rather than freezing a
  // missing textbox fallback after a single early count of the new combobox.
  const usernameInput = candidates.reduce((combined, candidate) => combined.or(candidate)).first();
  await usernameInput.waitFor({
    state: "visible",
    timeout: 30_000
  });

  const tagName = await usernameInput.evaluate(element => element.tagName);
  let selectedProfile;
  let availableUsers = [];
  if (tagName === "SELECT") {
    const options = await usernameInput.locator("option").allTextContents();
    availableUsers = options;
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
    selectedProfile = (await usernameInput.locator("option:checked").allTextContents()).join(", ").trim();
  } else {
    await usernameInput.click();
    await usernameInput.fill(GAMEMASTER_NAME);
    await usernameInput.press("ArrowDown");
    await usernameInput.press("Enter");
    selectedProfile = await usernameInput.inputValue();
  }

  if (selectedProfile.toLowerCase() !== GAMEMASTER_NAME) {
    throw new Error(
      "Available users: " +
      availableUsers.join(", ") +
      ". Foundry did not select the gamemaster profile. " +
      `Expected: ${GAMEMASTER_NAME}; actual: ${selectedProfile}`
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
    // Preserve the submitter's action name for ApplicationV2 join handlers.
    joinButton.evaluate(button => button.form.requestSubmit(button))
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
