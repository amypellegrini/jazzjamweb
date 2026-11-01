#!/usr/bin/env python3
"""Block chords video storyboard: one entry per narrated sentence, each a list of frames.

A frame shows any of: a score snippet (MuseScore, from the same voicing code as the article's
examples), a keyboard (piano-chord-charts CLI, recoloured to the article's colour code), a title.
`cue` is the word in the sentence at which the frame appears (the narration's word timings drive
the cut in the video); the first frame of a sentence has no cue.

Run to render every snippet and keyboard and write a review page:
    python3 scripts/video/storyboard.py <out-dir>
Needs MuseScore 4 (MSCORE) and the piano-chord-charts CLI (PCC, path to dist/cli.js or a binary).
"""
import html, importlib.util, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
spec = importlib.util.spec_from_file_location("bc", os.path.join(ROOT, "scripts/sheet-music/block-chords.py"))
bc = importlib.util.module_from_spec(spec); spec.loader.exec_module(bc)

PCC = os.environ.get("PCC", os.path.expanduser("~/Documents/GitHub/piano-chord-charts/dist/cli.js"))
# Keyboard key colours: soft tints of the notation's role colours (same hues, so they still read
# as the same roles, but quiet enough for a keyboard full of them).
ROLE = {"melody": "#DDA5B8", "chord": "#A6D1AE", "passing": "#A7BCE8", "lh": "#BDB2E6", "muted": "#E3E8ED"}
# Full-strength colours for text drawn into the score (matches the article's notation colours).
INK = {"passing": "#2563EB"}

# ---- notation helpers -----------------------------------------------------------------------
C6 = {"C": ["C5", "A4", "G4", "E4"], "E": ["E5", "C5", "A4", "G4"], "G": ["G5", "E5", "C5", "A4"],
      "A": ["A5", "G5", "E5", "C5"], "C'": ["C6", "A5", "G5", "E5"]}
DIM = {"D": ["D5", "B4", "Ab4", "F4"], "F": ["F5", "D5", "B4", "Ab4"], "Ab": ["Ab5", "F5", "D5", "B4"],
       "B": ["B5", "Ab5", "F5", "D5"]}
MAJ9 = {"D": ["D5", "B4", "G4", "E4"], "B": ["B5", "G5", "E5", "D5"]}
F6 = ["F5", "D5", "C5", "A4"]
ABM7 = ["Ab5", "Gb5", "Eb5", "Cb5"]
B6 = ["B5", "G#5", "F#5", "D#5"]

def blk(notes, sym=None, dur=8, lh=True, **opts):
    """One block: right-hand notes top-first; the left hand doubles the melody an octave down
    unless lh=False. opts are the generator's overrides (rh/lh colours, text)."""
    c = (dur, sym, notes, [bc.oct_down(notes[0])] if lh else [])
    return c + (opts,) if opts else c

def bars(*blocks):
    """Each block in its own whole-note bar."""
    return [[b] for b in blocks]

def line(*blocks):
    """Blocks packed into 4/4 bars in order (durations in eighths)."""
    out, cur, used = [], [], 0
    for b in blocks:
        if used + b[0] > 8: out.append(cur); cur, used = [], 0
        cur.append(b); used += b[0]
    if cur: out.append(cur)
    return out

def mel(note, sym=None, dur=1, **opts):
    return blk([note], sym, dur, lh=False, **opts)

# ---- keyboard helpers ------------------------------------------------------------------------
STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def midi(n):
    m = re.fullmatch(r"([A-G])(b|#)?(\d)", n)
    return STEP[m[1]] + {"b": -1, "#": 1, None: 0}[m[2]] + 12 * (int(m[3]) + 1)

def keys_block(rh, lh=True, passing=None):
    """Keyboard roles for a block: melody on top, chord tones beneath, left-hand doubling."""
    passing = bc.is_passing(rh) if passing is None else passing
    k = [(rh[0], "passing" if passing else "melody")] + [(n, "passing" if passing else "chord") for n in rh[1:]]
    if lh: k.append((bc.oct_down(rh[0]), "lh"))
    return k

def keys_of(notes, role):
    return [(n, role) for n in notes]

# ---- the storyboard --------------------------------------------------------------------------
def F(score=None, keys=None, title=None, sub=None, cue=None, example=None, photos=None, reveal=None, play=False):
    """photos: slugs from assets/people (credits.json holds each photo's licence and author).
    reveal: show only the score's first n bars; frames of one row that share a score and step
    the reveal build that score up in place instead of cutting to a new one.
    play: sound the newly revealed bar on the piano, on a drum beat, as it appears."""
    return {k: v for k, v in dict(score=score, keys=keys, title=title, sub=sub, cue=cue, example=example,
                                  photos=photos, reveal=reveal, play=play or None).items() if v is not None}

SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]
BEBOP = [("C5", "C6"), ("D5", "Cmaj9"), ("E5", "C6"), ("F5", "F6"), ("G5", "C6"), ("Ab5", "Bdim7"), ("A5", "C6"), ("B5", "Cmaj9")]
BASIC = bc.E["basic-shape"][1]

ROWS = [
  # Introduction
  [F(title="Piano Block Chords", sub="Three ways to harmonise passing tones")],
  [F(score=bars(blk(C6["C"], "C6")), keys=keys_block(C6["C"]))],
  [F(score=line(*[mel(n, dur=2) for n in ("C5", "E5", "G5", "A5")])),
   F(score=line(*[blk(C6[n], dur=2) for n in "CEGA"]), cue="every")],
  [F(photos=["shearing"]), F(photos=["shearing", "garland"], cue="Red"),
   F(photos=["shearing", "garland", "peterson"], cue="Oscar")],
  [F(score=BASIC, reveal=1, play=True, keys=[("C5", "melody")]),
   F(score=BASIC, reveal=2, play=True, keys=[("C5", "melody")] + keys_of(["A4", "G4", "E4"], "chord"), cue="fill"),
   F(score=BASIC, reveal=3, play=True, keys=keys_block(C6["C"]), cue="double")],
  [F(score=BASIC[2:], keys=keys_block(C6["C"]))],
  [F(score=line(*[blk(C6[n], dur=2) for n in "CEGA"]), keys=keys_of(["C4", "E4", "G4", "A4"], "chord"))],
  [F(score=line(*[mel(n) for n in ("C5", "D5", "E5", "F5", "G5", "A5", "B5")], mel("C6")),
     keys=[(n, "passing" if n[0] in "DFB" else "chord") for n in SCALE + ["C5"]])],
  [F(title="Diminished · Diatonic · Chromatic")],
  [F(keys=keys_of(SCALE + ["C5"], "muted"))],
  # Diminished
  [F(title="Diminished")],
  [F(keys=keys_of(["D4", "F4", "Ab4", "B4"], "passing"))],
  [F(keys=[(n, "passing" if n[0] in "DFB" or n == "G#4" else "chord") for n in ["C4", "D4", "E4", "F4", "G4", "G#4", "A4", "B4"]]),
   F(keys=keys_of(["D4", "F4", "Ab4", "B4"], "passing"), cue="together")],
  [F(score=bars(blk(["Ab4", "F4", "D4", "B3"], "Bdim7", lh=False)), keys=keys_of(["B3", "D4", "F4", "Ab4"], "passing"))],
  [F(score=bars(blk(C6["C"], "C6"), blk(DIM["D"], "Bdim7"), blk(C6["E"], "C6")), reveal=2, keys=keys_block(DIM["D"])),
   F(score=bars(blk(C6["C"], "C6"), blk(DIM["D"], "Bdim7"), blk(C6["E"], "C6")), reveal=3, keys=keys_block(C6["E"]), cue="back")],
  [F(score=bc.E["diminished"][1][:1]),
   F(score=bars(blk(DIM["D"], None, text=("B°7 = G7♭9 without its root", INK["passing"])), blk(C6["E"], "C6")), cue="same")],
  [F(score=line(*[mel(n, s) for n, s in
                  [("C5", "C6"), ("D5", "Bdim7"), ("E5", "C6"), ("F5", "Bdim7"), ("G5", "C6"), ("Ab5", "Bdim7"), ("A5", "C6"), ("B5", "Bdim7")]],
                mel("C6", "C6", dur=8)))],
  [F(score=bars(*[blk(r, s, lh=False) for r, s in [(["Ab4", "F4", "D4", "B3"], "Bdim7"), (["B4", "Ab4", "F4", "D4"], "Ddim7"),
                                                  (["D5", "B4", "Ab4", "F4"], "Fdim7"), (["F5", "D5", "B4", "Ab4"], "Abdim7")]]),
     keys=keys_of(["B3", "D4", "F4", "Ab4"], "passing"))],
  # Diatonic
  [F(title="Diatonic")],
  [F(keys=keys_of(SCALE + ["C5"], "muted"))],
  [F(score=bars(blk(DIM["D"], "Bdim7"), blk(MAJ9["D"], "Cmaj9")), reveal=1),
   F(score=bars(blk(DIM["D"], "Bdim7"), blk(MAJ9["D"], "Cmaj9")), reveal=2, cue="stay")],
  [F(score=bars(blk(DIM["D"], "Bdim7"), blk(MAJ9["D"], "Cmaj9")))],
  [F(score=line(*[blk(C6[n], dur=2) for n in "CEGA"]), keys=keys_of(["C4", "E4", "G4", "A4"], "chord"))],
  [F(title="Rootless major ninth")],
  [F(score=bars(blk(["D5", "B4", "G4", "E4", "C4"], "Cmaj9", lh=False)), keys=keys_of(["C4", "E4", "G4", "B4", "D5"], "chord")),
   F(score=bars(blk(MAJ9["D"], None, lh=False, text=("rootless Cmaj9", INK["passing"]))), keys=keys_of(["E4", "G4", "B4", "D5"], "passing"), cue="left")],
  [F(score=bars(blk(MAJ9["D"], "Cmaj9"), blk(MAJ9["B"], "Cmaj9")), reveal=1, keys=keys_block(MAJ9["D"])),
   F(score=bars(blk(MAJ9["D"], "Cmaj9"), blk(MAJ9["B"], "Cmaj9")), reveal=2, keys=keys_block(MAJ9["B"]), cue="on B")],
  [F(score=bars(blk(C6["E"], "C6"), blk(MAJ9["D"], "Cmaj9")),
     keys=[("C4", "muted"), ("D4", "passing"), ("E4", "chord"), ("G4", "chord"), ("A4", "muted"), ("B4", "passing")])],
  [F(title="Minor seventh or major sixth")],
  [F(keys=[(n, "passing" if n == "F4" else "muted") for n in SCALE + ["C5"]])],
  [F(score=bars(blk(F6, "F6")), keys=keys_block(F6))],
  [F(score=bars(blk(F6, "Dm7")), keys=keys_of(["A4", "C5", "D5", "F5"], "passing")),
   F(score=bars(blk(F6, "F6")), keys=keys_of(["A4", "C5", "D5", "F5"], "passing"), cue="F6")],
  [F(score=line(*[blk(r, s, dur=2) for r, s in [(C6["C"], "C6"), (MAJ9["D"], "Cmaj9"), (C6["E"], "C6"), (F6, "F6"),
                                                (C6["G"], "C6"), (C6["A"], "C6"), (MAJ9["B"], "Cmaj9"), (C6["C'"], "C6")]]))],
  [F(example="minor-seventh")],
  # Chromatic
  [F(title="Chromatic")],
  [F(score=bars(blk(ABM7, "Abm7"), blk(C6["A"], "Am7")), keys=keys_block(ABM7))],
  [F(score=line(mel("Ab5", dur=4), mel("A5", dur=4)), keys=[("Ab4", "passing"), ("A4", "melody")])],
  [F(score=line(*[mel(n, s, rh=[INK["passing"]] if n[:2] in ("Ab", "B5") else [None]) for n, s in BEBOP], mel("C6", "C6", dur=8)))],
  [F(score=bars(blk(C6["A"], "C6")), keys=keys_block(C6["A"])),
   F(score=bars(blk(C6["A"], "Am7")), keys=keys_block(C6["A"]), cue="Am7")],
  [F(score=bars(blk(ABM7, "Abm7"), blk(C6["A"], "Am7")), keys=keys_block(ABM7))],
  [F(score=bars(blk(B6, "B6"), blk(C6["C'"], "C6")), keys=keys_block(B6))],
  [F(score=bars(blk(ABM7, "Abm7"), blk(C6["A"], "Am7"), blk(B6, "B6"), blk(C6["C'"], "C6")))],
]
# The article's full examples play after these sentence indices.
# (The basic shape is not replayed: its build-up in row 4 plays each bar as it appears.)
EXAMPLES_AFTER = {17: "diminished", 26: "rootless-major-ninth", 32: "minor-seventh", 40: "chromatic"}
SECTIONS = {0: "Introduction", 10: "Diminished", 18: "Diatonic", 23: "Rootless major ninth",
            27: "Minor seventh or major sixth", 33: "Chromatic"}

# ---- rendering -------------------------------------------------------------------------------
_scores = {}
def render_score(measures, path):
    source = bc.build("", measures)
    if source in _scores: return _scores[source]
    xml = path + ".musicxml"
    open(xml, "w").write(source)
    subprocess.run([bc.MSCORE, "-o", path + ".svg", "-T", "10", xml], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.replace(path + "-1.svg", path + ".svg")
    _scores[source] = open(path + ".svg").read()
    return _scores[source]

# Every keyboard in the video spans the same keys, A3 to D6 (all the voicings plus a white key
# either side), so it can stay on screen between sentences and only its colours change.
KEY_RANGE = ("A3", "D6")
_keyboard = {}
def render_keys(spec, path):
    """The keyboard from piano-chord-charts, drawn once without highlights over KEY_RANGE, then
    coloured key by key by exact pitch. (The CLI's own --highlightKeys matches note names without
    octaves, left to right, so with a fixed range a lone C5 would light the first C on the board.)"""
    lo, hi = midi(KEY_RANGE[0]), midi(KEY_RANGE[1])
    for n, _ in spec:
        if not lo <= midi(n) <= hi:
            raise ValueError(f"{path}: {n} is outside the keyboard range {KEY_RANGE}")
    whites = [m for m in range(lo, hi + 1) if m % 12 in (0, 2, 4, 5, 7, 9, 11)]
    if "svg" not in _keyboard:
        start = "CDEFGAB"[[0, 2, 4, 5, 7, 9, 11].index(whites[0] % 12)]
        out = os.path.dirname(path)
        subprocess.run(["node", PCC, "--outDir", out, "--fileName", "keyboard.svg", "--format", "compact",
                        "--size", str(len(whites)), "--startFrom", start], check=True)
        _keyboard["svg"] = open(os.path.join(out, "keyboard.svg")).read()
    svg = _keyboard["svg"]
    # The CLI writes every white key left to right, then the black key after each C, D, F, G, A.
    order = whites + [w + 1 for w in whites if w % 12 in (0, 2, 5, 7, 9)]
    rects = list(re.finditer(r'<rect style="fill:(#[0-9a-fA-F]{6})', svg))
    if len(rects) != len(order):
        raise ValueError(f"keyboard has {len(rects)} keys, expected {len(order)}")
    colour = {midi(n): ROLE[role] for n, role in spec}
    for m, r in sorted(zip(order, rects), key=lambda z: -z[1].start(1)):
        if m in colour:
            svg = svg[:r.start(1)] + colour[m] + svg[r.end(1):]
    return svg

def sentences(article_html):
    """The narrated text, split into sentences, in reading order."""
    spec = importlib.util.spec_from_file_location("nar", os.path.join(ROOT, "scripts/narration/narrate.py"))
    nar = importlib.util.module_from_spec(spec); spec.loader.exec_module(nar)
    p = nar.Blocks(); p.feed(open(article_html, encoding="utf-8").read())
    out = []  # (sentence, narration block, first word, last word) — words as narrate.py counts them
    for bi, b in enumerate(p.blocks):
        w = 0
        for part in re.split(r"(?<=[.?!])\s+(?=[A-Z“\"(])", b):
            n = len(part.split(" "))
            out.append((part, bi, w, w + n - 1)); w += n
    return out

def main(out):
    os.makedirs(out, exist_ok=True)
    text = sentences(os.path.join(ROOT, "src/articles/block-chords/index.html"))
    if len(text) != len(ROWS):
        raise SystemExit(f"{len(text)} sentences but {len(ROWS)} storyboard rows; update ROWS")
    board = []
    page = open(os.path.join(ROOT, "src/articles/block-chords/index.html"), encoding="utf-8").read()
    def caption(ex):
        m = re.search(rf'{re.escape(ex)}\.svg".*?<figcaption>(.*?)</figcaption>', page, re.S)
        return " ".join(re.sub(r"<[^>]+>", "", m[1]).split())
    for i, ((sentence, block, w0, w1), frames) in enumerate(zip(text, ROWS)):
        row = {"n": i, "section": SECTIONS.get(i), "text": sentence, "block": block, "w0": w0, "w1": w1, "frames": []}
        for j, f in enumerate(frames):
            fr = {k: f[k] for k in ("title", "sub", "cue", "example", "photos", "reveal", "play") if k in f}
            if "score" in f:
                fr["score"] = render_score(f["score"], os.path.join(out, f"s{i:02d}-{j}"))
                # The pitches behind the notation, per bar and per chord, lowest first, so the video
                # can light the notehead of each note as the narration spells it out.
                fr["bars"] = [[sorted(set(c[2] + c[3]), key=midi) for c in measure] for measure in f["score"]]
            if "keys" in f:
                fr["keys"] = render_keys(f["keys"], os.path.join(out, f"k{i:02d}-{j}"))
                fr["keynotes"] = sorted({n for n, _ in f["keys"]}, key=midi)
            if "example" in f:
                fr["score"] = open(os.path.join(ROOT, f"src/assets/articles/block-chords/{f['example']}.svg")).read()
            row["frames"].append(fr)
        board.append(row)
        if i in EXAMPLES_AFTER:
            ex = EXAMPLES_AFTER[i]
            board.append({"example": ex, "caption": caption(ex), "frames": [{"score": open(os.path.join(
                ROOT, f"src/assets/articles/block-chords/{ex}.svg")).read()}]})
        print(f"{i:2d} {len(frames)} frame(s)  {sentence[:60]}")
    json.dump(board, open(os.path.join(out, "storyboard.json"), "w"))

if __name__ == "__main__":
    main(sys.argv[1])
