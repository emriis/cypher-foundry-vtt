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
export async function selectGamemaster(page, profileName = GAMEMASTER_NAME) {
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
      option => option.trim().toLowerCase() === profileName.toLowerCase()
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
    await usernameInput.fill(profileName);
    await usernameInput.press("ArrowDown");
    await usernameInput.press("Enter");
    selectedProfile = await usernameInput.inputValue();
  }

  if (selectedProfile.toLowerCase() !== profileName.toLowerCase()) {
    throw new Error(
      "Available users: " +
      availableUsers.join(", ") +
      ". Foundry did not select the gamemaster profile. " +
      `Expected: ${profileName}; actual: ${selectedProfile}`
    );
  }
  return usernameInput;
}

/**
 * Join the seeded user once, retaining exceptions before navigation finishes.
 * @param {import("@playwright/test").Page} page Disposable Foundry client.
 * @returns {Promise<void>} Resolves after readiness; login/bootstrap failures propagate.
 */
export async function joinAsGamemaster(page, profileName = GAMEMASTER_NAME) {
  let startupFailure = null;
  const captureFailure = error => { startupFailure ??= error; };
  page.on("pageerror", captureFailure);
  try {
    await page.goto(FOUNDRY_URL);

    const usernameInput = await selectGamemaster(page, profileName);
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

    await waitForFoundryReady(page, { startupError: () => startupFailure });
  } finally {
    page.off("pageerror", captureFailure);
  }
}

/** Read only nonsecret bootstrap state; never expose settings, credentials or world documents. */
async function readStartupState(page) {
  return page.evaluate(() => ({
    ready: globalThis.game?.ready === true,
    view: globalThis.game?.view,
    url: location.href,
    title: document.title,
    body: document.body?.innerText?.slice(0, 4000) || ""
  }));
}

function describeStartupState(state) {
  return `URL: ${state.url}\nTitle: ${state.title}\nView: ${state.view}\nPage content:\n${state.body}`;
}

/**
 * Wait for actual client readiness, failing promptly on a captured bootstrap exception.
 * HTTP reachability alone does not guarantee that Foundry can vend world data.
 * @param {import("@playwright/test").Page} page Disposable Foundry client.
 * @param {{timeoutMs?: number, startupError?: () => Error|null}} options Deadline in milliseconds and captured page-error reader.
 * @returns {Promise<void>} Resolves on game.ready; otherwise rejects with the cause and client state.
 */
export async function waitForFoundryReady(page, { timeoutMs = 60_000, startupError = () => null } = {}) {
  const deadline = Date.now() + timeoutMs;
  let state;
  while (Date.now() < deadline) {
    state = await readStartupState(page);

    if (state.ready) return;
    const cause = startupError();
    if (cause) {
      throw new Error(`Foundry client initialization failed: ${cause.message}\n${describeStartupState(state)}`, { cause });
    }

    if (/game\s*worlds|configuration and setup/i.test(state.body)) {
      throw new Error(
        "Foundry did not auto-launch the E2E world. " +
        "The browser reached Setup instead. " +
        describeStartupState(state)
      );
    }

    await page.waitForTimeout(250);
  }

  state ??= await readStartupState(page);
  throw new Error(`Foundry did not become ready within ${timeoutMs / 1000} seconds. ${describeStartupState(state)}`);
}
