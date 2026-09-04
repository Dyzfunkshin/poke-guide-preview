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

  test("the window switcher actually changes rendered numbers", async ({ page }) => {
    await openPrices(page);

    const statsBefore = await page.locator("[data-prices-stats]").innerText();
    const summaryBefore = await page.locator("[data-prices-pulse-summary]").innerText();

    const sevenDayBtn = page.locator('.prices-window__btn[data-window="7d"]');
    await expect(sevenDayBtn).toHaveAttribute("aria-pressed", "false");
    await sevenDayBtn.click();
    await expect(sevenDayBtn).toHaveAttribute("aria-pressed", "true");

    // The pulse summary always restates the active window's label - a cheap, reliable
    // signal that a re-render actually ran (rather than the click doing nothing).
    await expect(page.locator("[data-prices-pulse-summary]")).toContainText("7 days");

    // The underlying figures come from a completely different export file for 7d vs the
    // 30d default, so the rendered market-pulse text must differ, not just the label.
    await expect
      .poll(() => page.locator("[data-prices-stats]").innerText())
      .not.toBe(statsBefore);
    const summaryAfter = await page.locator("[data-prices-pulse-summary]").innerText();
    expect(summaryAfter).not.toBe(summaryBefore);

    // Switching back to 30 days must restore the default active state.
    const thirtyDayBtn = page.locator('.prices-window__btn[data-window="30d"]');
    await thirtyDayBtn.click();
    await expect(thirtyDayBtn).toHaveAttribute("aria-pressed", "true");
    await expect(sevenDayBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("risers and fallers render real rows with the eligibility rule stated", async ({ page }) => {
    await openPrices(page);

    await expect
      .poll(() => page.locator("[data-prices-risers-list] li").count())
      .toBeGreaterThan(0);
    await expect
      .poll(() => page.locator("[data-prices-fallers-list] li").count())
      .toBeGreaterThan(0);

    // The mover eligibility floor is published English, built from /api/meta's own
    // ranking rules rather than hard-coded, so it must at least mention coverage,
    // a dollar floor and a confidence floor.
    const rule = await page.locator("[data-prices-movers-rule]").textContent();
    expect(rule).toMatch(/coverage/i);
    expect(rule).toMatch(/\$/);
    expect(rule).toMatch(/confidence/i);

    // Every riser/faller row carries its own outbound TCGplayer link. It must be an
    // affiliate link AND it must actually resolve. An earlier version pointed at
    // /go/tcgplayer/, a route the README documents but which exists on no branch and
    // 404s on both production and preview - so this pins the Impact deep link that
    // scripts/lib/tcgplayer-affiliate.js builds, and pins that it is absolute (a
    // root-relative href would also break under the subpath-served preview).
    const firstMoverLink = page.locator("[data-prices-risers-list] .prices-mover__link").first();
    const moverHref = await firstMoverLink.getAttribute("href");
    expect(moverHref).toBeTruthy();
    expect(moverHref, "must not be a raw tcgplayer.com link").not.toMatch(/^https?:\/\/(www\.)?tcgplayer\.com/);
    expect(moverHref, "must not point at the non-existent /go/ route").not.toMatch(/\/go\/tcgplayer\//);
    expect(moverHref, "must be an absolute Impact affiliate deep link").toMatch(
      /^https:\/\/partner\.tcgplayer\.com\/c\/\d+\/\d+\/\d+\?u=/
    );
    // ...and it must carry a real product, not a bare landing page.
    expect(decodeURIComponent(moverHref)).toMatch(/tcgplayer\.com\/product\/\d+/);
  });

  test("dollars sit beside every price-change percent in the new panels", async ({ page }) => {
    await openPrices(page);
    await expect
      .poll(() => page.locator("[data-prices-risers-list] li").count())
      .toBeGreaterThan(0);

    // Scoped to the cells that actually represent a price CHANGE (a rate with a real
    // dollar total behind it): by-era/by-set/programs rollup values and mover changes.
    // Ratios that are not price changes (coverage %, "N% of series", catalog share %)
    // are legitimately bare percents elsewhere on the page and are not swept here.
    const selectors = [
      "[data-prices-era-rollups] .prices-rollup__value",
      "[data-prices-programs-rollups] .prices-rollup__value",
      "[data-prices-risers-list] .prices-mover__change",
      "[data-prices-fallers-list] .prices-mover__change"
    ];
    let checked = 0;
    for (const selector of selectors) {
      const texts = await page.locator(selector).allTextContents();
      for (const text of texts) {
        if (!text.includes("%")) continue;
        checked += 1;
        expect(text, `percent shown without a dollar figure in ${selector}: "${text}"`).toMatch(/\$/);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
