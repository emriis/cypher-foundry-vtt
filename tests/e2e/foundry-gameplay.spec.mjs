  await page.waitForFunction(id => {
    return [...game.messages].some(message =>
      message.speaker?.actor === id ||
      message.getFlag?.("cypher", "actorId") === id
    );
  }, actorId);
}

async function dismissActiveTour(page) {
  await page.evaluate(() => {
    const Tour = globalThis.foundry?.nue?.Tour;
    Tour?.activeTour?.exit();
  });
  await expect(page.locator(".tour-overlay")).toHaveCount(0);
}

async function clickRollDialog(page, values = {}) {
  await dismissActiveTour(page);

  const form = page.locator("form").filter({
    has: page.locator('input[name="difficulty"]')
  }).last();

  await expect(form).toBeVisible();
  for (const [name, value] of Object.entries(values)) {
    const field = form.locator(`[name="${name}"]`);
    if (await field.count()) {
      await field.fill(String(value));
    }
  }

  await dismissActiveTour(page);
  await form.getByRole("button").last().click();
}

test.describe("Cypher Foundry live gameplay", () => {
  test("renders a complete playable PC dashboard for a newly created actor", async ({
    e2ePage: page
  }) => {
    const actorId = await createActor(page);

    await page.evaluate(async id => {