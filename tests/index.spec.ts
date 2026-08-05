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

  test("displays Pro Unlock section listing the export formats from the app paywall", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");
    await expect(proUnlock).toBeVisible();
    await expect(
      proUnlock.getByText("Export your backing tracks")
    ).toBeVisible();
    await expect(
      proUnlock.getByRole("heading", { name: "MIDI", exact: true })
    ).toBeVisible();
    await expect(
      proUnlock.getByRole("heading", { name: "WAV", exact: true })
    ).toBeVisible();
    await expect(
      proUnlock.getByRole("heading", { name: "MP3", exact: true })
    ).toBeVisible();
    await expect(
      proUnlock.getByRole("heading", { name: "MusicXML", exact: true })
    ).toBeVisible();
  });

  test("does not display hardcoded pricing in Pro Unlock section", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");
    await expect(proUnlock).toBeVisible();
    await expect(proUnlock).not.toContainText("$");
    await expect(proUnlock).not.toContainText(/founder/i);
  });

  test("Pro Unlock store CTA links to the app's store listing", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");
    const storeCta = proUnlock.locator(".pro-unlock-cta");
    await expect(storeCta).toBeVisible();
    await expect(storeCta).toHaveText("Unlock Pro");
    await expect(storeCta).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.musicpracticepro&utm_source=emea_Med"
    );
  });

  test("displays beta signup section", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Stay in the loop" })
    ).toBeVisible();
    await expect(page.getByLabel("email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Subscribe" })
    ).toBeVisible();
  });

  test("no pre-launch beta/waitlist copy remains", async ({ page }) => {
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/join our beta/i);
    expect(bodyText).not.toMatch(/get the app before it'?s launched/i);
    expect(bodyText).not.toMatch(/waitlist/i);
  });

  test("subscribe form copy reflects a news/updates confirmation flow, not waitlist instructions", async ({ page }) => {
    await expect(page.locator(".form-description")).toHaveText(
      "We'll send a confirmation link to your email."
    );

    const steps = page.locator(".beta-signup-steps");
    await expect(steps).toContainText("Check your email to confirm");
    await expect(steps).not.toContainText(/instructions/i);
  });

  test("hero primary CTA links to the live store listing", async ({ page }) => {
    const primaryCta = page.locator(".primary-cta");
    await expect(primaryCta).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.musicpracticepro&utm_source=emea_Med"
    );
  });

  test("Google Play badge is a clickable link to the store listing", async ({ page }) => {
    const badgeLink = page.locator("a.google-play-badge");
    await expect(badgeLink).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.musicpracticepro&utm_source=emea_Med"
    );
    await expect(badgeLink.locator("img")).toBeVisible();
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

    test.beforeEach(async ({ page }) => {
      await page.goto("/");
    });

    test("hero text is centered and CTA is at the bottom", async ({ page }) => {
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
      expect(heroBottom - ctaBottom).toBeLessThanOrEqual(80);
    });

    test("CTA buttons are full width on mobile", async ({ page }) => {
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
      const badge = page.locator(".google-play-badge");
      const ctaBlock = page.locator(".cta-block");

      const badgeBox = await badge.boundingBox();
      const ctaBlockBox = await ctaBlock.boundingBox();

      // Badge should be roughly centered within the CTA block
      const badgeCenter = badgeBox!.x + badgeBox!.width / 2;
      const blockCenter = ctaBlockBox!.x + ctaBlockBox!.width / 2;
      expect(Math.abs(badgeCenter - blockCenter)).toBeLessThan(5);
    });

    test("Learn More section is shorter than 100vh to avoid Android browser controls overlap", async ({ page }) => {
      const section = page.locator(".app-showcase-section");
      const sectionBox = await section.boundingBox();
      const viewportHeight = 812;

      // Section should be less than 100vh so content isn't clipped by device controls
      expect(sectionBox!.height).toBeLessThan(viewportHeight);
    });

    test("beta signup CTA appears before form on mobile", async ({ page }) => {
      const form = page.locator(".form-container");
      const ctaContent = page.locator(".beta-signup-content");

      const formBox = await form.boundingBox();
      const ctaBox = await ctaContent.boundingBox();

      // CTA content should appear above the form
      expect(ctaBox!.y).toBeLessThan(formBox!.y);
    });

    test("beta signup form is full width on mobile", async ({ page }) => {
      const form = page.locator(".form-container");

      const formBox = await form.boundingBox();
      const viewportWidth = 375;

      // Form should span nearly the full viewport width (minus container padding)
      expect(formBox!.width).toBeGreaterThan(viewportWidth * 0.8);
    });
  });

  test.describe("tablet layout", () => {
    // Reference tablet viewports from issue #35.
    const tabletViewports = [
      { name: "iPad Mini portrait", width: 768, height: 1024 },
      { name: "iPad Air portrait", width: 820, height: 1180 },
      { name: "iPad Mini landscape", width: 1024, height: 768 },
      { name: "iPad Air landscape", width: 1180, height: 820 },
    ];

    const topLevelSections = [
      ".hero",
      ".app-showcase-section",
      ".features",
      ".pro-unlock",
      ".beta-signup",
      "footer",
    ];

    for (const { name, width, height } of tabletViewports) {
      test.describe(`${name} (${width}x${height})`, () => {
        test.beforeEach(async ({ page }) => {
          await page.setViewportSize({ width, height });
          await page.goto("/");
        });

        test("page does not scroll horizontally and every section fits the viewport", async ({
          page,
        }) => {
          const hasHorizontalScroll = await page.evaluate(
            () =>
              document.documentElement.scrollWidth >
              document.documentElement.clientWidth
          );
          expect(hasHorizontalScroll).toBe(false);

          for (const selector of topLevelSections) {
            const box = await page.locator(selector).boundingBox();
            expect(box, `${selector} should render`).not.toBeNull();
            expect(box!.x, `${selector} left edge`).toBeGreaterThanOrEqual(0);
            expect(
              box!.x + box!.width,
              `${selector} right edge`
            ).toBeLessThanOrEqual(width);
          }
        });

        test("features cards render in a multi-column layout without overflow", async ({
          page,
        }) => {
          const columnCount = await page
            .locator(".features-grid")
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(" ").length
            );
          expect(columnCount, "features grid columns").toBeGreaterThanOrEqual(
            2
          );

          const cards = page.locator(".feature-card");
          const count = await cards.count();
          expect(count).toBeGreaterThan(0);
          for (let i = 0; i < count; i++) {
            const box = await cards.nth(i).boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          }
        });

        test("Pro Unlock benefit cards render two or more per row without overflow", async ({
          page,
        }) => {
          const columnCount = await page
            .locator(".pro-unlock-grid")
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(" ").length
            );
          expect(
            columnCount,
            "pro unlock grid columns"
          ).toBeGreaterThanOrEqual(2);

          const cards = page.locator(".pro-unlock-feature");
          const count = await cards.count();
          expect(count).toBeGreaterThan(0);
          for (let i = 0; i < count; i++) {
            const box = await cards.nth(i).boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          }
        });

        test("hero text and CTA fit the viewport and sit over a dimmed hero image", async ({
          page,
        }) => {
          for (const selector of [
            ".hero-content h1",
            ".hero p.tagline",
            ".primary-cta",
          ]) {
            const box = await page.locator(`${selector}:visible`).boundingBox();
            expect(box, `${selector} should render`).not.toBeNull();
            expect(box!.x, `${selector} left edge`).toBeGreaterThanOrEqual(0);
            expect(
              box!.x + box!.width,
              `${selector} right edge`
            ).toBeLessThanOrEqual(width);
          }

          // The hero artwork must be dimmed so the text stays readable over it.
          const heroImageOpacity = await page
            .locator(".hero-image")
            .evaluate((el) => parseFloat(getComputedStyle(el).opacity));
          expect(heroImageOpacity, "hero image opacity").toBeLessThan(1);
        });

        test("primary CTAs meet the 44px minimum touch-target height", async ({
          page,
        }) => {
          for (const selector of [".primary-cta", ".pro-unlock-cta"]) {
            const box = await page.locator(selector).boundingBox();
            expect(box, `${selector} should render`).not.toBeNull();
            expect(
              box!.height,
              `${selector} height`
            ).toBeGreaterThanOrEqual(44);
          }
        });
      });
    }
  });

  test.describe("Pro Unlock section responsiveness", () => {
    const viewports = [
      { name: "desktop", width: 1280, height: 800 },
      { name: "tablet", width: 820, height: 1180 },
      { name: "mobile", width: 375, height: 812 },
    ];

    for (const { name, width, height } of viewports) {
      test(`renders without overflow or clipping on ${name} (${width}x${height})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto("/");

        const proUnlock = page.locator(".pro-unlock");
        await expect(proUnlock).toBeVisible();

        // The page itself must not scroll horizontally at this viewport.
        const hasHorizontalScroll = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
        );
        expect(hasHorizontalScroll).toBe(false);

        // The section must fit within the viewport width, not overflow it.
        const sectionBox = await proUnlock.boundingBox();
        expect(sectionBox!.width).toBeLessThanOrEqual(width);

        // Key sub-elements stay visible (not clipped or collapsed) at every width.
        await expect(proUnlock.locator(".pro-unlock-grid")).toBeVisible();
        await expect(proUnlock.locator(".pro-unlock-actions")).toBeVisible();
        await expect(proUnlock.locator(".pro-unlock-cta")).toBeVisible();

        // Each feature card must render at a sane, non-zero size (no clipping to 0).
        const featureCards = proUnlock.locator(".pro-unlock-feature");
        const count = await featureCards.count();
        expect(count).toBe(4);
        for (let i = 0; i < count; i++) {
          const box = await featureCards.nth(i).boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThan(0);
          expect(box!.height).toBeGreaterThan(0);
          // Each card must sit fully inside the viewport horizontally.
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
      });
    }
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
