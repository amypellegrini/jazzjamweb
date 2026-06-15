import { test, expect } from "@playwright/test";

test.describe("Terms of Service", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/terms-of-service/");
  });

  test("displays the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", {
        name: "Terms of Service for Jazz Jam Studio",
      })
    ).toBeVisible();
  });

  test("includes a last updated date", async ({ page }) => {
    await expect(page.locator("body")).toContainText("Last Updated");
  });

  test("grants a personal, non-transferable licence to use the app", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText("Licence to Use the App");
    await expect(page.locator("body")).toContainText("personal");
    await expect(page.locator("body")).toContainText("non-transferable");
  });

  test("describes Pro Unlock as a one-time in-app purchase", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText("In-App Purchases");
    await expect(page.locator("body")).toContainText("Pro Unlock");
    await expect(page.locator("body")).toContainText("one-time");
  });

  test("references app store refund and restore-purchases policies", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText(
      "Refunds and Restoring Purchases"
    );
    await expect(page.locator("body")).toContainText("Google Play");
    await expect(page.locator("body")).toContainText("Restore Purchases");
  });

  test("includes limitation of liability and governing law clauses", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText("Limitation of Liability");
    await expect(page.locator("body")).toContainText("Governing Law");
    await expect(page.locator("body")).toContainText("laws of Spain");
  });

  test("provides a contact email", async ({ page }) => {
    await expect(page.locator("body")).toContainText("support@jazzjam.app");
  });

  test("has no horizontal scroll at a 375x812 mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/terms-of-service/");
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalScroll).toBe(false);
  });
});
