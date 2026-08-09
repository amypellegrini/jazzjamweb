import { test, expect, Locator } from "@playwright/test";
import shared from "../src/_data/shared.json";

// The Pro Unlock benefit-to-group rule, restated independently of the build:
// a benefit id names its group ("export-midi" belongs to "export") and the
// group flagged catchAll takes whatever no namespace claims. Asserting the
// rule rather than a literal card list is what keeps a benefit added in the
// workbench from needing an edit here.
const expectedGroupId = (benefitId: string): string => {
  const namespaced = shared.paywall.groups.find((group) =>
    benefitId.startsWith(`${group.id}-`)
  );
  return (namespaced ?? shared.paywall.groups.find((g) => g.catchAll))!.id;
};

type Row = { y: number; count: number };

// Cards sharing a top edge (within a rounding tolerance) form one row.
async function cardRows(cards: Locator): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 0; i < (await cards.count()); i++) {
    const box = await cards.nth(i).boundingBox();
    expect(box).not.toBeNull();
    const row = rows.find((r) => Math.abs(r.y - box!.y) < 4);
    if (row) {
      row.count += 1;
    } else {
      rows.push({ y: box!.y, count: 1 });
    }
  }
  return rows;
}

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

  test("displays Pro Unlock section listing every benefit from the app paywall", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");
    await expect(proUnlock).toBeVisible();
    await expect(
      proUnlock.getByRole("heading", { name: shared.paywall.title, exact: true })
    ).toBeVisible();
    // The site leads with the title alone; the canonical paywall.subtitle is
    // an app-hero string and deliberately not rendered here.
    await expect(
      proUnlock.getByText(shared.paywall.subtitle, { exact: true })
    ).toHaveCount(0);
    for (const benefit of shared.paywall.benefits) {
      await expect(
        proUnlock.getByRole("heading", { name: benefit.name, exact: true })
      ).toBeVisible();
      await expect(
        proUnlock.getByText(benefit.description, { exact: true })
      ).toBeVisible();
    }
  });

  test("renders each Pro benefit under the group its id namespace declares", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");
    expect(shared.paywall.groups.length).toBeGreaterThan(1);
    await expect(proUnlock.locator(".pro-unlock-group")).toHaveCount(
      shared.paywall.groups.length
    );

    for (const group of shared.paywall.groups) {
      const groupEl = proUnlock.locator(
        `.pro-unlock-group[data-group="${group.id}"]`
      );
      await expect(groupEl).toHaveCount(1);

      // The subtitle belongs to the group, not to the section: it must sit
      // inside the block holding exactly the cards it describes.
      await expect(
        groupEl.getByRole("heading", { name: group.subtitle, exact: true })
      ).toBeVisible();

      const expected = shared.paywall.benefits
        .filter((benefit) => expectedGroupId(benefit.id) === group.id)
        .map((benefit) => benefit.name);
      expect(expected.length).toBeGreaterThan(0);

      const rendered = await groupEl
        .locator(".pro-unlock-feature .pro-unlock-glyph")
        .allInnerTexts();
      expect(rendered.map((text) => text.trim())).toEqual(expected);
    }

    // Nothing dropped and nothing rendered twice.
    await expect(proUnlock.locator(".pro-unlock-feature")).toHaveCount(
      shared.paywall.benefits.length
    );
  });

  test("Pro Unlock groups render as full-width bands of plain text, not cards", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");
    const sectionBox = await proUnlock.boundingBox();

    // Each group is a dedicated band spanning the section edge to edge.
    const groups = proUnlock.locator(".pro-unlock-group");
    const groupCount = await groups.count();
    expect(groupCount).toBe(shared.paywall.groups.length);
    for (let g = 0; g < groupCount; g++) {
      const box = await groups.nth(g).boundingBox();
      expect(Math.abs(box!.width - sectionBox!.width), "band width").toBeLessThan(2);
    }

    // Benefits are plain text blocks — no card box around them.
    const features = proUnlock.locator(".pro-unlock-feature");
    for (let i = 0; i < (await features.count()); i++) {
      const style = await features.nth(i).evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, borderTop: s.borderTopWidth };
      });
      expect(style.background, "feature background").toBe("rgba(0, 0, 0, 0)");
      expect(style.borderTop, "feature border").toBe("0px");
    }

    // Benefit names read as plain dark text: no highlight behind them, and
    // the same ink as the section title rather than an accent colour.
    const titleColor = await proUnlock
      .getByRole("heading", { level: 2 })
      .evaluate((el) => getComputedStyle(el).color);
    const glyphs = proUnlock.locator(".pro-unlock-glyph");
    for (let i = 0; i < (await glyphs.count()); i++) {
      const style = await glyphs.nth(i).evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, color: s.color };
      });
      expect(style.background, "benefit name highlight").toBe("rgba(0, 0, 0, 0)");
      expect(style.color, "benefit name ink").toBe(titleColor);
    }
  });

  test("group bands share one treatment and hold content to a readable measure", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const proUnlock = page.locator(".pro-unlock");
    const groups = proUnlock.locator(".pro-unlock-group");
    const groupCount = await groups.count();
    expect(groupCount).toBe(shared.paywall.groups.length);

    // Every band gets the identical background — sibling groups, not one
    // highlighted box and one unstructured area. Alternation reads as
    // asymmetry with only two groups.
    const backgrounds: string[] = [];
    for (let g = 0; g < groupCount; g++) {
      backgrounds.push(
        await groups
          .nth(g)
          .evaluate((el) => getComputedStyle(el).backgroundColor)
      );
    }
    expect(new Set(backgrounds).size, "one band treatment").toBe(1);
    expect(backgrounds[0], "bands are visibly delimited").not.toBe(
      "rgba(0, 0, 0, 0)"
    );

    // The band spans the page, but its content is held to a narrower,
    // centred measure so the items still read as one group at desktop.
    for (let g = 0; g < groupCount; g++) {
      const bandBox = await groups.nth(g).boundingBox();
      const contentBox = await groups
        .nth(g)
        .locator(".container")
        .boundingBox();
      expect(
        contentBox!.width / bandBox!.width,
        "content measure inside its band"
      ).toBeLessThan(0.8);
      const leftGutter = contentBox!.x - bandBox!.x;
      const rightGutter =
        bandBox!.x + bandBox!.width - (contentBox!.x + contentBox!.width);
      expect(Math.abs(leftGutter - rightGutter), "content centred").toBeLessThan(2);
    }
  });

  test("group headings stand out from the benefit names beneath them", async ({ page }) => {
    const proUnlock = page.locator(".pro-unlock");

    // The accent colour comes from the palette, not a literal, so a palette
    // change stays a one-line CSS edit.
    const accent = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--light-blue-dark)";
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    const benefitInk = await proUnlock
      .locator(".pro-unlock-glyph")
      .first()
      .evaluate((el) => getComputedStyle(el).color);

    const headings = proUnlock.locator(".pro-unlock-group-subtitle");
    for (let g = 0; g < (await headings.count()); g++) {
      const style = await headings.nth(g).evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          weight: Number(s.fontWeight),
          color: s.color,
          size: parseFloat(s.fontSize),
        };
      });
      expect(style.weight, "group heading weight").toBeGreaterThanOrEqual(700);
      expect(style.color, "group heading accent").toBe(accent);
      expect(style.color, "distinct from benefit ink").not.toBe(benefitInk);

      // The h3 must visibly outrank the h4 benefit names it introduces.
      const benefitSize = await proUnlock
        .locator(".pro-unlock-glyph")
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(style.size, "group heading size").toBeGreaterThan(benefitSize);
    }
  });

  test("a group's lone benefit spans its band instead of floating as a narrow card", async ({ page }) => {
    const soloGroups = shared.paywall.groups.filter(
      (group) =>
        shared.paywall.benefits.filter(
          (benefit) => expectedGroupId(benefit.id) === group.id
        ).length === 1
    );
    expect(soloGroups.length).toBeGreaterThan(0);

    for (const group of soloGroups) {
      const groupEl = page.locator(
        `.pro-unlock-group[data-group="${group.id}"]`
      );
      const gridBox = await groupEl.locator(".pro-unlock-grid").boundingBox();
      const featureBox = await groupEl
        .locator(".pro-unlock-feature")
        .boundingBox();
      expect(
        featureBox!.width / gridBox!.width,
        "lone benefit's share of its band"
      ).toBeGreaterThan(0.9);
    }
  });

  test("Pro Unlock heading levels step down without skipping one", async ({ page }) => {
    const levels = await page
      .locator(".pro-unlock :is(h1, h2, h3, h4, h5, h6)")
      .evaluateAll((headings) =>
        headings.map((heading) => Number(heading.tagName.slice(1)))
      );

    expect(levels[0], "section title").toBe(2);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i] - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1);
    }
    // Section title, group headings and benefit names occupy three levels.
    expect([...new Set(levels)].sort()).toEqual([2, 3, 4]);
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
          // Per group now that the section is grouped — a single .pro-unlock-grid
          // locator would trip strict mode. A group with two or more cards must
          // still put two or more of them on its first row at tablet widths.
          const grids = page.locator(".pro-unlock-group .pro-unlock-grid");
          const gridCount = await grids.count();
          expect(gridCount).toBe(shared.paywall.groups.length);

          let seen = 0;
          for (let g = 0; g < gridCount; g++) {
            const cards = grids.nth(g).locator(".pro-unlock-feature");
            const cardCount = await cards.count();
            expect(cardCount).toBeGreaterThan(0);
            seen += cardCount;

            const rows = await cardRows(cards);
            expect(
              rows[0].count,
              "pro unlock cards on the first row of a group"
            ).toBeGreaterThanOrEqual(Math.min(cardCount, 2));

            for (let i = 0; i < cardCount; i++) {
              const box = await cards.nth(i).boundingBox();
              expect(box).not.toBeNull();
              expect(box!.x).toBeGreaterThanOrEqual(0);
              expect(box!.x + box!.width).toBeLessThanOrEqual(width);
            }
          }
          expect(seen).toBe(shared.paywall.benefits.length);
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

        // Key sub-elements stay visible (not clipped or collapsed) at every
        // width. Each group owns a grid, so these are counted rather than
        // located as singletons — a bare .pro-unlock-grid would trip strict mode.
        const grids = proUnlock.locator(".pro-unlock-grid");
        await expect(grids).toHaveCount(shared.paywall.groups.length);
        for (let g = 0; g < shared.paywall.groups.length; g++) {
          await expect(grids.nth(g)).toBeVisible();
          await expect(
            proUnlock.locator(".pro-unlock-group-subtitle").nth(g)
          ).toBeVisible();
        }
        await expect(proUnlock.locator(".pro-unlock-actions")).toBeVisible();
        await expect(proUnlock.locator(".pro-unlock-cta")).toBeVisible();

        // Each feature card must render at a sane, non-zero size (no clipping to 0).
        // Derived from the generated shared data rather than hardcoded, so
        // adding a Pro benefit in the workbench does not need this edited.
        const featureCards = proUnlock.locator(".pro-unlock-feature");
        const count = await featureCards.count();
        expect(count).toBe(shared.paywall.benefits.length);
        for (let i = 0; i < count; i++) {
          const box = await featureCards.nth(i).boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThan(0);
          expect(box!.height).toBeGreaterThan(0);
          // Each card must sit fully inside the viewport horizontally.
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }

        // No group may fill a row and then strand a lone card on the next one —
        // the 4 + 1 arrangement the grouping replaced. The row budget is read
        // from the stylesheet so the CSS stays its single source of truth.
        const groups = proUnlock.locator(".pro-unlock-group");
        for (let g = 0; g < (await groups.count()); g++) {
          const grid = groups.nth(g).locator(".pro-unlock-grid");
          const maxColumns = await grid.evaluate((el) =>
            Number(
              getComputedStyle(el).getPropertyValue("--pro-unlock-max-columns")
            )
          );
          expect(maxColumns, "row budget").toBeGreaterThan(0);

          const cards = groups.nth(g).locator(".pro-unlock-feature");
          const cardCount = await cards.count();
          const rows = await cardRows(cards);
          expect(rows[0].count, "cards on a group's first row").toBe(
            Math.min(cardCount, maxColumns)
          );

          // Once a row holds more than one card, no row of that group may hold
          // just one. A single-column viewport, where every row holds one card
          // by design, is not an orphan.
          const counts = rows.map((row) => row.count);
          if (Math.max(...counts) > 1) {
            expect(
              Math.min(...counts),
              "cards on a group's sparsest row"
            ).toBeGreaterThan(1);
          }
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
