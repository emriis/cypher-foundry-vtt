import { chromium } from "@playwright/test";

const MIN_CHROMIUM_MAJOR = 146;

const browser = await chromium.launch({
  channel: "chromium",
  headless: true
});

try {
  const version = browser.version();
  const major = Number(version.split(".")[0]);

  if (!Number.isInteger(major) || major < MIN_CHROMIUM_MAJOR) {
    throw new Error(
      "Foundry E2E requires Chromium >= " +
      `${MIN_CHROMIUM_MAJOR}; Playwright launched ${version}.`
    );
  }

  console.log(`Playwright Chromium: ${version}`);
} finally {
  await browser.close();
}
