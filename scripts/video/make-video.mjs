#!/usr/bin/env node
// Render the block chords video from the storyboard (scripts/video/storyboard.py).
//
// Every narrated sentence is cut out of its paragraph's narration clip at the sentence boundary
// (using the per-word timings from scripts/narration/narrate.py) and followed by a pause. Its
// storyboard frames follow one another on their cue words, as animated transitions rather than
// cuts (scripts/video/scene.js): what stays moves, what's new slides in, scores build bar by bar.
// The article's examples play in full with the sounding chord lit. White background, no subtitles,
// no boxes.
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
const BPM = 92, BAR = 4 * 60 / BPM, BEAT = 60 / BPM;             // the examples' tempo, which audio.py checks the drums match
const DRUMS_UNDER_VOICE = 0.15, DRUMS_WITH_PIANO = 0.35;
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
// A piece of narration, with 5 ms fades so a cut never clicks.
const slice = (src, from, to, name) => {
  const f = path.join(work, name + ".wav"), d = to - from;
  ff("-ss", from.toFixed(4), "-to", to.toFixed(4), "-i", src,
     "-af", `afade=t=in:d=0.005,afade=t=out:st=${Math.max(d - 0.005, 0).toFixed(4)}:d=0.005`, f);
  return f;
};
// Where to cut between two words: the quietest 10 ms in the gap the word timings give, widened a
// little either side, since a word's first sound (the "s" of "stack") often starts before its
// timed start, and a cut at the timing alone would clip it.
const quietest = (src, a, b) => {
  const lo = Math.max(a - 0.06, 0), hi = b + 0.06, SR = 16000;
  const pcm = execFileSync("ffmpeg", ["-loglevel", "error", "-ss", lo.toFixed(4), "-to", hi.toFixed(4), "-i", src,
    "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"]);
  const n = pcm.length >> 1, win = SR / 100, hop = SR / 400;
  let best = (a + b) / 2, bestE = Infinity;
  for (let i = 0; i + win <= n; i += hop) {
    let e = 0;
    for (let j = i; j < i + win; j++) { const v = pcm.readInt16LE(j * 2); e += v * v; }
    // Ties (true silence) go to the middle of the gap.
    const t = lo + (i + win / 2) / SR, score = e + Math.abs(t - (a + b) / 2) * 1e3;
    if (score < bestE) { bestE = score; best = t; }
  }
  return best;
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
  .vis { position: absolute; top: 110px; bottom: 90px; left: 80px; right: 80px; display: flex; flex-direction: column;
         align-items: center; justify-content: center; gap: 40px; }
  .ghosts { position: absolute; inset: 0; pointer-events: none; }
  .wrap { position: relative; flex: none; }
  .wrap svg { display: block; height: 400px; width: auto; max-width: 1760px; }
  .vis > .wrap:only-child svg { height: 560px; }
  .kb { flex: none; }
  .kb svg { display: block; height: 150px; width: auto; }
  .vis > .kb:only-child svg { height: 240px; }
  .kw { font: 700 104px "Accidentals", Outfit, sans-serif; line-height: 1.1; text-align: center; color: #142030; flex: none; }
  .kw.newest { color: var(--accent); }
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
  path.Note.sounding { fill: #2563EB !important; }
  path.Note.sounding.lh { fill: #7048E8 !important; }
  path.Note.lit { fill: #E8590C !important; }
  .note { font: 400 34px Outfit, sans-serif; color: #5a6b7d; text-align: center; margin-top: 28px; }
  .note:empty { display: none; }
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
const frames = [], audio = [], chapters = [], pianoAt = [], titleAt = [];
// The audio is assembled from hundreds of pieces; each one's real length is measured, and every
// silence pads to an exact time on the video's timeline, so rounding can never accumulate and
// build-up chords and piano entries land on the drums' beats to the sample.
let audioClock = 0;
const pushA = (...files) => files.forEach((f) => { audio.push(f); audioClock += seconds(f); });
const padTo = (target, name) => {
  const d = target - audioClock;
  if (d < -0.002) console.warn(`audio runs ${(-d * 1000).toFixed(1)} ms past ${name}`);
  if (d > 0.0002) pushA(silence(d, name));
};
let clock = 0, section = "", lastShot = null, clearNext = false;   // after a title or an example
const hold = (file, dur) => { if (dur > 0) { frames.push({ file, dur }); clock += dur; lastShot = file; } };

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
// Every snippet is drawn at the same scale (MuseScore's units to pixels), so a one-staff melody is
// not blown up to the height of a grand staff; only one too big for its space shrinks to fit.
const SCALE = { alone: 0.32, withKeys: 0.235 }, MAX_W = 1760, MAX_H = { alone: 560, withKeys: 400 };
const scoreHeight = (svg, keys) => {
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number), k = keys ? "withKeys" : "alone";
  return Math.round(h * Math.min(SCALE[k], MAX_W / w, MAX_H[k] / h));
};
// The article's examples: as wide as the frame allows, leaving room for the keyboard under them.
const exampleHeight = (svg) => {
  const [, , w, h] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  return Math.round(Math.min(1680 * h / w, 600));
};
const specOf = (f, subs, kicker) => ({
  kicker, subs,
  photos: f.photos ? f.photos.map((id) => people[id]) : null,
  title: f.title && !f.score && !f.photos ? { text: f.title, sub: f.sub || "" } : null,
  words: f.words || null,
  score: f.score ? { id: hash(f.score), svg: strip(f.score), reveal: f.reveal ?? null, example: false,
    mark: f.mark || null, height: scoreHeight(f.score, !!f.keys) } : null,
  // Chords named by the sentence: the keyboard goes straight to them.
  keys: f.keys ? { svg: strip(f.lit_keys || f.keys) } : null,
});

// A second audio layer for piano that sounds over the narration (the storyboard's scores). Each clip
// starts at an exact time; a clip still ringing when the next starts is cut with a short fade.
const LEAD_IN = 0.45, TAIL = 0.3;     // bars come in ahead of the piano; a played snippet's release
const musicLen = (f) => f.music.flat().reduce((t, c) => t + c[0], 0) * BEAT / 2 + TAIL;
const track = (name) => ({ name, list: [], clock: 0 });
const chordsTrack = track("chords");
const addTo = (tr, file, at) => {
  if (at < tr.clock - 1e-4) {
    const last = tr.list.pop(), lastStart = tr.clock - seconds(last), keep = at - lastStart;
    const cut = path.join(work, `${tr.name}-cut-${tr.list.length}.wav`);
    ff("-i", last, "-af", `atrim=end_sample=${Math.round(keep * RATE)},afade=t=out:st=${Math.max(keep - 0.08, 0).toFixed(4)}:d=0.08`, cut);
    tr.list.push(cut); tr.clock = lastStart + seconds(cut);
  }
  if (at - tr.clock > 0.0002) { tr.list.push(silence(at - tr.clock, `${tr.name}-gap-${tr.list.length}`)); tr.clock += seconds(tr.list.at(-1)); }
  tr.list.push(file); tr.clock += seconds(file);
};
const finish = (tr) => {
  if (clock - tr.clock > 0.0002) tr.list.push(silence(clock - tr.clock, `${tr.name}-end`));
  const f = path.join(work, `${tr.name}.txt`);
  fs.writeFileSync(f, tr.list.map((a) => `file '${a}'`).join("\n") + "\n");
  return f;
};

const peopleUsed = new Set();
for (const row of board) {
  if (row.example) {
    // A full article example, entering on the next downbeat of the drums.
    const ex = row.example;
    const raw = row.frames[0].score;      // the article's image, recoloured by storyboard.py
    const events = JSON.parse(fs.readFileSync(path.join(audioDir, `${ex}.events.json`), "utf8"));
    const wav = decode(path.join(audioDir, `${ex}.wav`));
    const len = seconds(wav);
    let wait = Math.ceil(clock / BAR - 1e-6) * BAR - clock;
    if (wait < 0.35) wait += BAR;                    // leave room to bring the score in
    const exStart = clock + wait;
    padTo(exStart, `wait-${ex}`);
    const fr = row.frames[0];
    const used = await transition({ kicker: section, subs: null, keys: { svg: strip(fr.keys) },
      score: { id: hash(raw), svg: strip(raw), reveal: null, example: true, height: exampleHeight(raw) } }, wait);
    await page.evaluate(({ id, events, keys }) => window.scene.prepareExample(id, events, keys),
      { id: hash(raw), events, keys: { blank: strip(fr.keys), play: fr.play_keys.map(strip) } });
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
    clearNext = true;
    continue;
  }

  if (row.section) { section = row.section; chapters.push({ t: clock, title: row.section }); }
  const rowStart = clock;
  // Cut this sentence out of its paragraph's narration, boundary halfway between words.
  // (A sentence the video words differently has its own recording; see narrate-spoken.py.)
  // NARRATION=<dir> takes every sentence from narrate-elevenlabs.py's recordings instead.
  const own = process.env.NARRATION ? path.join(process.env.NARRATION, hash(row.text))
    : row.spoken && path.join(audioDir, "spoken", row.spoken);
  const nar = own ? JSON.parse(fs.readFileSync(own + ".json", "utf8")) : narration[row.block], words = nar.words;
  const w0 = own ? 0 : row.w0, w1 = own ? words.length - 1 : row.w1;
  const src = decode(own ? own + ".mp3" : path.join(ASSETS, `narration/${row.block}.mp3`));
  const between = (j) => quietest(src, words[j][1], words[j + 1][0]);   // the cut after word j
  const from = w0 === 0 ? 0 : between(w0 - 1);
  const to = w1 === words.length - 1 ? nar.duration : between(w1);
  const isTitle = row.frames.length === 1 && row.frames[0].title && !row.frames[0].score && !row.frames[0].photos;
  const pause = isTitle ? TITLE_PAUSE : PAUSE;
  const sw = row.text.split(" ");

  // Frame k starts on its cue word (a cue may be a phrase, "on B"). The sentence is cut at each cue,
  // and where a snippet's piano would still be playing when the next cue comes, the narration
  // waits for it, so every snippet is heard in full and in time with its picture. It waits at the
  // last comma or full stop before the cue if there is one (a natural breath), else at the cue.
  const bare = (w) => w.replace(/^[^\p{L}\p{N}]+/u, "");
  const cueWord = (f) => {
    if (!f.cue) return null;
    const cw = f.cue.split(" ");
    const i = sw.findIndex((_, j) => cw.every((c, m) => bare(sw[j + m] || "").startsWith(c)));
    if (i < 0) throw new Error(`row ${row.n}: cue "${f.cue}" not in sentence`);
    return w0 + i;
  };
  let local = 0, nSlice = 0, pos = from, musicEnd = 0, lastCue = w0;
  const narrate = (a, b) => { if (b > a) { pushA(slice(src, a, b, `s${row.n}-${nSlice++}`)); local += b - a; } };
  const starts = [], onsets = [];
  for (const [k, f] of row.frames.entries()) {
    const wi = cueWord(f);
    if (wi === null) starts[k] = k === 0 ? 0 : starts[k - 1];
    else {
      const cut = wi === w0 ? from : Math.max(pos, between(wi - 1));
      const wait = musicEnd - (local + words[wi][0] - pos);
      if (wait > 0.05) {
        let at = cut;
        for (let j = wi - 1; j >= lastCue && j > w0; j--) {
          if (/[,;:.!?)]$/.test(sw[j - w0])) { at = Math.max(pos, between(j)); break; }
        }
        narrate(pos, at); pos = at;
        padTo(rowStart + local + wait, `wait-s${row.n}-${k}`); local += wait;
      }
      narrate(pos, cut); pos = cut;
      starts[k] = local + words[wi][0] - cut;
      lastCue = wi;
    }
    if (f.music_id) {
      onsets[k] = Math.ceil((rowStart + starts[k]) / BEAT - 1e-6) * BEAT;
      musicEnd = onsets[k] - rowStart + musicLen(f);
    }
  }
  narrate(pos, to);
  const total = Math.max(local + pause, musicEnd);
  padTo(rowStart + total, `gap-s${row.n}`);
  if (isTitle) titleAt.push([rowStart, rowStart + total]);

  // The row's timeline: frame changes, and the chords lighting up while a snippet plays.
  const events = row.frames.map((f, k) => ({ t: starts[k], frame: k }));
  const lightsAt = [];
  for (const [k, f] of row.frames.entries()) {
    if (!f.music_id) continue;
    const at = onsets[k] - rowStart;
    if (k > 0 || f.cue) events[k].t = Math.max(at - LEAD_IN, k > 0 ? events[k - 1].t + 0.1 : 0);
    addTo(chordsTrack, decode(path.join(audioDir, "music", f.music_id + ".wav")), onsets[k]);
    const spans = JSON.parse(fs.readFileSync(path.join(audioDir, "music", f.music_id + ".events.json"), "utf8"));
    spans.forEach((sp, j) => lightsAt.push({ t: at + sp.t, frame: k, light: j }));
    lightsAt.push({ t: at + spans.at(-1).end, frame: k, light: -1 });
  }
  const timeline = [...events, ...lightsAt].sort((a, b) => a.t - b.t || ("light" in a) - ("light" in b));
  // A first frame on a cue: the picture holds until it, or after a title, the screen clears.
  if (timeline[0].t > 0) {
    if (clearNext) {
      const used = await transition({ kicker: section, subs: null }, timeline[0].t);
      hold(await shot(), timeline[0].t - used);
    } else hold(lastShot, timeline[0].t);
  }
  let current = -1;
  for (const [i, ev] of timeline.entries()) {
    const len = (i + 1 < timeline.length ? timeline[i + 1].t : total) - ev.t;
    if ("light" in ev) {
      if (ev.frame !== current) continue;          // the frame has already moved on
      await page.evaluate((k) => window.light(k), ev.light);
      hold(await shot(), len);
      continue;
    }
    const f = row.frames[ev.frame];
    current = ev.frame;
    (f.photos || []).forEach((p) => peopleUsed.add(p));
    const used = await transition(specOf(f, null, isTitle ? "" : section), len);
    if (f.music_id || f.light != null) {
      const counts = f.music_id ? f.music.map((bar) => bar.length) : f.chords;
      await page.evaluate(({ id, from, counts, keys }) => window.scene.prepareMusic(id, from, counts, keys),
        { id: hash(f.score), from: f.music_id ? f.music_from : 0, counts,
          keys: f.music_id && f.play_keys ? { blank: strip(f.keys), play: f.play_keys.map(strip) } : null });
      if (f.light != null) await page.evaluate((k) => window.light(k, "lit"), f.light);
    }
    hold(await shot(), len - used);
  }
  clearNext = isTitle;
}

const outroStart = clock;
const outroUsed = await transition({ kicker: "", subs: null,
  title: { text: "Check the full course", sub: "jazzjam.app/courses/block-chords",
           note: "Find the link in the description below" } }, OUTRO);
hold(await shot(), OUTRO - outroUsed);
padTo(outroStart + OUTRO, "outro");
await browser.close();

const layers = [chordsTrack].map(finish);
const vlist = path.join(work, "frames.txt");
fs.writeFileSync(vlist, frames.map((f) => `file '${f.file}'\nduration ${f.dur.toFixed(4)}`).join("\n")
  + `\nfile '${frames.at(-1).file}'\n`);
const alist = path.join(work, "audio.txt");
fs.writeFileSync(alist, audio.map((a) => `file '${a}'`).join("\n") + "\n");
const out = path.join(outDir, "block-chords.mp4");
// Drums: louder while the piano plays (short ramps either side), faded out over the outro.
const up = pianoAt.map(([a, b]) =>
  `clip((t-${(a - 0.4).toFixed(3)})/0.4,0,1)*clip((${(b + 0.6).toFixed(3)}-t)/0.6,0,1)`).join("+");
// Drums stop for the titles (fading out just before one and back in as it ends).
const quiet = titleAt.map(([a, b]) =>
  `clip((t-${(a - 0.5).toFixed(3)})/0.5,0,1)*clip((${(b + 0.3).toFixed(3)}-t)/0.3,0,1)`).join("+") || "0";
const gain = `(${DRUMS_UNDER_VOICE}+${(DRUMS_WITH_PIANO - DRUMS_UNDER_VOICE).toFixed(2)}*(${up}))*(1-min(1,${quiet}))`;
ff("-f", "concat", "-safe", "0", "-i", vlist, "-f", "concat", "-safe", "0", "-i", alist,
   "-i", path.join(audioDir, "drums.wav"), ...layers.flatMap((l) => ["-f", "concat", "-safe", "0", "-i", l]),
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
  "Four ways to harmonise passing tones when playing block chords (locked hands) at the piano, built on Barry Harris's sixth-diminished scale: diminished, diatonic, chromatic and 2 5 1. All examples in C, with six exercises to practise.",
  "",
  "The full course: https://jazzjam.app/courses/block-chords",
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
