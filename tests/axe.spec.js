import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test("axe scan of main page", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".nav-group");
    const axe = new AxeBuilder({ page });
    const results = await axe.analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("axe scan of pricing page", async ({ page }) => {
    await page.goto("/pricing/");
    await page.waitForSelector(".nav-group");
    const axe = new AxeBuilder({ page });
    const results = await axe.analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
