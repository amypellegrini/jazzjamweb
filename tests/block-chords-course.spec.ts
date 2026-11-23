import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";

const BASE = "/courses/block-chords/";

// Part 1 is the block chords article cut into lessons, each ending on its exercise, behind a
// landing page at BASE; Part 2 carries on from it with the minor 7th chord. firstExample pins the
// course-wide example numbering, which the lessons continue (lesson 6's text refers back to
// "Example 16" in lesson 5).
const lessons = [
  {
    path: `${BASE}building-block-chords/`,
    h1: "Building block chords",
    part: 1,
    firstExample: 1,
  },
  {
    path: `${BASE}sixth-diminished-scale/`,
    h1: "Harmonising the sixth-diminished scale",
    part: 1,
    firstExample: 3,
  },
  {
    path: `${BASE}diminished-passing-tones/`,
    h1: "Diminished passing tones",
    part: 1,
    firstExample: 5,
  },
  {
    path: `${BASE}diatonic-passing-tones/`,
    h1: "Diatonic passing tones",
    part: 1,
    firstExample: 9,
  },
  {
    path: `${BASE}chromatic-passing-tones/`,
    h1: "Chromatic passing tones",
    part: 1,
    firstExample: 13,
  },
  {
    path: `${BASE}two-five-one-passing-tones/`,
    h1: "2 5 1 passing tones",
    part: 1,
    firstExample: 17,
  },
  {
    path: `${BASE}minor-seventh-block-chords/`,
    h1: "Building the minor 7th block chords",
    part: 2,
    // Introduces the goal and goes straight to its exercise: no example of its own.
    firstExample: null,
    examples: 0,
  },
  {
    path: `${BASE}minor-seventh-group-of-7/`,
    h1: "The minor 7th group of 7",
    part: 2,
    firstExample: 22,
    examples: 2,
  },
  {
    path: `${BASE}minor-seventh-diminished-passing-tones/`,
    h1: "Diminished passing tones for the minor 7th",
    part: 2,
    firstExample: 24,
    examples: 3,
  },
  {
    path: `${BASE}minor-seventh-diatonic-passing-tones/`,
    h1: "Diatonic passing tones for the minor 7th",
    part: 2,
    firstExample: 27,
    examples: 4,
  },
  {
    path: `${BASE}minor-seventh-chromatic-passing-tones/`,
    h1: "Chromatic passing tones for the minor 7th",
    part: 2,
    firstExample: 31,
    examples: 3,
  },
];
const lastOfPart1 = lessons.findLastIndex((l) => l.part === 1);

// The course's parts, in order. Parts 1 and 2 are the lessons above; the rest are announced as
// coming soon until their lessons are written, and link nowhere until then.
// Lessons planned for parts still to come: listed on the line by title, unlinked, with no
// completion toggle, until they are written.
const planned: Record<string, string[]> = {
  "Part 3": [
    "Building the dominant block chords",
    "The dominant bebop scale",
    "Diminished passing tones for the dominant",
    "Diatonic passing tones for the dominant",
    "Chromatic passing tones for the dominant",
  ],
};
const parts = [
  {
    number: "Part 1",
    title: "Harmonisation techniques",
    lessons: lessons.filter((l) => l.part === 1),
  },
  {
    number: "Part 2",
    title: "Harmonising a minor 7th chord",
    lessons: lessons.filter((l) => l.part === 2),
  },
  { number: "Part 3", title: "Harmonising a dominant 7th chord", lessons: [] },
  { number: "Part 4", title: "Harmonising a 2 5 1 progression", lessons: [] },
  { number: "Part 5", title: "Harmonising a minor 2 5 1 progression", lessons: [] },
  { number: "Part 6", title: "Arranging a jazz standard", lessons: [] },
];

async function expectSyllabus(contents: import("@playwright/test").Locator) {
  const items = contents.locator(".course-part");
  // "Part N" is a small label of its own above the part's title, not run into it.
  await expect(items.locator(".course-part-number")).toHaveText(parts.map((p) => p.number));
  await expect(items.locator(".course-part-title")).toHaveText(parts.map((p) => p.title));
  const [label, title] = await Promise.all(
    [".course-part-number", ".course-part-title"].map((sel) =>
      items.first().locator(sel).evaluate((el) => ({
        size: parseFloat(getComputedStyle(el).fontSize),
        bottom: el.getBoundingClientRect().bottom,
        top: el.getBoundingClientRect().top,
      })),
    ),
  );
  expect(label.size).toBeLessThan(title.size);
  expect(label.bottom).toBeLessThanOrEqual(title.top);
  for (const [i, part] of parts.entries()) {
    const item = items.nth(i);
    if (part.lessons.length) {
      await expect(item.locator("a")).toHaveText(part.lessons.map((l) => l.h1));
      await expect(item.locator(".coming-soon")).toHaveCount(0);
      await expect(item.locator(".planned-lesson")).toHaveCount(0);
      for (const [j, l] of part.lessons.entries())
        await expect(item.locator("a").nth(j)).toHaveAttribute("href", l.path);
    } else {
      await expect(item.locator("a")).toHaveCount(0);
      await expect(item.locator("button")).toHaveCount(0);
      await expect(item.locator(".coming-soon")).toHaveText("Coming soon");
      await expect(item.locator(".planned-lesson")).toHaveText(planned[part.number] ?? []);
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
          `Piano Block Chords · Part ${lesson.part} · Lesson ${n}`,
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

      test("keeps the exercise badge on one line on a phone", async ({ page }) => {
        for (const width of [320, 390]) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto(lesson.path);
          const label = page.locator("article details.exercise .exercise-label");
          await expect(label).toHaveText(`Exercise ${n}`);
          // Against the same badge laid out with all the room it wants: one line tall.
          const { height, oneLine, inside } = await label.evaluate((el) => {
            const free = el.cloneNode(true) as HTMLElement;
            free.style.cssText = "position: absolute; visibility: hidden; white-space: nowrap";
            el.parentElement!.append(free);
            const oneLine = free.getBoundingClientRect().height;
            free.remove();
            const box = el.getBoundingClientRect();
            const summary = el.closest("summary")!.getBoundingClientRect();
            return {
              height: box.height,
              oneLine,
              inside: box.left >= summary.left && box.right <= summary.right,
            };
          });
          expect(height, `at ${width}px`).toBeLessThanOrEqual(oneLine + 1);
          // The long title wraps beside it instead, and nothing spills out of the page.
          expect(inside, `at ${width}px`).toBe(true);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          expect(overflow, `at ${width}px`).toBe(false);
        }
      });

      test("continues the course's example numbering", async ({ page }) => {
        await page.goto(lesson.path);
        if (lesson.firstExample === null)
          await expect(page.locator(".example-title")).toHaveCount(0);
        else
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
          // The last written lesson points ahead to Part 3, announced but not yet linked.
          await expect(next).toHaveCount(0);
          const upcoming = nav.locator(".lesson-nav-upcoming");
          await expect(upcoming.locator(".lesson-nav-step")).toHaveText(
            `${parts[2].number} · Coming soon`,
          );
          await expect(upcoming.locator(".lesson-nav-title")).toHaveText(parts[2].title);
          await expect(upcoming.locator("a")).toHaveCount(0);
        } else {
          await expect(next).toHaveAttribute("href", lessons[i + 1].path);
          await expect(next.locator(".lesson-nav-title")).toHaveText(lessons[i + 1].h1);
          await expect(nav.locator(".lesson-nav-upcoming")).toHaveCount(0);
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
        // A sidebar taller than the window scrolls on its own, never past the window's bottom.
        const details = (await index.locator(":scope > details").boundingBox())!;
        expect(details.y + details.height).toBeLessThanOrEqual(900);
      });

      test("gives the sidebar the room beside the lesson without leaving the window", async ({
        page,
      }) => {
        for (const width of [1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(lesson.path);
          const box = (await page.locator("nav.course-index ol").first().boundingBox())!;
          const article = (await page.locator("article").boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(8);
          expect(box.x + box.width).toBeLessThanOrEqual(article.x);
          // Wide enough that most lesson titles fit on one line.
          expect(box.width).toBeGreaterThanOrEqual(width >= 1440 ? 260 : 220);
        }
      });

      test("folds the lesson index above the lesson on a phone", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto(lesson.path);
        const index = page.locator("nav.course-index");
        await expect(index.locator("ol").first()).toBeHidden();
        await index.locator(":scope > details > summary").click();
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

// Part 2, "Harmonising a minor 7th chord": five lessons that carry straight on from Part 1.
test.describe("Block chords course Part 2", () => {
  const part2 = lessons.filter((l) => l.part === 2);

  test("is five published lessons, reachable from the outline", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    const item = page.locator("nav.course-index .course-part").nth(1);
    await expect(item.locator(".course-part-title")).toHaveText("Harmonising a minor 7th chord");
    await expect(item.locator(".coming-soon")).toHaveCount(0);
    await expect(item.locator(".course-track a")).toHaveText([
      "Building the minor 7th block chords",
      "The minor 7th group of 7",
      "Diminished passing tones for the minor 7th",
      "Diatonic passing tones for the minor 7th",
      "Chromatic passing tones for the minor 7th",
    ]);
    // Each one opens from the outline, on its own page under the course.
    for (const [i, lesson] of part2.entries()) {
      await page.goto(BASE);
      await item.locator("summary").click();
      await item.locator(".course-track a").nth(i).click();
      await expect(page).toHaveURL(new RegExp(`${lesson.path}$`));
      await expect(page.locator("article h1")).toHaveText(lesson.h1);
    }
  });

  // Part 2's first lesson does not teach the block again: it says why the minor 7th comes next
  // (the 2 of a 2 5 1) and goes straight to Dm7 in every position, as lesson 1 does with C6.
  test("opens on the goal of playing a 2 5 1, then the Dm7 positions exercise", async ({ page }) => {
    await page.goto(part2[0].path);
    const article = page.locator("article");
    await expect(article.locator("> p").first()).toContainText("different kinds of chords");
    await expect(article.locator("> p").filter({ hasText: "2 5 1" }).first()).toContainText("Dm7");
    // No build-up example: the melody on top, chord tones and doubling were lesson 1's subject.
    await expect(article.locator("> figure")).toHaveCount(0);
    await expect(article).not.toContainText("three chord tones");
    const exercise = article.locator("details.exercise");
    await expect(exercise.locator("summary")).toContainText(
      "Preparation for block chords scale in Dm7",
    );
    await expect(exercise.locator("audio")).toHaveAttribute(
      "src",
      "/assets/articles/block-chords/m7-positions.mp3",
    );
  });

  // Part 2 practises on the D Dorian group of 7 (D E F G A B C: the root up to the seventh), not
  // on a bebop scale: no added chromatic note, and B natural rather than B flat.
  test("builds on the D Dorian group of 7, not on a bebop scale", async ({ page, request }) => {
    expect((await request.get(`${BASE}minor-seventh-bebop-scale/`)).status()).toBe(404);
    await page.goto(part2[1].path);
    const article = page.locator("article");
    await expect(article).toContainText("Dorian");
    await expect(article).toContainText("group of 7");
    await expect(article).toContainText("D, E, F, G, A, B, C");
    for (const lesson of part2) {
      await page.goto(lesson.path);
      await page.locator("details.exercise").evaluate((d: HTMLDetailsElement) => (d.open = true));
      // Only the note that says why the bebop scale is left behind may name it; and the minor
      // 7th is never folded into the dominant: no G7 or C7 harmonises its passing tones.
      const text = await page
        .locator("article")
        .evaluate((el) => {
          const copy = el.cloneNode(true) as HTMLElement;
          copy.querySelectorAll("aside.note").forEach((n) => n.remove());
          return copy.textContent ?? "";
        });
      expect(text.match(/bebop/gi) ?? [], lesson.path).toEqual([]);
      if (lesson !== part2[0]) expect(text.match(/\b[GC]7/g) ?? [], lesson.path).toEqual([]);
    }
  });

  test("numbers its examples without a gap, straight on from Part 1", async () => {
    let next = 22; // Part 1 ends on Example 21
    for (const lesson of part2) {
      if (lesson.examples) expect(lesson.firstExample, lesson.path).toBe(next);
      next += lesson.examples!;
    }
  });

  for (const lesson of part2) {
    test(`numbers the ${lesson.examples} examples of “${lesson.h1}”, then one exercise`, async ({
      page,
    }) => {
      await page.goto(lesson.path);
      await expect(page.locator("article .example-title")).toHaveCount(lesson.examples!);
      if (lesson.examples)
        await expect(page.locator("article .example-title").last()).toHaveText(
          `Example ${lesson.firstExample! + lesson.examples - 1}`,
        );
      await expect(page.locator("article details.exercise figure")).toHaveCount(1);
    });
  }

  test("follows on from the last Part 1 lesson", async ({ page }) => {
    await page.goto(lessons[lastOfPart1].path);
    const next = page.locator('nav.lesson-nav a[rel="next"]');
    await expect(next).toHaveAttribute("href", part2[0].path);
    await next.click();
    await expect(page.locator("article h1")).toHaveText(part2[0].h1);
    await expect(page.locator(".course-eyebrow")).toContainText("Part 2");
  });

  for (const lesson of part2) {
    test(`plays every example of “${lesson.h1}” from its own score, keys and timings`, async ({
      page,
      request,
    }) => {
      await page.goto(lesson.path);
      const sources = await page
        .locator("article figure audio")
        .evaluateAll((els) => els.map((el) => el.getAttribute("src")!));
      expect(sources.length).toBeGreaterThan(0);
      // The exercise's own example is among them.
      await expect(page.locator("article details.exercise figure audio")).toHaveCount(1);
      for (const src of sources) {
        // Everything the read-along needs to play an example: the audio, the score it lights
        // up, the chord timings and the keyboard chart with the keys of each chord.
        const base = src.replace(/\.mp3$/, "");
        for (const ext of [".mp3", ".svg", ".cursor.json", ".keys.json", ".keyboard.svg"])
          expect((await request.get(base + ext)).status(), base + ext).toBe(200);
        const cursor = await (await request.get(`${base}.cursor.json`)).json();
        const keys = await (await request.get(`${base}.keys.json`)).json();
        expect(cursor.length).toBeGreaterThan(0);
        expect(keys.chords.length).toBe(cursor.length);
        for (const chord of keys.chords) {
          expect(chord.length).toBeGreaterThan(0);
          for (const rect of chord) expect(rect).toBeGreaterThanOrEqual(0);
        }
      }
    });
  }
});

// Course-wide wording: the course always says "melody", never "tune".
test.describe("Block chords course wording", () => {
  for (const path of [BASE, ...lessons.map((l) => l.path)]) {
    test(`never says "tune" on ${path}`, async ({ page }) => {
      await page.goto(path);
      // What a reader sees: the rendered text of the whole page, sidebar included.
      await page.locator("nav.course-index details").evaluateAll((all) =>
        all.forEach((d) => ((d as HTMLDetailsElement).open = true)),
      );
      await page.locator("details.exercise").evaluateAll((all) =>
        all.forEach((d) => ((d as HTMLDetailsElement).open = true)),
      );
      const text = await page.locator("body").innerText();
      expect(text.length).toBeGreaterThan(0);
      expect(text.match(/\btunes?\b/gi) ?? []).toEqual([]);
    });
  }
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

  test("outlines the course in the same sidebar as the lessons, left of the page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE);
    await expect(page.locator(".course-eyebrow")).toHaveText(
      `Course · ${parts.length} parts`,
    );
    // No separate contents section: the sidebar is the outline.
    await expect(page.locator(".course-contents")).toHaveCount(0);
    const index = page.locator("nav.course-index");
    await expectSyllabus(index);
    for (const [i, l] of lessons.entries())
      await expect(index.locator(".course-track a").nth(i)).toHaveAttribute("href", l.path);
    // Nothing is the current lesson on the landing page.
    await expect(index.locator(".is-current")).toHaveCount(0);

    const box = (await index.locator("ol").first().boundingBox())!;
    const main = (await page.locator("main h1").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(main.x);
    expect(box.y).toBeLessThan(main.y + 200);
    // The page grows to fit the sidebar: the footer never runs over it.
    const listBottom = await index
      .locator(":scope > details")
      .evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    const footerTop = await page
      .locator("footer")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(listBottom).toBeLessThanOrEqual(footerTop);
  });

  test("folds the outline above the landing page on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(BASE);
    const index = page.locator("nav.course-index");
    await expect(index.locator("ol").first()).toBeHidden();
    await index.locator(":scope > details > summary").click();
    await expect(index.locator("ol").first()).toBeVisible();
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

// The course index is a metro-style track: one stop per lesson, the current lesson marked on
// the line, and each stop a toggle the learner clicks to mark that lesson completed. Visiting a
// lesson never completes it; only the click does, and it is remembered in this browser.
test.describe("Block chords course progress track", () => {
  const stops = (page: import("@playwright/test").Page) =>
    page.locator("nav.course-index .course-track .track-stop");

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("puts every lesson on the track as a stop, marking where you are", async ({ page }) => {
    await page.goto(lessons[2].path);
    const track = page.locator("nav.course-index .course-track");
    await expect(track.locator("a")).toHaveText(lessons.map((l) => l.h1));
    await expect(stops(page)).toHaveCount(lessons.length);
    // Exactly one station is the current one: this lesson's.
    const current = track.locator("li.is-current");
    await expect(current).toHaveCount(1);
    await expect(current.locator("a")).toHaveAttribute("aria-current", "page");
    await expect(current.locator("a")).toHaveText(lessons[2].h1);
    // The line itself joins the stops: drawn from the first stop to the last.
    const line = await track
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").content);
    expect(line).not.toBe("none");
  });

  test("starts with no lesson completed, and visiting one does not complete it", async ({
    page,
  }) => {
    await page.goto(lessons[0].path);
    await page.goto(lessons[1].path);
    await expect(stops(page)).toHaveCount(lessons.length);
    for (const stop of await stops(page).all())
      await expect(stop).toHaveAttribute("aria-pressed", "false");
  });

  test("toggles a lesson completed by clicking its stop, without leaving the page", async ({
    page,
  }) => {
    await page.goto(lessons[0].path);
    const stop = stops(page).nth(3);
    await expect(stop).toHaveAccessibleName(`Mark “${lessons[3].h1}” as completed`);
    await stop.click();
    await expect(page).toHaveURL(new RegExp(`${lessons[0].path}$`));
    await expect(stop).toHaveAttribute("aria-pressed", "true");
    await expect(stop.locator("xpath=..")).toHaveClass(/is-completed/);

    // Remembered across pages and reloads.
    await page.goto(lessons[lastOfPart1].path);
    await expect(stops(page).nth(3)).toHaveAttribute("aria-pressed", "true");
    await expect(stops(page).nth(0)).toHaveAttribute("aria-pressed", "false");

    // A second click undoes it.
    await stops(page).nth(3).click();
    await expect(stops(page).nth(3)).toHaveAttribute("aria-pressed", "false");
    await page.reload();
    await expect(stops(page).nth(3)).toHaveAttribute("aria-pressed", "false");
  });

  test("shows the same progress on the landing page's contents", async ({ page }) => {
    await page.goto(lessons[0].path);
    await stops(page).nth(0).click();
    await page.goto(BASE);
    const landingStops = page.locator("nav.course-index .track-stop");
    await expect(landingStops).toHaveCount(lessons.length);
    await expect(landingStops.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(landingStops.nth(1)).toHaveAttribute("aria-pressed", "false");
  });

  test("still lists every lesson when the browser blocks storage", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked");
        },
      });
    });
    await page.goto(lessons[0].path);
    await expect(stops(page)).toHaveCount(lessons.length);
    await stops(page).nth(0).click();
    await expect(stops(page).nth(0)).toHaveAttribute("aria-pressed", "true");
  });
});

// The sidebar is a dark panel beside the light page, its parts collapsible: the part holding the
// current lesson (Part 1 on the landing page) opens by default and the rest stay folded, so it
// only scrolls when even that cannot fit the window.
test.describe("Block chords course sidebar", () => {
  const luminance = (rgb: string) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const [name, path, open] of [
    ["a Part 1 lesson", lessons[3].path, 0],
    ["a Part 2 lesson", lessons[lastOfPart1 + 2].path, 1],
    ["the landing page", BASE, 0],
  ] as const) {
    test(`opens only the part you are in on ${name}`, async ({ page }) => {
      await page.goto(path);
      const toggles = page.locator("nav.course-index .course-part > details");
      await expect(toggles).toHaveCount(parts.length);
      for (let i = 0; i < parts.length; i++) {
        if (i === open) await expect(toggles.nth(i)).toHaveAttribute("open", "");
        else await expect(toggles.nth(i)).not.toHaveAttribute("open");
      }
      // Folded that way it fits the window: no scrollbar of its own.
      const scrolls = await page
        .locator("nav.course-index > details")
        .evaluate((el) => el.scrollHeight > el.clientHeight);
      expect(scrolls).toBe(false);
    });
  }

  test("expands and collapses a part from its heading", async ({ page }) => {
    await page.goto(lessons[0].path);
    const part3 = page.locator("nav.course-index .course-part").nth(2);
    await expect(part3.locator(".planned-lesson").first()).toBeHidden();
    // The heading still says it is coming soon while folded.
    await expect(part3.locator("summary .coming-soon")).toBeVisible();
    await part3.locator("summary").click();
    await expect(part3.locator(".planned-lesson").first()).toBeVisible();
    await part3.locator("summary").click();
    await expect(part3.locator(".planned-lesson").first()).toBeHidden();

    // A written part unfolds to its lessons, each a link with its own stop.
    const part2 = page.locator("nav.course-index .course-part").nth(1);
    await expect(part2.locator(".track-stop").first()).toBeHidden();
    await part2.locator("summary").click();
    await expect(part2.locator("a").first()).toBeVisible();
    await expect(part2.locator(".track-stop")).toHaveCount(parts[1].lessons.length);

    const part1 = page.locator("nav.course-index .course-part").nth(0);
    await part1.locator("summary").click();
    await expect(part1.locator(".track-stop").first()).toBeHidden();
  });

  test("sets the sidebar dark against the light page", async ({ page }) => {
    await page.goto(lessons[0].path);
    const sidebar = await page
      .locator("nav.course-index")
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const title = await page
      .locator("nav.course-index .course-part-title")
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    const main = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(luminance(sidebar)).toBeLessThan(60);
    expect(luminance(title)).toBeGreaterThan(200);
    expect(luminance(main)).toBeGreaterThan(240);
  });

  test("lines the sidebar's heading up with its contents", async ({ page }) => {
    await page.goto(lessons[0].path);
    const heading = (await page.locator("nav.course-index > details > summary .course-index-heading").boundingBox())!;
    const label = (await page.locator("nav.course-index .course-part-number").first().boundingBox())!;
    expect(Math.abs(heading.x - label.x)).toBeLessThanOrEqual(1);
  });
});

test.describe("Block chords course header", () => {
  for (const width of [1280, 1440, 1920]) {
    test(`lines the JazzJam logo up with the sidebar at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [BASE, lessons[0].path]) {
        await page.goto(path);
        const logo = (await page.locator(".site-header a").boundingBox())!;
        const heading = (await page.locator(".course-index-heading").boundingBox())!;
        expect(Math.abs(logo.x - heading.x), path).toBeLessThanOrEqual(1);
      }
    });
  }

  for (const width of [375, 1000]) {
    test(`lines the JazzJam logo up with the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [BASE, lessons[0].path]) {
        await page.goto(path);
        const logo = (await page.locator(".site-header a").boundingBox())!;
        const title = (await page.locator("h1").boundingBox())!;
        expect(Math.abs(logo.x - title.x), path).toBeLessThanOrEqual(1);
      }
    });
  }
});
