import { expect, test } from "@playwright/test";

test.describe("Top page nav (Guide / Pricing Explorer)", () => {
  test("navigates Guide -> Pricing Explorer -> Guide and marks aria-current correctly", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".nav-group");

    const guideLink = page.locator(".page-nav__link", { hasText: "Guide" });
    const pricingLink = page.locator(".page-nav__link", { hasText: "Pricing Explorer" });

    await expect(guideLink).toHaveAttribute("aria-current", "page");
    await expect(pricingLink).not.toHaveAttribute("aria-current", "page");

    await pricingLink.click();
    await expect(page).toHaveURL(/\/pricing\/$/);
    await page.waitForSelector(".nav-group");

    const pricingLinkOnPricingPage = page.locator(".page-nav__link", { hasText: "Pricing Explorer" });
    const guideLinkOnPricingPage = page.locator(".page-nav__link", { hasText: "Guide" });
    await expect(pricingLinkOnPricingPage).toHaveAttribute("aria-current", "page");
    await expect(guideLinkOnPricingPage).not.toHaveAttribute("aria-current", "page");

    await guideLinkOnPricingPage.click();
    await expect(page).toHaveURL(/\/$/);
    await page.waitForSelector(".nav-group");
    await expect(page.locator(".page-nav__link", { hasText: "Guide" })).toHaveAttribute("aria-current", "page");
  });
});
