import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

const BASE = "/courses/block-chords/";

// The course is the block chords article cut into lessons, each ending on its exercise, behind
// a landing page at BASE. firstExample pins the article-wide example numbering, which the
// lessons continue (lesson 6's text refers back to "Example 16" in lesson 5).
const lessons = [
  {
    path: `${BASE}building-block-chords/`,
    h1: "Building block chords",
    firstExample: 1,
  },
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

// The course's parts, in order. Part 1 is the six lessons above; the rest are announced as
// coming soon until their lessons are written, and link nowhere until then.
const parts = [
  { title: "Part 1 · Harmonisation techniques", lessons },
  { title: "Part 2 · Harmonising a major 2 5 1", lessons: [] },
  { title: "Part 3 · Harmonising a minor 2 5 1", lessons: [] },
  { title: "Part 4 · Arranging a jazz standard", lessons: [] },
];

async function expectSyllabus(contents: import("@playwright/test").Locator) {
  const items = contents.locator(".course-part");
  await expect(items.locator(".course-part-title")).toHaveText(parts.map((p) => p.title));
  for (const [i, part] of parts.entries()) {
    const item = items.nth(i);
    if (part.lessons.length) {
      await expect(item.locator("a")).toHaveText(part.lessons.map((l) => l.h1));
      await expect(item.locator(".coming-soon")).toHaveCount(0);
    } else {
      await expect(item.locator("a")).toHaveCount(0);
      await expect(item.locator(".coming-soon")).toHaveText("Coming soon");
    }
  }
}

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

      test("names its part and lesson number above the lesson", async ({ page }) => {
        await page.goto(lesson.path);
        await expect(page.locator(".course-eyebrow")).toHaveText(
          `Piano Block Chords · Part 1 · Lesson ${n}`,
        );
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
        else {
          await expect(prev).toHaveAttribute("href", lessons[i - 1].path);
          // Named exactly as the lesson it leads to is titled.
          await expect(prev.locator(".lesson-nav-title")).toHaveText(lessons[i - 1].h1);
        }
        if (i === lessons.length - 1) {
          // Part 1's last lesson points ahead to Part 2, announced but not yet linked.
          await expect(next).toHaveCount(0);
          const upcoming = nav.locator(".lesson-nav-upcoming");
          await expect(upcoming.locator(".lesson-nav-step")).toHaveText("Coming soon");
          await expect(upcoming.locator(".lesson-nav-title")).toHaveText(parts[1].title);
          await expect(upcoming.locator("a")).toHaveCount(0);
        } else {
          await expect(next).toHaveAttribute("href", lessons[i + 1].path);
          await expect(next.locator(".lesson-nav-title")).toHaveText(lessons[i + 1].h1);
        }
      });

      test("lists every lesson in a sidebar on the left of the lesson", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(lesson.path);
        const index = page.locator("nav.course-index");
        // Each entry reads word for word as its lesson's title.
        await expect(index.locator("ol a")).toHaveText(lessons.map((l) => l.h1));
        await expect(index.locator('[aria-current="page"]')).toHaveAttribute(
          "href",
          lesson.path,
        );
        await expect(index.locator("ol").first()).toBeVisible();
        // Lessons sit under their part, with the parts still to come announced after them.
        await expectSyllabus(index);

        const box = (await index.locator("ol").first().boundingBox())!;
        const article = (await page.locator("article").boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(article.x);
        expect(box.y).toBeLessThan(article.y + 200);

        // It stays in view while the lesson scrolls.
        await page.locator("details.exercise").scrollIntoViewIfNeeded();
        const scrolled = (await index.locator("ol").first().boundingBox())!;
        expect(scrolled.y).toBeGreaterThanOrEqual(0);
        expect(scrolled.y).toBeLessThan(900);
      });

      test("folds the lesson index above the lesson on a phone", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(lesson.path);
        const index = page.locator("nav.course-index");
        await expect(index.locator("ol").first()).toBeHidden();
        await index.locator("summary").click();
        await expect(index.locator("ol").first()).toBeVisible();
        const box = (await index.boundingBox())!;
        const article = (await page.locator("article").boundingBox())!;
        expect(box.y + box.height).toBeLessThanOrEqual(article.y);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
      });

      test("reads along only where the recording matches the text", async ({
        page,
        request,
      }) => {
        await page.goto(lesson.path);
        await expect(page.locator("#listen")).toBeVisible();
        const slug = lesson.path.slice(BASE.length, -1);
        const manifest: { hash: string }[] = await (
          await request.get(`/assets/courses/block-chords/narration/${slug}/narration.json`)
        ).json();
        // Each block's text as scripts/narration/narrate.py hashes it (a note's example aside).
        const blocks = await page
          .locator("article > :is(h1, h2, h3, p, aside)")
          .evaluateAll((els) =>
            els.map((el) => {
              const copy = el.cloneNode(true) as HTMLElement;
              copy.querySelectorAll("figure").forEach((f) => f.remove());
              return {
                text: copy.textContent!.trim().split(/\s+/).join(" "),
                wrapped: !!el.querySelector(".w"),
              };
            }),
          );
        expect(manifest.length).toBe(blocks.length);
        blocks.forEach(({ text, wrapped }, b) => {
          const recorded =
            createHash("sha1").update(text).digest("hex").slice(0, 12) === manifest[b].hash;
          // A block narrates (and highlights word by word) only with its own recording.
          expect(wrapped, `block ${b + 1}: ${text.slice(0, 40)}`).toBe(recorded);
        });
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

      test("ends with the footer below the lesson", async ({ page }) => {
        await page.goto(lesson.path);
        const gap = await page.evaluate(() => {
          const nav = document.querySelector("nav.lesson-nav")!.getBoundingClientRect();
          const footer = document.querySelector("footer")!.getBoundingClientRect();
          return footer.top - nav.bottom;
        });
        expect(gap).toBeGreaterThanOrEqual(32);
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

test.describe("Block chords course lesson 1", () => {
  const path = `${BASE}building-block-chords/`;

  test("opens on the introduction, without the course's goal callout", async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.locator("article .lede")).toHaveCount(0);
    await expect(page.locator("article > p").first()).toHaveText(
      /^Block chords, also called locked hands/,
    );
  });

  test("shows the three pianists the introduction names, in its order", async ({
    page,
  }) => {
    await page.goto(path);
    const row = page.locator("article > .pianists");
    // Right after the paragraph that names them.
    const after = await row.evaluate(
      (el) => el.previousElementSibling?.textContent?.includes("Oscar Peterson") ?? false,
    );
    expect(after).toBe(true);
    await expect(row.locator(".person-name")).toHaveText([
      "George Shearing",
      "Red Garland",
      "Oscar Peterson",
    ]);
    const images = row.locator("img");
    await expect(images).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(images.nth(i)).toHaveAttribute("alt", /.+/);
      expect(await images.nth(i).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    }
    // The CC BY-SA photo of Red Garland carries its credit and licence, linked to the source.
    const credit = row.locator(".person").nth(1).locator(".person-credit");
    await expect(credit).toContainText("Brian McMillen");
    await expect(credit).toContainText("CC BY-SA 3.0");
    await expect(credit.locator("a").first()).toHaveAttribute(
      "href",
      "https://commons.wikimedia.org/wiki/File:Red_Garland_9A.jpg",
    );
  });

  test("keeps the three photos side by side on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    const boxes = await page
      .locator("article > .pianists img")
      .evaluateAll((imgs) => imgs.map((i) => i.getBoundingClientRect().top));
    expect(new Set(boxes.map((t) => Math.round(t))).size).toBe(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("Block chords course landing page", () => {
  test("introduces the course and starts it at the first lesson", async ({
    page,
  }) => {
    const response = await page.goto(BASE);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveText("Piano Block Chords");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://jazzjam.app${BASE}`,
    );
    await expect(
      page.locator(
        'script[src="https://plausible.io/js/pa-6gVA4g1_BezmrRwhMYs_B.js"]',
      ),
    ).toHaveCount(1);
    // The summary: the course's goal as a callout, then the introduction to block chords.
    const summary = page.locator("main .course-summary");
    await expect(summary.locator("p")).toHaveText([
      "In this course we’ll learn different harmonisation techniques for playing block chords at the piano.",
      "Block chords, also called locked hands, harmonise a melody so that every note gets its own chord, moving in parallel with the melody. The sound is closely associated with George Shearing, Red Garland and Oscar Peterson, and it's one of the quickest ways to make a melody sound like a full horn section at the piano.",
    ]);
    await expect(summary.locator("p").first()).toHaveClass(/lede/);
    // The call to action leads to lesson 1.
    const start = page.getByRole("link", { name: "Start the course" });
    await expect(start).toBeVisible();
    await expect(start).toHaveAttribute("href", lessons[0].path);
    await start.click();
    await expect(page.locator("article h1")).toHaveText(lessons[0].h1);
  });

  test("outlines the course part by part, with what is still to come", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator(".course-eyebrow")).toHaveText(
      `Course · ${parts.length} parts`,
    );
    const contents = page.locator("main .course-contents");
    await expect(contents.locator("h2")).toHaveText("Course contents");
    await expectSyllabus(contents);
    for (const [i, l] of lessons.entries())
      await expect(contents.locator(".course-part").first().locator("a").nth(i)).toHaveAttribute(
        "href",
        l.path,
      );
  });

  test("links only to pages that exist", async ({ page, request }) => {
    for (const path of [BASE, ...lessons.map((l) => l.path)]) {
      await page.goto(path);
      const hrefs = await page.$$eval("a[href^='/']", (as) =>
        as.map((a) => a.getAttribute("href")!),
      );
      for (const href of new Set(hrefs)) {
        const res = await request.get(href);
        expect(res.status(), `${href} linked from ${path}`).toBe(200);
      }
    }
  });

  test("keeps the footer at the bottom of a window taller than the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 2000 });
    await page.goto(BASE);
    const { bottom, viewport, scrollable } = await page.evaluate(() => ({
      bottom: document.querySelector("footer")!.getBoundingClientRect().bottom,
      viewport: window.innerHeight,
      scrollable: document.documentElement.scrollHeight > window.innerHeight,
    }));
    expect(Math.abs(bottom - viewport)).toBeLessThanOrEqual(1);
    expect(scrollable).toBe(false);
  });

  test("fits a phone without sideways scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    await expect(page.getByRole("link", { name: "Start the course" })).toBeInViewport();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});
