#!/usr/bin/env node
// Keyboard charts for an article's notated examples: a compact piano-chord-charts keyboard
// per example, plus the keys each chord plays, so the page can light them in time with the
// audio (the chord timings are the example's <k>.cursor.json, one entry per chord).
//
//   node scripts/keyboards/keyboard.js block-chords
//
// Reads  src/assets/articles/<slug>/<k>.musicxml + <k>.cursor.json   (from scripts/sheet-music)
// Writes src/assets/articles/<slug>/<k>.keyboard.svg                  (piano-chord-charts CLI)
//        src/assets/articles/<slug>/<k>.keys.json  {layout, chords: [[rect index, ...], ...]}
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// White keys that carry a black key to their right, in the CLI's rendering.
const WITH_BLACK = new Set(["C", "D", "F", "G", "A"]);

const keyName = (midi) => NAMES[midi % 12];
const isWhite = (midi) => !keyName(midi).includes("#");

/** One slot per chord, in score order: the MIDI notes both hands play in it. The generator
 * gives both hands the same rhythm, so the n-th chord (or rest) of each staff shares a slot. */
function parseSlots(xml) {
  const staves = {};
  for (const [, body] of xml.matchAll(/<note\b[^>]*>([\s\S]*?)<\/note>/g)) {
    const staff = (body.match(/<staff>(\d+)<\/staff>/) || [, "1"])[1];
    const groups = (staves[staff] ||= []);
    const pitch = body.match(
      /<step>([A-G])<\/step>(?:<alter>(-?\d+)<\/alter>)?<octave>(\d)<\/octave>/,
    );
    const midi = pitch
      ? (Number(pitch[3]) + 1) * 12 + STEP[pitch[1]] + Number(pitch[2] || 0)
      : null;
    if (body.includes("<chord/>")) groups[groups.length - 1].push(midi);
    else groups.push(midi === null ? [] : [midi]);
  }
  const lists = Object.keys(staves)
    .sort()
    .map((s) => staves[s]);
  const n = Math.max(...lists.map((l) => l.length));
  return Array.from({ length: n }, (_, i) =>
    lists.flatMap((l) => l[i] || []).sort((a, b) => a - b),
  );
}

/** The smallest keyboard holding every note, with a white key to spare on each side. */
function layoutFor(midis) {
  let low = Math.min(...midis);
  let high = Math.max(...midis);
  low = isWhite(low) ? low : low - 1; // a black key is drawn with the white key to its left
  high = isWhite(high) ? high : high + 1; // and overhangs it, so keep the white key above too
  do low--; while (!isWhite(low));
  do high++; while (!isWhite(high));
  let size = 0;
  for (let m = low; m <= high; m++) if (isWhite(m)) size++;
  return { startMidi: low, startFrom: keyName(low), size };
}

/** The key's <rect> in the CLI's output: every white key left to right, then the black keys,
 * starting with the partial one left of the first white key when there is one. */
function rectIndex(midi, layout) {
  const whites = [];
  for (let m = layout.startMidi; whites.length < layout.size; m++)
    if (isWhite(m)) whites.push(m);
  if (isWhite(midi)) return whites.indexOf(midi);
  const edge = isWhite(layout.startMidi - 1) ? [] : [layout.startMidi - 1];
  const blacks = [
    ...edge,
    ...whites.filter((w) => WITH_BLACK.has(keyName(w))).map((w) => w + 1),
  ];
  const i = blacks.indexOf(midi);
  return i < 0 ? -1 : whites.length + i;
}

function render(slug) {
  const dir = path.join(__dirname, "..", "..", "src", "assets", "articles", slug);
  const cli = path.join(__dirname, "..", "..", "node_modules", ".bin", "piano-chord-charts");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".musicxml"))) {
    const k = file.replace(/\.musicxml$/, "");
    const slots = parseSlots(fs.readFileSync(path.join(dir, file), "utf8"));
    const cursor = JSON.parse(fs.readFileSync(path.join(dir, `${k}.cursor.json`), "utf8"));
    if (slots.length !== cursor.length)
      throw new Error(`${k}: ${slots.length} chords in the score, ${cursor.length} in the cursor`);
    const layout = layoutFor(slots.flat());
    execFileSync(cli, [
      "--format", "compact",
      "--size", String(layout.size),
      "--startFrom", layout.startFrom,
      "--outDir", dir,
      "--fileName", `${k}.keyboard.svg`,
    ]);
    const chords = slots.map((notes) => [...new Set(notes.map((m) => rectIndex(m, layout)))]);
    fs.writeFileSync(path.join(dir, `${k}.keys.json`), JSON.stringify({ layout, chords }));
    console.log("keyboard", k);
  }
}

if (require.main === module) render(process.argv[2] || "block-chords");

module.exports = { parseSlots, layoutFor, rectIndex, keyName, render };
