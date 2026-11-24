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

  test("shows when the policy was last updated", async ({ page }) => {
    await expect(page.locator("body")).toContainText(
      "Last Updated: November 24, 2026"
    );
  });

  test("has a section on accounts and Google sign-in", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Accounts and Google Sign-In" })
    ).toBeVisible();
    await expect(page.locator("body")).toContainText("Continue with Google");
  });

  test("discloses what email sign-up collects", async ({ page }) => {
    await expect(page.locator("body")).toContainText(
      "we collect your email address and a password"
    );
    await expect(page.locator("body")).toContainText("hashed");
  });

  // Passwords pass through the jazzjam.app Worker on their way to the
  // authentication provider, so "never see" would be false; "never store" is
  // the claim we can stand behind.
  test("claims only that passwords are never stored in plain text", async ({
    page,
  }) => {
    const body = page.locator("body");
    await expect(body).toContainText("we never store it in plain text");
    await expect(body).not.toContainText(/never see it in plain text/i);
  });

  test("discloses the Google scopes requested and the data received", async ({
    page,
  }) => {
    const body = page.locator("body");
    for (const scope of ["openid", "email", "profile"]) {
      await expect(
        page.locator("code").filter({ hasText: new RegExp(`^${scope}$`) })
      ).toBeVisible();
    }
    await expect(body).toContainText(
      "your Google account's email address, your name, your profile picture, and a Google account identifier"
    );
    await expect(body).toContainText(
      "We do not get access to your Gmail, contacts, Google Drive, or anything else in your Google account"
    );
  });

  test("discloses that account data is stored with Supabase", async ({
    page,
  }) => {
    await expect(page.locator("body")).toContainText("Supabase Auth");
    const supabaseLink = page.getByRole("link", {
      name: /supabase.*privacy policy/i,
    });
    await expect(supabaseLink).toBeVisible();
    await expect(supabaseLink).toHaveAttribute(
      "href",
      "https://supabase.com/privacy"
    );
  });

  test("discloses the sign-in session cookies", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toContainText("session cookies");
    await expect(body).toContainText("HttpOnly");
    await expect(body).toContainText("30 days");
    await expect(body).toContainText(
      "not used for tracking or advertising"
    );
  });

  test("explains how account data is used", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toContainText("Create and secure your account");
    await expect(body).toContainText("accounts@jazzjam.app");
    await expect(body).toContainText(
      "We do not sell your account data or share it for advertising"
    );
  });

  test("states Limited Use of Google user data", async ({ page }) => {
    await expect(page.locator("body")).toContainText(
      "including the Limited Use requirements"
    );
    const policyLink = page.getByRole("link", {
      name: "Google API Services User Data Policy",
    });
    await expect(policyLink).toBeVisible();
    await expect(policyLink).toHaveAttribute(
      "href",
      "https://developers.google.com/terms/api-services-user-data-policy"
    );
  });

  test("explains account data retention and how to ask for deletion", async ({
    page,
  }) => {
    const body = page.locator("body");
    await expect(body).toContainText(
      "We keep your account data for as long as your account exists"
    );
    await expect(body).toContainText(
      "ask us to delete your account and the data associated with it by emailing support@jazzjam.app"
    );
  });

  test("no longer claims that no user data is held", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).not.toContainText(
      /we do not maintain any databases with user information/i
    );
    await expect(body).not.toContainText(/we do not maintain user databases/i);
    await expect(body).toContainText(
      "Beyond that account data, we hold no other databases of user information"
    );
  });

  test("lists Supabase and Google sign-in among third-party services", async ({
    page,
  }) => {
    const services = page.locator("li").filter({
      has: page.locator("strong"),
    });
    await expect(
      services.filter({ hasText: /^Supabase:/ })
    ).toContainText("authentication provider");
    await expect(
      services.filter({ hasText: /^Google Sign-In:/ })
    ).toBeVisible();
  });
});
