import { test, expect } from "@playwright/test";

const BASE = "/courses/block-chords/";

// The course is the block chords article cut into lessons, each ending on its exercise.
// firstExample pins the article-wide example numbering, which the lessons continue
// (lesson 6's text refers back to "Example 16" in lesson 5).
const lessons = [
  { path: BASE, h1: "Piano Block Chords", firstExample: 1 },
  {
    path: `${BASE}sixth-diminished-scale/`,
    h1: "Harmonising the sixth-diminished scale",
    firstExample: 3,
  },
  {
    path: `${BASE}diminished-passing-tones/`,
    h1: "Diminished passing tones",
    firstExample: 5,
  },
  {
    path: `${BASE}diatonic-passing-tones/`,
    h1: "Diatonic passing tones",
    firstExample: 9,
  },
  {
    path: `${BASE}chromatic-passing-tones/`,
    h1: "Chromatic passing tones",
    firstExample: 13,
  },
  {
    path: `${BASE}two-five-one-passing-tones/`,
    h1: "2 5 1 passing tones",
    firstExample: 17,
  },
];

test.describe("Block chords course", () => {
  lessons.forEach((lesson, i) => {
    const n = i + 1;

    test.describe(`lesson ${n}`, () => {
      test("serves the lesson with its own heading and canonical URL", async ({
        page,
      }) => {
        const response = await page.goto(lesson.path);
        expect(response?.status()).toBe(200);
        await expect(page.locator("article h1")).toHaveText(lesson.h1);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          `https://jazzjam.app${lesson.path}`,
        );
        await expect(
          page.locator(
            'script[src="https://plausible.io/js/pa-6gVA4g1_BezmrRwhMYs_B.js"]',
          ),
        ).toHaveCount(1);
      });

      test("ends on its exercise", async ({ page }) => {
        await page.goto(lesson.path);
        const article = page.locator("article");
        await expect(article.locator("details.exercise")).toHaveCount(1);
        await expect(article.locator(":scope > :last-child")).toHaveClass(
          /exercise/,
        );
        await expect(article.locator(".exercise-label")).toHaveText(
          `Exercise ${n}`,
        );
      });

      test("continues the course's example numbering", async ({ page }) => {
        await page.goto(lesson.path);
        await expect(page.locator(".example-title").first()).toHaveText(
          `Example ${lesson.firstExample}`,
        );
      });

      test("links to the previous and next lessons from a bottom navigation bar", async ({
        page,
      }) => {
        await page.goto(lesson.path);
        const nav = page.locator("nav.lesson-nav");
        await expect(nav).toHaveCount(1);
        // The bar sits below the lesson, before the site footer.
        const below = await page.evaluate(() => {
          const article = document.querySelector("article")!;
          const nav = document.querySelector("nav.lesson-nav")!;
          return !!(
            article.compareDocumentPosition(nav) &
            Node.DOCUMENT_POSITION_FOLLOWING
          );
        });
        expect(below).toBe(true);

        // The bottom bar only steps between lessons; the full index is the sidebar's job.
        await expect(nav.locator("ol")).toHaveCount(0);

        const prev = nav.locator('a[rel="prev"]');
        const next = nav.locator('a[rel="next"]');
        if (i === 0) await expect(prev).toHaveCount(0);
        else await expect(prev).toHaveAttribute("href", lessons[i - 1].path);
        if (i === lessons.length - 1) await expect(next).toHaveCount(0);
        else await expect(next).toHaveAttribute("href", lessons[i + 1].path);
      });

      test("lists every lesson in a sidebar on the left of the lesson", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(lesson.path);
        const index = page.locator("nav.course-index");
        await expect(index.locator("ol a")).toHaveCount(lessons.length);
        await expect(index.locator('[aria-current="page"]')).toHaveAttribute(
          "href",
          lesson.path,
        );
        await expect(index.locator("ol")).toBeVisible();

        const box = (await index.locator("ol").boundingBox())!;
        const article = (await page.locator("article").boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(article.x);
        expect(box.y).toBeLessThan(article.y + 200);

        // It stays in view while the lesson scrolls.
        await page.locator("details.exercise").scrollIntoViewIfNeeded();
        const scrolled = (await index.locator("ol").boundingBox())!;
        expect(scrolled.y).toBeGreaterThanOrEqual(0);
        expect(scrolled.y).toBeLessThan(900);
      });

      test("folds the lesson index above the lesson on a phone", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(lesson.path);
        const index = page.locator("nav.course-index");
        await expect(index.locator("ol")).toBeHidden();
        await index.locator("summary").click();
        await expect(index.locator("ol")).toBeVisible();
        const box = (await index.boundingBox())!;
        const article = (await page.locator("article").boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(article.y);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
      });

      test("lines every narrated block up with the article's recordings", async ({
        page,
      }) => {
        await page.goto(lesson.path);
        await expect(page.locator("#listen")).toBeVisible();
        // A block whose word count disagrees with its recording is left unwrapped.
        const unwrapped = await page
          .locator("article > :is(h1, h2, h3, p, aside)")
          .evaluateAll(
            (blocks) =>
              blocks.filter((b) => !b.querySelector(".w")).length,
          );
        expect(unwrapped).toBe(0);
      });

      test("plays each example on a keyboard chart beneath its score", async ({
        page,
      }) => {
        await page.goto(lesson.path);
        const figures = page.locator("article figure");
        const count = await figures.count();
        expect(count).toBeGreaterThan(0);
        for (let f = 0; f < count; f++) {
          const fig = figures.nth(f);
          await expect(fig.locator(".keyboard svg rect").first()).toBeAttached();
          // Below the score, above the player.
          const order = await fig.evaluate((el) => {
            const kids = [...el.children];
            const at = (sel: string) =>
              kids.findIndex((k) => k.matches(sel) || !!k.querySelector(sel));
            return [at(".score"), at(".keyboard"), at("audio")];
          });
          expect(order[0]).toBeLessThan(order[1]);
          expect(order[1]).toBeLessThan(order[2]);
        }

        // Playing an example lights the keys of the chord under the cursor, then clears them.
        const fig = figures.first();
        const src = await fig.locator("audio").getAttribute("src");
        const keys = await (
          await page.request.get(src!.replace(/\.mp3$/, ".keys.json"))
        ).json();
        const cursor = await (
          await page.request.get(src!.replace(/\.mp3$/, ".cursor.json"))
        ).json();
        await fig.locator("audio").evaluate((a: HTMLAudioElement) => {
          a.muted = true;
          return a.play();
        });
        const lit = async () =>
          fig.evaluate((el) => {
            const a = el.querySelector("audio") as HTMLAudioElement;
            const rects = [...el.querySelectorAll(".keyboard rect")];
            return {
              t: a.currentTime,
              lit: rects
                .map((r, i) => (r.classList.contains("sounding") ? i : -1))
                .filter((i) => i >= 0),
            };
          });
        await expect.poll(async () => (await lit()).lit.length).toBeGreaterThan(0);
        const { t, lit: on } = await lit();
        const chord = cursor.findIndex(
          (e: { t: number; end: number }) => t >= e.t && t < e.end,
        );
        const near = [chord - 1, chord, chord + 1]
          .filter((i) => i >= 0 && i < keys.chords.length)
          .map((i) => [...keys.chords[i]].sort((a: number, b: number) => a - b));
        expect(near).toContainEqual(on);
        // Only the noteheads light up on the score: no box is drawn over the playing chord.
        await expect(fig.locator(".score path.Note.sounding").first()).toBeAttached();
        await expect(fig.locator(".score .cursor")).toHaveCount(0);
        // Lit keys take the keyboard chart generator's own highlight colour (#a0c6e8).
        const fills = await fig.evaluate((el) =>
          [...el.querySelectorAll(".keyboard rect.sounding")].map(
            (r) => getComputedStyle(r).fill,
          ),
        );
        expect(fills.length).toBeGreaterThan(0);
        for (const fill of fills) expect(fill).toBe("rgb(160, 198, 232)");
        await fig.locator("audio").evaluate((a: HTMLAudioElement) => a.pause());
        await expect.poll(async () => (await lit()).lit.length).toBe(0);
      });

      test("loads every example asset", async ({ page, request }) => {
        await page.goto(lesson.path);
        const sources = await page
          .locator("img[src], audio[src]")
          .evaluateAll((els) => els.map((el) => el.getAttribute("src")!));
        expect(sources.length).toBeGreaterThan(0);
        for (const src of sources) {
          const res = await request.get(src);
          expect(res.status(), src).toBe(200);
        }
      });
    });
  });
});
