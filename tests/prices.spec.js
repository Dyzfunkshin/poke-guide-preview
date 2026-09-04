import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The prices section mounts lazily on an IntersectionObserver, but on its own page
// (/pricing/) it is already in view on load, so no scroll-into-view is needed here.
async function openPrices(page) {
  await page.goto("/pricing/");
  await page.waitForSelector(".nav-group");
  // Poll for the POPULATED table rather than the first row appearing. The section renders
  // a single "failed to load" row on error, so a first-row-visible wait passes on the error
  // state too - and under parallel workers the fetch can lose the race and land there.
  await expect
    .poll(() => page.locator("[data-prices-table] tbody tr").count(), { timeout: 30000 })
    .toBeGreaterThan(50);
}

test.describe("Prices section", () => {
  test("renders the timeline and the cost-to-complete table from the export", async ({ page }) => {
    await openPrices(page);

    // The table is the accessible fallback for the chart; it must carry real rows.
    const rowCount = await page.locator("[data-prices-table] tbody tr").count();
    expect(rowCount).toBeGreaterThan(50);

    // The chart must announce itself as a graphic with a meaningful label - and the role
    // must sit on the SVG, not on the wrapper that holds the bar buttons. A focusable
    // descendant of a role="img" element is an axe nested-interactive violation, which is
    // exactly the defect this pins: assert the role is on the svg and NOT on the wrapper.
    const svg = page.locator(".prices-chart__figure svg");
    await expect(svg).toHaveAttribute("role", "img");
    const label = await svg.getAttribute("aria-label");
    expect(label && label.trim().length).toBeTruthy();
    await expect(page.locator(".prices-chart__figure")).not.toHaveAttribute("role", "img");

    // The as-of date is a hard requirement on a public page: an estimate with no date is a claim.
    await expect(page.locator("[data-prices-asof]")).toContainText(/\d{4}-\d{2}-\d{2}|\d{4}/);
  });

  test("shows a dollar figure beside every percent", async ({ page }) => {
    await openPrices(page);
    // The owner's standing rule: percent is the rate, dollars are the stakes. A percent
    // rendered alone is the defect this asserts against - +50000% beside +$0.80 reads as
    // what it is only when the dollars are there.
    const cells = await page.locator("[data-prices-table] tbody tr td").allTextContents();
    const withPercent = cells.filter((text) => text.includes("%"));
    expect(withPercent.length).toBeGreaterThan(0);
    for (const text of withPercent) {
      expect(text, `percent shown without a dollar figure: "${text}"`).toMatch(/\$/);
    }
  });

  test("discloses coverage and the floor when a set is selected", async ({ page }) => {
    await openPrices(page);
    // The set name is a real <button>; the row itself is not a click target, which is the
    // correct shape - a whole-row handler would not be keyboard reachable.
    await page.locator("[data-prices-table] tbody tr .prices-table__set-btn").first().click();

    const detail = page.locator("[data-prices-detail]");
    await expect(detail).toBeVisible();
    // "priced N of M" must survive to the reader - a floor must never read as a complete price.
    // The exact counts live in the stats list; the coverage paragraph carries the rule.
    await expect(page.locator("[data-prices-detail-stats]")).toContainText(/priced\s+\d+\s+of\s+\d+/i);

    // The rule text is published verbatim to visitors, so it must be English, not field names.
    const note = await page.locator("[data-prices-detail-coverage]").textContent();
    expect(note && note.trim().length).toBeTruthy();
    for (const fieldName of ["pricedCount", "cardCount", "sealedCount"]) {
      expect(note, `coverage note leaks the internal field name ${fieldName}`).not.toContain(fieldName);
    }
  });

  test("routes the outbound link through the affiliate redirect, never a raw tcgplayer URL", async ({ page }) => {
    await openPrices(page);
    // The set name is a real <button>; the row itself is not a click target, which is the
    // correct shape - a whole-row handler would not be keyboard reachable.
    await page.locator("[data-prices-table] tbody tr .prices-table__set-btn").first().click();

    const href = await page.locator(".prices-detail__link a").first().getAttribute("href");
    expect(href, "outbound link must resolve through the registry").toBeTruthy();
    expect(href).not.toMatch(/^https?:\/\/(www\.)?tcgplayer\.com/);
  });

  test("axe scan of the prices section", async ({ page }) => {
    await openPrices(page);
    const results = await new AxeBuilder({ page }).include("#prices").analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
