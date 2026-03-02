import { expect, test } from "@playwright/test";

test.describe("Navigation behavior", () => {
  test("loads hash deep link and marks matching nav item active", async ({ page }) => {
    await page.goto("/#shipping-heading");
    await page.waitForSelector(".nav-group");

    await expect(page.locator(".nav-link--active[data-target='shipping-heading']")).toBeVisible();

    const headingTop = await page.locator("#shipping-heading").evaluate((el) => Math.abs(el.getBoundingClientRect().top));
    expect(headingTop).toBeLessThan(140);
  });

  test("inline anchor links use smooth-scrolling navigation handling", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".nav-group");

    await page.evaluate(() => {
      const link = document.createElement("a");
      link.id = "test-inline-anchor";
      link.href = "#support-heading";
      link.textContent = "Jump to support";
      link.style.position = "fixed";
      link.style.top = "8px";
      link.style.right = "8px";
      link.style.zIndex = "9999";
      document.body.appendChild(link);
    });

    await page.click("#test-inline-anchor");
    await expect(page).toHaveURL(/#support-heading$/);
    await expect(page.locator(".nav-link--active[data-target='support-heading']")).toBeVisible();
  });

  test("shows section load error status when a section fetch fails", async ({ page }) => {
    await page.route("**/content/welcome.html", (route) => route.abort());

    await page.goto("/");
    await expect(page.locator(".nav-status--error")).toContainText("Some sections failed to load");
    await expect(page.locator(".content-status--error")).toContainText("Some sections failed to load");
  });
});
