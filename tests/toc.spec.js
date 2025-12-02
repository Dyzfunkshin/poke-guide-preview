import { expect, test } from "@playwright/test";

test.describe("ToC scroll highlighting", () => {
  test("highlights first and last sections while scrolling", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".nav-group");

    const headings = await page.locator("h2").all();
    expect(headings.length).toBeGreaterThan(1);

    // First heading should be active initially
    const firstId = await headings[0].getAttribute("id");
    expect(firstId).toBeTruthy();
    if (firstId) {
      await expect(page.locator(`.nav-link--active[data-target='${firstId}']`)).toBeVisible();
    }

    // Scroll to the last heading and ensure it becomes active
    const lastHeading = headings[headings.length - 1];
    const lastId = await lastHeading.getAttribute("id");
    expect(lastId).toBeTruthy();

    // Scroll to bottom to ensure the last heading crosses the top reference line
    await page.evaluate(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
    });

    // Wait for scroll spy to mark the last section active
    if (lastId) {
      await page.waitForFunction(
        (id) => !!document.querySelector(`.nav-link--active[data-target='${id}']`),
        lastId,
        { timeout: 5000 }
      );
    }

    if (lastId) {
      await expect(page.locator(`.nav-link--active[data-target='${lastId}']`)).toBeVisible();
    }
  });
});
