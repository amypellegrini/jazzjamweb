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

  test.describe("mobile layout", () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test("hero text is centered and CTA is at the bottom", async ({ page }) => {
      await page.goto("/");
      const hero = page.locator(".hero");
      const heading = page.locator(".hero-content h1:visible");
      const ctaBlock = page.locator(".cta-block");

      const heroBox = await hero.boundingBox();
      const headingBox = await heading.boundingBox();
      const ctaBox = await ctaBlock.boundingBox();

      // Heading should be roughly vertically centered in the hero
      const heroCenter = heroBox!.y + heroBox!.height / 2;
      const headingCenter = headingBox!.y + headingBox!.height / 2;
      expect(Math.abs(headingCenter - heroCenter)).toBeLessThan(heroBox!.height * 0.2);

      // CTA block bottom should be near the hero bottom (within 80px for padding)
      const ctaBottom = ctaBox!.y + ctaBox!.height;
      const heroBottom = heroBox!.y + heroBox!.height;
      expect(heroBottom - ctaBottom).toBeLessThan(80);
    });

    test("CTA buttons are full width on mobile", async ({ page }) => {
      await page.goto("/");
      const ctaBlock = page.locator(".cta-block");
      const ctaBlockBox = await ctaBlock.boundingBox();

      const primaryCta = page.locator(".primary-cta");
      const secondaryCta = page.locator(".secondary-cta");

      const primaryBox = await primaryCta.boundingBox();
      const secondaryBox = await secondaryCta.boundingBox();

      // Buttons should stretch to fill the CTA block width
      expect(primaryBox!.width).toBeCloseTo(ctaBlockBox!.width, 0);
      expect(secondaryBox!.width).toBeCloseTo(ctaBlockBox!.width, 0);
    });

    test("CTA buttons are stacked vertically with primary at bottom on mobile", async ({ page }) => {
      await page.goto("/");
      const primaryCta = page.locator(".primary-cta");
      const secondaryCta = page.locator(".secondary-cta");
      const badge = page.locator(".google-play-badge");

      const primaryBox = await primaryCta.boundingBox();
      const secondaryBox = await secondaryCta.boundingBox();
      const badgeBox = await badge.boundingBox();

      // Primary CTA (Join our beta) should be below secondary CTA (Learn more)
      expect(primaryBox!.y).toBeGreaterThan(secondaryBox!.y);
      // Badge should be above the buttons
      expect(badgeBox!.y).toBeLessThan(secondaryBox!.y);
    });

    test("Google Play badge is centered on mobile", async ({ page }) => {
      await page.goto("/");
      const badge = page.locator(".google-play-badge");
      const ctaBlock = page.locator(".cta-block");

      const badgeBox = await badge.boundingBox();
      const ctaBlockBox = await ctaBlock.boundingBox();

      // Badge should be roughly centered within the CTA block
      const badgeCenter = badgeBox!.x + badgeBox!.width / 2;
      const blockCenter = ctaBlockBox!.x + ctaBlockBox!.width / 2;
      expect(Math.abs(badgeCenter - blockCenter)).toBeLessThan(5);
    });

    test("beta signup CTA appears before form on mobile", async ({ page }) => {
      await page.goto("/");
      const form = page.locator(".form-container");
      const ctaContent = page.locator(".beta-signup-content");

      const formBox = await form.boundingBox();
      const ctaBox = await ctaContent.boundingBox();

      // CTA content should appear above the form
      expect(ctaBox!.y).toBeLessThan(formBox!.y);
    });

    test("beta signup form is full width on mobile", async ({ page }) => {
      await page.goto("/");
      const form = page.locator(".form-container");

      const formBox = await form.boundingBox();
      const viewportWidth = 375;

      // Form should span nearly the full viewport width (minus container padding)
      expect(formBox!.width).toBeGreaterThan(viewportWidth * 0.8);
    });
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
