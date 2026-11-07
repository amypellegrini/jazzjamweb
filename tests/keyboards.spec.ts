import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  parseSlots,
  layoutFor,
  rectIndex,
  keyName,
} from "../scripts/keyboards/keyboard.js";

const ASSETS = "src/assets/articles/block-chords";
const CLI = "node_modules/.bin/piano-chord-charts";

const note = (step: string, octave: number, extra = "") =>
  `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><staff>1</staff></note>`;

test.describe("keyboard charts for the sheet music examples", () => {
  test("reads one slot per chord, both hands together", () => {
    const xml =
      "<measure>" +
      note("C", 5) +
      note("G", 4, "<chord/>") +
      `<note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>1</duration><staff>1</staff></note>` +
      "<backup><duration>2</duration></backup>" +
      note("C", 4).replace("<staff>1", "<staff>2") +
      `<note><rest/><duration>1</duration><staff>2</staff></note>` +
      "</measure>";
    expect(parseSlots(xml)).toEqual([
      [60, 67, 72],
      [70],
    ]);
  });

  test("spans the notes with one white key to spare on each side", () => {
    expect(layoutFor([60, 64, 67, 69])).toEqual({
      startMidi: 59,
      startFrom: "B",
      size: 8,
    });
    // A black top note keeps the white key above it, so it is never clipped.
    expect(layoutFor([60, 68])).toMatchObject({ startMidi: 59, size: 8 }); // B3..B4
  });

  test("finds each key's rect: white keys first, then black keys, edge key included", () => {
    const layout = layoutFor([60, 64, 67, 69]); // B3..B4
    expect(rectIndex(64, layout)).toBe(3); // E4
    expect(rectIndex(69, layout)).toBe(6); // A4
    // The partial A#3 left of the first key is the first black key (index 8).
    expect(rectIndex(61, layout)).toBe(9); // C#4
    expect(rectIndex(68, layout)).toBe(12); // G#4
    // A keyboard starting on C has no black key to the left of its first key.
    expect(rectIndex(61, { startMidi: 60, startFrom: "C", size: 8 })).toBe(8);
  });

  // The CLI's own highlighting is an independent oracle: for every chord of every example,
  // the keys it highlights by name must be exactly the keys the page lights. Keys are compared
  // by where each keyboard draws them, shifted back onto the full keyboard (a partial black key
  // left of the first white key is drawn at a negative x).
  const WHITES = ["C", "D", "E", "F", "G", "A", "B"];
  const drawn = (svg: string) =>
    [...svg.matchAll(/<rect style="fill:([^;]+);[^"]*" x="(-?[\d.]+)" y="0" width="\d+" height="(\d+)"/g)]
      .map(([, fill, x, h]) => ({ fill, x: Number(x), black: h === "40" }));
  const keyAt = (k: { x: number; black: boolean }) =>
    `${Math.floor(k.x / 23)}${k.black ? "#" : ""}`;

  test("lights the same keys the CLI highlights, for every chord", () => {
    const tmp = mkdtempSync(path.join(tmpdir(), "keyboards-"));
    const examples = readdirSync(ASSETS)
      .filter((f) => f.endsWith(".musicxml"))
      .map((f) => f.replace(/\.musicxml$/, ""));
    expect(examples.length).toBeGreaterThan(20);

    for (const k of examples) {
      const keys = JSON.parse(readFileSync(`${ASSETS}/${k}.keys.json`, "utf8"));
      const cursor = JSON.parse(
        readFileSync(`${ASSETS}/${k}.cursor.json`, "utf8"),
      );
      const svg = readFileSync(`${ASSETS}/${k}.keyboard.svg`, "utf8");
      const slots = parseSlots(readFileSync(`${ASSETS}/${k}.musicxml`, "utf8"));
      expect(keys.chords.length, k).toBe(cursor.length);
      const { startMidi, size } = keys.layout;
      expect(svg, k).toContain(`viewBox="0 0 ${size * 23} 65"`);
      const ours = drawn(svg);

      keys.chords.forEach((lit: number[], i: number) => {
        const notes = [...new Set(slots[i] as number[])].sort((a, b) => a - b);
        if (!notes.length) return expect(lit, `${k} chord ${i + 1}`).toEqual([]);
        // One note at a time, each on a keyboard starting at that note, so the CLI's name
        // matching can only pick the intended key even across gaps wider than an octave.
        const expected = notes
          .flatMap((note) => {
            const low = keyName(note).includes("#") ? note - 1 : note;
            let shift = 0; // white keys between the full keyboard's start and this note
            for (let m = startMidi; m < low; m++) if (!keyName(m).includes("#")) shift++;
            execFileSync(CLI, [
              "--format", "compact",
              "--size", String(size - shift),
              "--startFrom", WHITES.find((w) => w === keyName(low))!,
              "--highlightKeys", keyName(note),
              "--outDir", tmp,
              "--fileName", "oracle.svg",
            ]);
            return drawn(readFileSync(path.join(tmp, "oracle.svg"), "utf8"))
              .filter((r) => r.fill === "#a0c6e8")
              .map((r) => keyAt({ ...r, x: r.x + shift * 23 }));
          })
          .sort();
        expect(expected.length, `${k} chord ${i + 1}`).toBe(notes.length);
        const actual = lit.map((j) => keyAt(ours[j])).sort();
        expect(actual, `${k} chord ${i + 1}`).toEqual(expected);
      });
    }
  });
});
