import { test, expect } from "@playwright/test";

test.describe("Block chords course", () => {
  const path = "/courses/block-chords/";

  test("serves the course page", async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Piano Block Chords");
  });

  test("declares its own canonical URL", async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://jazzjam.app/courses/block-chords/"
    );
  });

  test("loads every example asset", async ({ page, request }) => {
    await page.goto(path);
    const sources = await page
      .locator("img[src], audio[src], audio source[src]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("src")!));
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      const res = await request.get(src);
      expect(res.status(), src).toBe(200);
    }
  });
});
