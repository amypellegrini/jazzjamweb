import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(
      "Jazz Jam Studio - Practice sessions that matter"
    );
  });

  test("displays main heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { level: 1 }).first()
    ).toBeVisible();
  });

  test("displays app showcase section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "The Jazz Jam App" })
    ).toBeVisible();
    await expect(page.getByAltText("Jazz Jam App")).toBeVisible();
  });

  test("displays three feature cards", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Virtual Band Practice" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Chord Progression Library" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Flexible Practice Tools" })
    ).toBeVisible();
  });

  test("displays beta signup section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Join our beta" })
    ).toBeVisible();
    await expect(page.getByLabel("email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Subscribe" })
    ).toBeVisible();
  });

  test("contains link to privacy policy", async ({ page }) => {
    const privacyLink = page.getByRole("link", { name: /privacy policy/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute("href", /privacy-policy/);
  });

  test("contains link to license page", async ({ page }) => {
    const licenseLink = page.getByRole("link", { name: /license/i });
    await expect(licenseLink).toBeVisible();
    await expect(licenseLink).toHaveAttribute("href", /license/);
  });

  test("has SEO meta tags", async ({ page }) => {
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /jazz/i);

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /Jazz Jam Studio/);

    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute("content", /.+/);

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /screenshot/);

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute("href", /jazzjam\.app/);
  });
});
