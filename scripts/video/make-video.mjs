#!/usr/bin/env node
// Render the block chords video from the storyboard (scripts/video/storyboard.py).
//
// Every narrated sentence is cut out of its paragraph's narration clip at the sentence boundary
// (using the per-word timings from scripts/narration/narrate.py) and followed by a pause. Its
// storyboard frames follow one another on their cue words, as animated transitions rather than
// cuts (scripts/video/scene.js): what stays moves, what's new slides in, scores build bar by bar.
// The article's examples play in full with the sounding chord lit. White background, subtitles at
// the bottom, no boxes.
//
// Usage:
//   python3 scripts/video/storyboard.py <work>/storyboard
//   python3 scripts/video/audio.py <engine.mid> <musicpracticepro> <work>/audio
//   node scripts/video/make-video.mjs <work>/storyboard/storyboard.json <work>/audio <out-dir>
//
// A drum track from the JazzJam app's backing-track engine (see audio.py) runs under the whole
// video. Each piano example waits for the next downbeat of the drums and enters in time, with the
// app's swing; the drums sit lower under the narration and come up while the piano plays.
// Writes <out-dir>/block-chords.mp4 and <out-dir>/youtube-description.txt.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [boardFile, audioDir, outDir] = process.argv.slice(2);
if (!boardFile || !audioDir || !outDir) throw new Error("usage: make-video.mjs <storyboard.json> <audio-dir> <out-dir>");
const BPM = 92, BAR = 4 * 60 / BPM;             // the examples' tempo, which audio.py checks the drums match
const DRUMS_UNDER_VOICE = 0.55, DRUMS_WITH_PIANO = 1.0;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSETS = path.join(ROOT, "src/assets/articles/block-chords");
const PEOPLE = path.join(ROOT, "scripts/video/assets/people");
const W = 1920, H = 1080, RATE = 48000;
const PAUSE = 1.2, TITLE_PAUSE = 1.6, EXAMPLE_TAIL = 0.8, OUTRO = 4.0;

const board = JSON.parse(fs.readFileSync(boardFile, "utf8"));
const narration = JSON.parse(fs.readFileSync(path.join(ASSETS, "narration/narration.json"), "utf8"));
const credits = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(PEOPLE, "credits.json"), "utf8"))
  .map((c) => [c.file.replace(/\.jpg$/, ""), c]));
const work = path.join(outDir, "work");
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const ff = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
const seconds = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries",
  "format=duration", "-of", "csv=p=0", f]).toString());
const decoded = {};
const decode = (mp3) => {
  if (!decoded[mp3]) {
    decoded[mp3] = path.join(work, `dec-${Object.keys(decoded).length}.wav`);
    ff("-i", mp3, "-ar", String(RATE), "-ac", "2", decoded[mp3]);
  }
  return decoded[mp3];
};
const silence = (dur, name) => {
  const f = path.join(work, name + ".wav");
  ff("-f", "lavfi", "-i", `anullsrc=r=${RATE}:cl=stereo`, "-af", `atrim=end_sample=${Math.round(dur * RATE)}`, f);
  return f;
};
const slice = (src, from, to, name) => {
  const f = path.join(work, name + ".wav");
  ff("-i", src, "-ss", from.toFixed(3), "-to", to.toFixed(3), "-c", "copy", f);
  return f;
};
const strip = (svg) => svg.replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>|<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, "");
const dataUri = (file) => "data:image/jpeg;base64," + fs.readFileSync(file).toString("base64");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on("console", (m) => m.type() === "warning" && console.warn("page:", m.text()));
await page.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Literata:opsz,wght@7..72,400;7..72,500&display=swap" rel="stylesheet">
<style>
  @font-face { font-family: "Accidentals"; src: local("Apple Symbols"), local("Arial Unicode MS"), local("Segoe UI Symbol"); unicode-range: U+266D-266F; }
  html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; color: #142030; }
  .brand { position: absolute; top: 44px; left: 64px; font: 600 30px Outfit, sans-serif; color: #142030; }
  .kicker { position: absolute; top: 50px; right: 64px; font: 600 24px Outfit, sans-serif; letter-spacing: .08em;
            text-transform: uppercase; color: #3670a0; }
  .vis { position: absolute; top: 110px; bottom: 230px; left: 80px; right: 80px; display: flex; flex-direction: column;
         align-items: center; justify-content: center; gap: 40px; }
  .ghosts { position: absolute; inset: 0; pointer-events: none; }
  .wrap { position: relative; flex: none; }
  .wrap svg { display: block; height: 400px; width: auto; max-width: 1760px; }
  .vis > .wrap:only-child svg { height: 560px; }
  .wrap.example { width: 1680px; }
  .wrap.example svg { width: 100%; height: auto; }
  .kb { flex: none; }
  .kb svg { display: block; height: 150px; width: auto; }
  .vis > .kb:only-child svg { height: 240px; }
  .titlebox { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .title { font: 700 128px Outfit, sans-serif; text-align: center; line-height: 1.05; }
  .sub { font: 400 46px Outfit, sans-serif; color: #4c6882; text-align: center; }
  .people { display: flex; gap: 56px; align-items: flex-start; flex: none; }
  .person { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .person img { height: 560px; width: auto; border-radius: 10px; display: block; }
  .pname { font: 600 36px Outfit, sans-serif; }
  .credit { font: 400 20px Outfit, sans-serif; color: #5a6b7d; margin-top: -6px; }
  .subs { position: absolute; left: 160px; right: 160px; bottom: 70px; min-height: 130px; display: flex;
          align-items: flex-end; justify-content: center; text-align: center;
          font: 400 42px/1.4 "Accidentals", Literata, Georgia, serif; color: #142030; }
  .subs.caption { font: 400 34px/1.4 "Accidentals", Outfit, sans-serif; color: #4c6882; }
  .cursor { position: absolute; top: 5%; bottom: 5%; width: 2.6%; transform: translateX(-50%); border-radius: 6px;
            background: rgba(255,196,0,.32); display: none; }
  path.Note.sounding, path.Note.spelled { fill: #e8590c !important; }
</style></head><body>
<div class="brand">JazzJam</div><div class="kicker"></div><div class="vis"></div><div class="subs"></div><div class="ghosts"></div>
</body></html>`);
await page.addScriptTag({ path: path.join(ROOT, "scripts/video/scene.js") });
await page.evaluate(() => document.fonts.ready);

const FPS = 30, MOVE = 0.6;                       // transition length (s), shortened when a frame is brief
let shotN = 0;
const shot = async () => {
  const f = path.join(work, `f${String(shotN++).padStart(5, "0")}.png`);
  await page.screenshot({ path: f });
  return f;
};
const frames = [], audio = [], chapters = [], pianoAt = [];
// The audio is assembled from hundreds of pieces; each one's real length is measured, and every
// silence pads to an exact time on the video's timeline, so rounding can never accumulate and
// spelled notes and piano entries land on the drums' beats to the sample.
let audioClock = 0;
const pushA = (...files) => files.forEach((f) => { audio.push(f); audioClock += seconds(f); });
const padTo = (target, name) => {
  const d = target - audioClock;
  if (d < -0.002) console.warn(`audio runs ${(-d * 1000).toFixed(1)} ms past ${name}`);
  if (d > 0.0002) pushA(silence(d, name));
};
let clock = 0, section = "";
const hold = (file, dur) => { if (dur > 0) { frames.push({ file, dur }); clock += dur; } };

// Animate the scene to `spec`, capturing every frame of the transition; returns seconds used.
const transition = async (spec, room) => {
  const n = Math.round(Math.min(MOVE, Math.max(room * 0.7, 0)) * FPS);
  await page.evaluate(({ spec, ms }) => window.scene.apply(spec, ms), { spec, ms: Math.max(n, 1) * 1000 / FPS });
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.scene.seek(t), i * 1000 / FPS);
    hold(await shot(), 1 / FPS);
  }
  await page.evaluate(() => window.scene.settle());
  return n / FPS;
};

const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const people = Object.fromEntries(Object.entries(credits).map(([id, c]) => [id, {
  id, name: c.name, src: dataUri(path.join(PEOPLE, c.file)),
  credit: c.credit_required ? `Photo: ${c.author}, ${c.licence}` : "" }]));
const specOf = (f, subs, kicker) => ({
  kicker, subs,
  photos: f.photos ? f.photos.map((id) => people[id]) : null,
  title: f.title && !f.score && !f.photos ? { text: f.title, sub: f.sub || "" } : null,
  score: f.score ? { id: hash(f.score), svg: strip(f.score), reveal: f.reveal ?? null, example: false } : null,
  keys: f.keys ? { svg: strip(f.keys) } : null,
});

// ---- chord spellings ------------------------------------------------------------------------
const BEAT = 60 / BPM;
const SPELLING = /^[A-G][♭♯]?(?:–[A-G][♭♯]?)+$/;
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (n) => { const m = n.match(/^([A-G])(b|#)?(\d)$/); return PC[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0) + 12 * (+m[3] + 1); };
const nameOf = (n) => n.replace(/\d$/, "");
const plain = (n) => n.replace("♭", "b").replace("♯", "#");
// Spelled names, in order, matched to a chord's notes lowest first: the indices that sound them.
const subsequence = (notes, spelled) => {
  const idx = []; let from = 0;
  for (const s of spelled) {
    const i = notes.findIndex((n, j) => j >= from && nameOf(n) === plain(s));
    if (i < 0) return null;
    idx.push(i); from = i + 1;
  }
  return idx;
};
// The keyboard's key order, as storyboard.py draws it: white keys A3..D6, then their black keys.
const WHITES = []; for (let m = midiOf("A3"); m <= midiOf("D6"); m++) if ([0, 2, 4, 5, 7, 9, 11].includes(m % 12)) WHITES.push(m);
const KEY_ORDER = [...WHITES, ...WHITES.filter((m) => [0, 2, 5, 7, 9].includes(m % 12)).map((m) => m + 1)];
// Where a spelling shows on the frame on screen: which bar and chord of the score, which keys.
const spellTarget = (f, spelled, n) => {
  const out = { score: null, keys: null };
  (f.bars || []).some((bar, b) => bar.some((chord, c) => {
    const idx = subsequence(chord, spelled);
    if (idx) out.score = { bar: b, chord: c, size: chord.length, idx };
    return idx;
  }));
  const kidx = f.keynotes && subsequence(f.keynotes, spelled);
  if (kidx) out.keys = kidx.map((i) => KEY_ORDER.indexOf(midiOf(f.keynotes[i])));
  if (!out.score && !out.keys) console.warn(`row ${n}: "${spelled.join("–")}" matches nothing on screen`);
  return out;
};

// A second audio layer for piano that sounds over the narration (build-up chords). Each clip
// starts at an exact time; a clip still ringing when the next starts is cut with a short fade.
const LEAD_IN = 0.25;
const overlay = [];
let overlayClock = 0;
const addOverlay = (file, at) => {
  if (at < overlayClock - 1e-4) {
    const last = overlay.pop(), lastStart = overlayClock - seconds(last), keep = at - lastStart;
    const cut = path.join(work, `ov-cut-${overlay.length}.wav`);
    ff("-i", last, "-af", `atrim=end_sample=${Math.round(keep * RATE)},afade=t=out:st=${Math.max(keep - 0.08, 0).toFixed(4)}:d=0.08`, cut);
    overlay.push(cut); overlayClock = lastStart + seconds(cut);
  }
  if (at - overlayClock > 0.0002) { overlay.push(silence(at - overlayClock, `ov-gap-${overlay.length}`)); overlayClock += seconds(overlay.at(-1)); }
  overlay.push(file); overlayClock += seconds(file);
};

const peopleUsed = new Set();
for (const row of board) {
  if (row.example) {
    // A full article example, entering on the next downbeat of the drums.
    const ex = row.example;
    const raw = fs.readFileSync(path.join(ASSETS, `${ex}.svg`), "utf8");
    const events = JSON.parse(fs.readFileSync(path.join(audioDir, `${ex}.events.json`), "utf8"));
    const wav = decode(path.join(audioDir, `${ex}.wav`));
    const len = seconds(wav);
    let wait = Math.ceil(clock / BAR - 1e-6) * BAR - clock;
    if (wait < 0.35) wait += BAR;                    // leave room to bring the score in
    const exStart = clock + wait;
    padTo(exStart, `wait-${ex}`);
    const used = await transition({ kicker: section, subs: { text: row.caption, caption: true },
      score: { id: hash(raw), svg: strip(raw), reveal: null, example: true } }, wait);
    await page.evaluate(({ id, events }) => window.scene.prepareExample(id, events), { id: hash(raw), events });
    const idle = await shot();
    hold(idle, wait - used);
    pianoAt.push([clock, clock + len]);
    let t = 0;
    for (const [k, e] of events.entries()) {
      hold(idle, e.t - t);
      await page.evaluate((k) => window.light(k), k);
      const end = k + 1 < events.length ? events[k + 1].t : Math.min(e.end, len);
      hold(await shot(), end - e.t);
      t = end;
    }
    await page.evaluate(() => window.light(-1));
    hold(idle, len - t + EXAMPLE_TAIL);
    pushA(wav);
    padTo(exStart + len + EXAMPLE_TAIL, `gap-${ex}`);
    continue;
  }

  if (row.section) { section = row.section; chapters.push({ t: clock, title: row.section }); }
  const rowStart = clock;
  // Cut this sentence out of its paragraph's narration, boundary halfway between words.
  const nar = narration[row.block], words = nar.words;
  const from = row.w0 === 0 ? 0 : (words[row.w0 - 1][1] + words[row.w0][0]) / 2;
  const to = row.w1 === words.length - 1 ? nar.duration : (words[row.w1][1] + words[row.w1 + 1][0]) / 2;
  const src = decode(path.join(ASSETS, `narration/${row.block}.mp3`));
  const isTitle = row.frames.length === 1 && row.frames[0].title && !row.frames[0].score && !row.frames[0].photos;
  const pause = isTitle ? TITLE_PAUSE : PAUSE;
  const sw = row.text.split(" ");

  // Chord spellings ("D–E–G–B–D") leave the narration: each note is said on its own beat of the
  // drums, starting on the first beat after the words before it. `pieces` maps the narration's
  // own time to the new, stretched sentence time so the cue words still land where they should.
  let local = 0, pos = from, nSlice = 0;
  const pieces = [], spells = [];
  const narrate = (a, b) => {
    if (b > a) { pushA(slice(src, a, b, `s${row.n}-${nSlice++}`)); pieces.push({ a, b, at: local }); local += b - a; }
  };
  sw.forEach((w, i) => {
    const core = w.replace(/^[(]+|[).,;:]+$/g, "");
    if (!SPELLING.test(core)) return;
    const wi = row.w0 + i;
    const cutA = i === 0 ? from : (words[wi - 1][1] + words[wi][0]) / 2;
    const cutB = i === sw.length - 1 ? to : (words[wi][1] + words[wi + 1][0]) / 2;
    narrate(pos, cutA);
    // the first beat after the words, as actually laid down (a slice can run a few ms long)
    const beat0 = Math.ceil(Math.max(rowStart + local, audioClock) / BEAT - 1e-6) * BEAT - rowStart;
    padTo(rowStart + beat0, `s${row.n}-w${nSlice++}`); local = beat0;
    const notes = core.split("–");
    const sp = { notes, at: local, frameAt: words[wi][0] };
    for (const n of notes) {
      const clip = decode(path.join(audioDir, "notes", n.replace("♭", "b").replace("♯", "#") + ".wav"));
      pushA(clip);
      padTo(rowStart + local + BEAT, `s${row.n}-b${nSlice++}`);
      local += BEAT;
    }
    pieces.push({ a: cutA, b: cutB, at: sp.at, len: notes.length * BEAT });
    spells.push(sp);
    pos = cutB;
  });
  narrate(pos, to);
  padTo(rowStart + local + pause, `gap-s${row.n}`);
  const total = local + pause;
  const warp = (t) => {
    const p = pieces.find((q) => t >= q.a && t < q.b) || pieces.at(-1);
    return p.len !== undefined ? p.at : p.at + (t - p.a);
  };

  // Frame k starts on its cue word; a cue may be a phrase ("on B").
  const bare = (w) => w.replace(/^[^\p{L}\p{N}]+/u, "");
  const starts = row.frames.map((f, k) => {
    if (k === 0 || !f.cue) return 0;
    const cw = f.cue.split(" ");
    const i = sw.findIndex((_, j) => cw.every((c, m) => bare(sw[j + m] || "").startsWith(c)));
    if (i < 0) throw new Error(`row ${row.n}: cue "${f.cue}" not in sentence`);
    return warp(words[row.w0 + i][0]);
  });

  // Each spelled note lights its notehead and key as it is said; all clear on the beat after.
  const events = row.frames.map((f, k) => ({ t: starts[k], frame: k }));
  // Build-up frames marked "play" sound their new bar on the next drum beat; the bar is brought in
  // just before, so it has faded up as the chord sounds.
  for (const [k, f] of row.frames.entries()) {
    if (!f.play) continue;
    const onset = Math.ceil((rowStart + starts[k]) / BEAT - 1e-6) * BEAT;
    if (k > 0) events[k].t = Math.max(onset - rowStart - LEAD_IN, events[k - 1].t + 0.1);
    addOverlay(decode(path.join(audioDir, "chords", f.bars[f.reveal - 1][0].join("-") + ".wav")), onset);
  }
  for (const sp of spells) {
    const k = starts.filter((s) => s <= sp.at + 1e-6).length - 1;
    const target = spellTarget(row.frames[k], sp.notes, row.n);
    sp.notes.forEach((_, j) => events.push({ t: sp.at + j * BEAT, light: { ...target, upto: j } }));
    events.push({ t: sp.at + sp.notes.length * BEAT, light: null });
  }
  events.sort((a, b) => a.t - b.t || (a.frame !== undefined ? -1 : 1));
  for (const [i, ev] of events.entries()) {
    const len = (i + 1 < events.length ? events[i + 1].t : total) - ev.t;
    if (ev.frame !== undefined) {
      const f = row.frames[ev.frame];
      (f.photos || []).forEach((p) => peopleUsed.add(p));
      const used = await transition(specOf(f, isTitle ? null : { text: row.text }, isTitle ? "" : section), len);
      hold(await shot(), len - used);
    } else {
      await page.evaluate((l) => window.scene.spell(l), ev.light);
      hold(await shot(), len);
    }
  }
}

const outroStart = clock;
const outroUsed = await transition({ kicker: "", subs: null,
  title: { text: "Practise this in Jazz Jam Studio", sub: "jazzjam.app" } }, OUTRO);
hold(await shot(), OUTRO - outroUsed);
padTo(outroStart + OUTRO, "outro");
await browser.close();

if (clock - overlayClock > 0.0002) { overlay.push(silence(clock - overlayClock, "ov-end")); }
const olist = path.join(work, "overlay.txt");
fs.writeFileSync(olist, overlay.map((a) => `file '${a}'`).join("\n") + "\n");
const vlist = path.join(work, "frames.txt");
fs.writeFileSync(vlist, frames.map((f) => `file '${f.file}'\nduration ${f.dur.toFixed(4)}`).join("\n")
  + `\nfile '${frames.at(-1).file}'\n`);
const alist = path.join(work, "audio.txt");
fs.writeFileSync(alist, audio.map((a) => `file '${a}'`).join("\n") + "\n");
const out = path.join(outDir, "block-chords.mp4");
// Drums: louder while the piano plays (short ramps either side), faded out over the outro.
const up = pianoAt.map(([a, b]) =>
  `clip((t-${(a - 0.4).toFixed(3)})/0.4,0,1)*clip((${(b + 0.6).toFixed(3)}-t)/0.6,0,1)`).join("+");
const gain = `${DRUMS_UNDER_VOICE}+${(DRUMS_WITH_PIANO - DRUMS_UNDER_VOICE).toFixed(2)}*(${up})`;
ff("-f", "concat", "-safe", "0", "-i", vlist, "-f", "concat", "-safe", "0", "-i", alist,
   "-i", path.join(audioDir, "drums.wav"), "-f", "concat", "-safe", "0", "-i", olist,
   "-filter_complex",
   `[2:a]aresample=${RATE},atrim=0:${clock.toFixed(3)},volume='${gain}':eval=frame,` +
   `afade=t=out:st=${(clock - OUTRO).toFixed(3)}:d=${OUTRO}[d];` +
   `[1:a][3:a][d]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.95[a]`,
   "-map", "0:v", "-map", "[a]",
   "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-tune", "stillimage",
   "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", clock.toFixed(3), out);

const ts = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const photoCredits = [...peopleUsed].map((p) => credits[p]).map((c) =>
  `${c.name}: ${c.credit_required ? `photo by ${c.author}, ${c.licence}` : `${c.licence.toLowerCase()} photo`} (${c.source})`);
fs.writeFileSync(path.join(outDir, "youtube-description.txt"), [
  "Three ways to harmonise passing tones when playing block chords (locked hands) at the piano: diminished, diatonic and chromatic. All examples in C.",
  "",
  "Read the article: https://jazzjam.app/articles/block-chords/",
  "Practise jazz with a virtual band in Jazz Jam Studio: https://jazzjam.app/",
  "",
  "Chapters",
  ...chapters.map((c) => `${ts(c.t)} ${c.title}`),
  "",
  "Photos (Wikimedia Commons)",
  ...photoCredits,
  "",
].join("\n"));
console.log(`video: ${out} (${seconds(out).toFixed(1)}s video, timeline ${clock.toFixed(1)}s, ${shotN} rendered frames)`);
