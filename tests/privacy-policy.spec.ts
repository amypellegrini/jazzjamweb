import { test, expect } from "@playwright/test";

test.describe("Privacy Policy", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/privacy-policy/");
  });

  test("displays the page heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Privacy Policy for Jazz Jam Studio" })
    ).toBeVisible();
  });

  test("discloses Sentry crash reporting in data collection", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText(
      "Crash Reporting via Sentry"
    );
    await expect(page.locator("body")).toContainText("crash reports");
    await expect(page.locator("body")).toContainText("device information");
    await expect(page.locator("body")).toContainText("stack traces");
  });

  test("states no PII is intentionally collected via Sentry", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText(
      "No personally identifiable information is intentionally collected"
    );
  });

  test("lists Sentry in third-party services with privacy policy link", async ({
    page,
  }) => {
    const sentryLink = page.getByRole("link", {
      name: /sentry.*privacy policy/i,
    });
    await expect(sentryLink).toBeVisible();
    await expect(sentryLink).toHaveAttribute(
      "href",
      "https://sentry.io/privacy/"
    );
  });

  test("lists all third-party services", async ({ page }) => {
    for (const service of [
      "MailerLite",
      "Google Play Store",
      "Sentry",
      "Plausible",
      "RevenueCat",
    ]) {
      await expect(page.locator("body")).toContainText(service);
    }
  });

  test("discloses RevenueCat in-app purchase data collection", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText(
      "In-App Purchases via RevenueCat"
    );
    await expect(page.locator("body")).toContainText("purchase receipts");
    await expect(page.locator("body")).toContainText("anonymous app user ID");
  });

  test("lists RevenueCat in third-party services with privacy policy link", async ({
    page,
  }) => {
    const revenueCatLink = page.getByRole("link", {
      name: /revenuecat.*privacy policy/i,
    });
    await expect(revenueCatLink).toBeVisible();
    await expect(revenueCatLink).toHaveAttribute(
      "href",
      "https://www.revenuecat.com/privacy/"
    );
  });

  test("covers GDPR rights for EU users with a contact route", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText(
      "Your Rights Under the GDPR"
    );
    for (const right of [
      "Right of access",
      "Right to rectification",
      "Right to erasure",
    ]) {
      await expect(page.locator("body")).toContainText(right);
    }
    await expect(page.locator("body")).toContainText("support@jazzjam.app");
  });

  test("discloses Plausible analytics on the website", async ({ page }) => {
    await expect(page.locator("body")).toContainText("Plausible Analytics");
    await expect(page.locator("body")).toContainText("does not use cookies");
    await expect(page.locator("body")).toContainText(
      "no personally identifiable information is collected"
    );
  });

  test("lists Plausible in third-party services with privacy policy link", async ({
    page,
  }) => {
    const plausibleLink = page.getByRole("link", {
      name: /plausible.*privacy policy/i,
    });
    await expect(plausibleLink).toBeVisible();
    await expect(plausibleLink).toHaveAttribute(
      "href",
      "https://plausible.io/privacy"
    );
  });

  test("explains Sentry data is used for bug fixing", async ({ page }) => {
    await expect(page.locator("body")).toContainText(
      "identify and fix bugs and improve app stability"
    );
  });
});
