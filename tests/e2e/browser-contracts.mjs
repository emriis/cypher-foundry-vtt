/** Override only the current document's dice generator; reload creates a fresh owner. */
export async function setDiceUniform(page, value) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Dice uniform input must be in [0, 1).");
  }
  await page.evaluate(value => {
    globalThis.cypherE2EOriginalRandomUniform ??= CONFIG.Dice.randomUniform;
    CONFIG.Dice.randomUniform = () => value;
  }, value);
}

/** A reload discarded the override and its saved function together; never restore undefined. */
export async function restoreDiceUniform(page) {
  await page.evaluate(() => {
    if (typeof globalThis.cypherE2EOriginalRandomUniform === "function") {
      CONFIG.Dice.randomUniform = globalThis.cypherE2EOriginalRandomUniform;
      delete globalThis.cypherE2EOriginalRandomUniform;
    }
    if (typeof CONFIG.Dice.randomUniform !== "function") throw new Error("Dice generator is unavailable");
  });
}

/** Keep an existing test failure primary; otherwise browser exceptions must fail the run. */
export function assertNoUnexpectedPageErrors(errors, alreadyFailed = false) {
  if (!alreadyFailed && errors.length) throw new Error(`Unexpected browser exceptions:\n${errors.join("\n")}`);
}
