#!/usr/bin/env python3
"""Block chords video storyboard: one entry per narrated sentence, each a list of frames.

A frame shows any of: a score snippet (MuseScore, from the same voicing code as the article's
examples), a keyboard (piano-chord-charts CLI, recoloured to the article's colour code), a title.
`cue` is the word in the sentence at which the frame appears (the narration's word timings drive
the cut in the video), so nothing is shown or played before the narration names it. A first frame
without a cue appears as the sentence starts; with one, the previous picture holds until the cue.

Run to render every snippet and keyboard and write a review page:
    python3 scripts/video/storyboard.py <out-dir>
Needs MuseScore 4 (MSCORE) and the piano-chord-charts CLI (PCC, path to dist/cli.js or a binary).
"""
import hashlib, html, importlib.util, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
spec = importlib.util.spec_from_file_location("bc", os.path.join(ROOT, "scripts/sheet-music/block-chords.py"))
bc = importlib.util.module_from_spec(spec); spec.loader.exec_module(bc)

PCC = os.environ.get("PCC", os.path.expanduser("~/Documents/GitHub/piano-chord-charts/dist/cli.js"))
# Keyboard key colours: soft tints of the notation's role colours (same hues, so they still read
# as the same roles, but quiet enough for a keyboard full of them).
ROLE = {"melody": "#DDA5B8", "chord": "#A6D1AE", "passing": "#A7BCE8", "lh": "#BDB2E6", "muted": "#E9CF9A",
        # A key the explanation points at (a tint of the explanation's orange in the notation), and
        # a key a voicing lacks.
        "lit": "#F5B990", "missing": "#EE8A8A",
        # While a chord sounds: the right hand in the keyboard chart's own highlight blue, the left
        # in violet (the sounding noteheads take the same pair: blue on the right, violet on the left).
        "rh_play": "#A0C6E8", "lh_play": "#BDB2E6"}
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
    m = re.fullmatch(r"([A-G])(bb|b|#)?(\d)", n)
    return STEP[m[1]] + {"bb": -2, "b": -1, "#": 1, None: 0}[m[2]] + 12 * (int(m[3]) + 1)

def keys_block(rh, lh=True, passing=None):
    """Keyboard roles for a block: melody on top, chord tones beneath, left-hand doubling."""
    passing = bc.is_passing(rh) if passing is None else passing
    k = [(rh[0], "passing" if passing else "melody")] + [(n, "passing" if passing else "chord") for n in rh[1:]]
    if lh: k.append((bc.oct_down(rh[0]), "lh"))
    return k

def keys_of(notes, role):
    return [(n, role) for n in notes]

# ---- the storyboard --------------------------------------------------------------------------
def F(score=None, keys=None, title=None, sub=None, cue=None, example=None, photos=None, reveal=None, words=None,
      play=None, mark=None, light=None, colour=None, follow=None):
    """photos: slugs from assets/people (credits.json holds each photo's licence and author).
    reveal: show only the score's first n bars; frames of one row that share a score and step
    the reveal build that score up in place instead of cutting to a new one. Every score shown is
    also played (see main).
    words: key words from the sentence, for a sentence with nothing to show; a row's frames add
    them one at a time on the cue where each is spoken.
    play=False: show the score without playing it (it plays later, or the narration talks over it).
    mark: "lh" or "rests", picks out the left hand's notes or the right hand's rests while they're named.
    light: the chords the sentence names, lit in the explanation's orange (nothing plays). Each is a
    chord index, or [index, "rh"] for its right hand only, or [index, [i, ...]] for some of its notes
    (counted top down, right hand then left). With keys=[] the keyboard shows the same notes.
    follow=True: a build-up whose keyboard follows the playing (a build-up otherwise keeps its
    keyboard in the colours of the score's labels).
    colour=True keeps the passing-tone blue. Without it a score is shown in black: the blue only
    means something where the whole scale is on screen and the sentence is about its passing tones."""
    return {k: v for k, v in dict(score=score, keys=keys, title=title, sub=sub, cue=cue, example=example,
                                  photos=photos, reveal=reveal, words=words, play=play, mark=mark,
                                  light=light, colour=colour, follow=follow).items() if v is not None}

SCALE = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]
BEBOP = ["C4", "D4", "E4", "F4", "G4", "Ab4", "A4", "B4", "C5"]
def ex(k): return bc.E[k][1]              # the article's own example, bar for bar
def scale_keys(**roles):
    """The sixth-diminished scale on the keyboard (C up to B, the octave C left off), muted except
    the notes given a role."""
    return [(n, roles.get(n[:-1], "muted")) for n in BEBOP[:-1]]
G7B9 = {k: v for k, v in DIM.items()}     # B°7 shapes, named G7♭9 as in the article
G7_F = ["F5", "D5", "B4", "G4"]
GSM7 = ["G#5", "F#5", "D#5", "B4"]
B6 = ["B5", "G#5", "F#5", "D#5"]
AM7_G, BBM7_AB = ["G5", "E5", "C5", "A4"], ["Ab5", "F5", "Db5", "Bb4"]
AM7_E, BBM7_F = ["E5", "C5", "A4", "G4"], ["F5", "Db5", "Bb4", "Ab4"]
CSM7 = ["G#5", "E5", "C#5", "B4"]
BLUE_RH = {"rh": [INK["passing"]]}
CH, CD = ex("chromatic"), ex("chromatic-descending")
SDS = ex("sixth-diminished-scale")
DOM = ex("dominant-seventh")

ROWS = [
  # 0-6 Introduction
  [F(title="Piano Block Chords", sub="Four ways to harmonise the major scale")],
  [F(words=[]), F(words=["harmonisation techniques"], cue="harmonisation"),
   F(words=["harmonisation techniques", "block chords"], cue="block"),
   F(words=["harmonisation techniques", "block chords", "at the piano"], cue="piano")],
  [F(words=["block chords"]), F(words=["block chords", "locked hands"], cue="locked"),
   F(score=line(*[mel(n, dur=2) for n in ("C5", "E5", "G5", "A5")]), cue="melody", play=False),
   F(score=line(*[blk(C6[n], dur=2) for n in "CEGA"]), cue="every")],
  [F(photos=["shearing"], cue="George"), F(photos=["shearing", "garland"], cue="Red"),
   F(photos=["shearing", "garland", "peterson"], cue="Oscar")],
  [F(score=ex("basic-shape"), reveal=0, keys=[]),
   F(score=ex("basic-shape"), reveal=1, keys=[("C5", "melody")], cue="melody"),
   F(score=ex("basic-shape"), reveal=2, keys=[("C5", "melody")] + keys_of(["A4", "G4", "E4"], "chord"), cue="fill"),
   F(score=ex("basic-shape"), reveal=3, keys=keys_block(C6["C"]), cue="double")],
  [F(score=ex("basic-shape")[2:], keys=keys_block(C6["C"]))],
  [F(score=ex("basic-shape-from-below"), reveal=0, keys=[]),
   F(score=ex("basic-shape-from-below"), reveal=1, keys=[("C4", "lh")], cue="root"),
   F(score=ex("basic-shape-from-below"), reveal=2, keys=[("C4", "lh")] + keys_of(["E4", "G4", "A4"], "chord"), cue="stack"),
   F(score=ex("basic-shape-from-below"), reveal=3, keys=keys_block(C6["C"]), cue="duplicate")],
  # 7-13 Harmonising the sixth-diminished scale
  [F(title="Harmonising the sixth-diminished scale")],
  [F(score=ex("sixth-diminished-scale"), keys=scale_keys())],
  [F(keys=[(n, "muted") for n in SCALE]),
   F(keys=scale_keys(Ab="passing"), cue="extra")],
  # Named one by one: the chord tones (green keys), then the passing tones (blue keys). Not played
  # here: the scale plays in full after the sentence.
  [F(score=SDS, keys=scale_keys(), play=False)] +
  [F(score=SDS, keys=scale_keys(**{n: "chord" for n in "CEGA"[:i + 1]}), light=[0, 2, 4, 6][:i + 1], cue=c)
   for i, c in enumerate(["C,", "E,", "G", "A)"])] +
  [F(score=SDS, keys=scale_keys(**{n: "chord" for n in "CEGA"}, **{n: "passing" for n in ["D", "F", "Ab", "B"][:i + 1]}),
     light=[1, 3, 5, 7][:i + 1], cue=c) for i, c in enumerate(["D,", "F,", "A♭", "B)"])],
  [F(words=["sixth-diminished scale"]), F(words=["sixth-diminished scale", "progressively"], cue="progressively"),
   F(score=line(*[blk(C6[n], dur=2) for n in "CEGA"]), keys=keys_of(["C4", "E4", "G4", "A4"], "chord"), cue="chord")],
  [F(score=ex("scale-chord-tones"), keys=keys_of(BEBOP[:-1], "lh"), play=False),
   F(score=ex("scale-chord-tones"), keys=keys_of(BEBOP[:-1], "lh"), mark="lh", cue="whole"),
   F(score=ex("scale-chord-tones"), keys=keys_of(BEBOP[:-1], "lh"), light=[[k, "rh"] for k in (0, 2, 4, 6, 8)], cue="C6")],
  [F(score=ex("scale-chord-tones"), keys=[(n, "passing" if n[:-1] in ("D", "F", "Ab", "B") else "lh") for n in BEBOP[:-1]],
     mark="rests", cue="silent")],
  # 14-23 Diminished passing tones
  [F(title="Diminished passing tones")],
  [F(title="Diminished passing tones", sub="Harmonise passing tones as diminished chords.")],
  [F(words=["sixth-diminished scale"]),
   F(score=ex("detail-c6-bdim7"), reveal=1, keys=keys_of(["C4", "E4", "G4", "A4"], "chord"), cue="chord", play=False),
   F(score=ex("detail-c6-bdim7"), reveal=1, keys=keys_of(["C4", "E4", "G4", "A4"], "chord") + keys_of(["D4", "F4", "Ab4", "B4"], "passing"), cue="non-chord")],
  [F(score=ex("detail-c6-bdim7"), reveal=2, keys=keys_of(["D4", "F4", "Ab4", "B4"], "passing"))],
  [F(score=ex("detail-g7b9-c6"), keys=keys_of(["D4", "F4", "Ab4", "B4"], "passing"), cue="rootless")],
  [F(score=bars(blk(C6["C"], "C6"), blk(G7B9["D"], "G7b9"), blk(C6["E"], "C6")), reveal=2, keys=keys_block(G7B9["D"]), cue="voice", follow=True),
   F(score=bars(blk(C6["C"], "C6"), blk(G7B9["D"], "G7b9"), blk(C6["E"], "C6")), reveal=3, keys=keys_block(C6["E"]), cue="back", follow=True)],
  [F(score=ex("exercise-diminished"), play=False),
   F(score=ex("detail-g7b9-c6"), cue="same")],
  [F(score=bars(blk(C6["C"], "C6"), blk(G7B9["D"], "G7b9")))],
  [F(words=["quick note"]), F(words=["diminished seventh chord"], cue="diminished"),
   F(words=["diminished seventh chord", "equal minor thirds"], cue="equal"),
   F(words=["diminished seventh chord", "equal minor thirds", "four names"], cue="different"),
   F(score=ex("detail-dim-names"), reveal=1, keys=[], cue="D°7", follow=True),
   F(score=ex("detail-dim-names"), reveal=2, keys=[], cue="A♭°7", follow=True)],
  [F(score=ex("detail-dim-names"), keys=keys_of(["D4", "F4", "Ab4", "B4"], "passing"))],
  # 24-28 Diatonic passing tones
  [F(title="Diatonic passing tones")],
  [F(title="Diatonic passing tones", sub="Harmonise passing tones as diatonic chords.")],
  [F(score=bars(blk(G7B9["D"], "G7b9"), blk(MAJ9["D"], "Cmaj9")), reveal=1, keys=[], follow=True),
   F(score=bars(blk(G7B9["D"], "G7b9"), blk(MAJ9["D"], "Cmaj9")), reveal=2, keys=[], cue="stay", follow=True)],
  [F(score=bars(blk(G7B9["D"], "G7b9"), blk(MAJ9["D"], "Cmaj9")), keys=[])],
  [F(score=line(*[blk(C6[n], "C6" if n == "C" else None, dur=2) for n in "CEGA"]), keys=keys_of(["C4", "E4", "G4", "A4"], "chord"))],
  # 29-33 Rootless major ninth voicing
  [F(title="Rootless major ninth voicing")],
  [F(words=[]), F(words=["rootless major ninth"], cue="rootless"),
   F(keys=scale_keys(D="passing", B="passing"), cue="second")],
  [F(score=[[(8,) + ex("detail-rootless")[0][0][1:]]],
     keys=keys_of(["E4", "G4", "B4", "D5"], "chord") + [("C4", "melody")], play=False),
   F(score=ex("detail-rootless"), keys=keys_of(["E4", "G4", "B4", "D5"], "passing"), cue="left")],
  [F(score=bars(blk(MAJ9["D"], "Cmaj9"), blk(MAJ9["B"], "Cmaj9")), reveal=1, keys=keys_block(MAJ9["D"]), cue="D", follow=True),
   F(score=bars(blk(MAJ9["D"], "Cmaj9"), blk(MAJ9["B"], "Cmaj9")), reveal=2, keys=keys_block(MAJ9["B"]), cue="and B", follow=True)],
  [F(score=bars(blk(C6["E"], "C6"), blk(MAJ9["D"], "Cmaj9")),
     keys=[("C4", "muted"), ("D4", "passing"), ("E4", "chord"), ("G4", "chord"), ("A4", "muted"), ("B4", "passing")])],
  # 34-40 Dominant seventh voicing
  [F(title="Dominant seventh voicing")],
  [F(words=["C major scale"]), F(score=[[(8, "Cmaj9", MAJ9["D"], [])]], keys=scale_keys(F="missing"), cue="fourth")],
  [F(score=bars(blk(G7_F, "G7")), keys=keys_block(G7_F), cue="G7")],
  [F(score=ex("detail-g7-maj9"), keys=[("E4", "muted"), ("F4", "passing"), ("G4", "chord"), ("B4", "chord"), ("D5", "chord"), ("F5", "passing")]),
   F(score=ex("detail-g7-maj9"), keys=[("E4", "muted"), ("F4", "muted"), ("G4", "lit"), ("B4", "lit"), ("D5", "lit"), ("F5", "muted")],
     light=[[0, [0, 1, 2]], [1, [1, 2, 3]]], cue="sharing")],
  # The whole scale stays up while the sentences name each chord in it.
  [F(score=DOM, keys=scale_keys(), play=False),
   F(score=DOM, keys=scale_keys(C="lit", E="lit", G="lit", A="lit"), light=[0, 2, 4, 6, 8], cue="C6"),
   F(score=DOM, keys=scale_keys(D="lit", B="lit"), light=[1, 7], cue="rootless"),
   F(score=DOM, keys=[], light=[3], cue="G7")],
  [F(score=DOM, keys=[], light=[5], cue="A♭")],
  [F(example="exercise-diatonic")],
  # 41-54 Chromatic passing tones
  [F(title="Chromatic passing tones")],
  [F(title="Chromatic passing tones", sub="Harmonise the passing tone with the target chord's own voicing, shifted by a half step.")],
  [F(words=["chromatic approach"]),
   F(score=line(mel("G#5", dur=4, **BLUE_RH), mel("A5", dur=4)), keys=[("G#4", "passing"), ("A4", "melody")], cue="approaching")],
  # The chromatic approaches are explained against the whole harmonised scale, up then down,
  # each chord lit as the sentence names it (it plays in full after the explanation).
  [F(score=CH, keys=[], play=False), F(score=CH, keys=[], light=[5], cue="G♯"), F(score=CH, keys=[], light=[7], cue="B")],
  [F(score=CH, keys=[], light=[6])],
  [F(score=CH, keys=[], light=[5]), F(score=CH, keys=[], light=[6], cue="A,"), F(score=CH, keys=[], light=[5], cue="G♯m7")],
  [F(score=CH, keys=[], light=[7]), F(score=CH, keys=[], light=[8], cue="C,"), F(score=CH, keys=[], light=[7], cue="B6")],
  [F(score=CH, keys=[], light=[5], cue="G♯m7"), F(score=CH, keys=[], light=[6], cue="Am7"),
   F(score=CH, keys=[], light=[7], cue="B6"), F(score=CH, keys=[], light=[8], cue="C6.")],
  [F(score=CD, keys=[], play=False)],
  [F(score=CD, keys=[], light=[1])],
  [F(score=CD, keys=[], light=[3]), F(score=CD, keys=[], light=[4], cue="G"), F(score=CD, keys=[], light=[3], cue="higher")],
  [F(score=CD, keys=[], light=[4]), F(score=CD, keys=[], light=[3], cue="B♭m7"), F(score=CD, keys=[], light=[4], cue="place")],
  [F(score=CD, keys=[], light=[5]), F(score=CD, keys=[], light=[6], cue="E,"), F(score=CD, keys=[], light=[5], cue="higher")],
  [F(score=CD, keys=[], light=[6]), F(score=CD, keys=[], light=[5], cue="B♭m7")],
  # 55-63 2 5 1 passing tones
  [F(title="2 5 1 passing tones")],
  [F(title="2 5 1 passing tones", sub="Harmonise passing tones with the chords of a major 2 5 1.")],
  [F(words=[]), F(words=["2 5 1 chords"], cue="2"), F(score=ex("detail-two-five-one-cadence"), keys=[], cue="Dm7")],
  [F(score=line(*[blk(C6[n], "C6" if n == "C" else None, dur=2) for n in "CEG"]), keys=keys_of(["C4", "E4", "G4"], "chord"))],
  [F(score=ex("detail-two-five-one-voicings"), keys=[], play=False), F(score=ex("detail-two-five-one-voicings"), keys=[], light=[0], cue="D"),
   F(score=ex("detail-two-five-one-voicings"), keys=[], light=[1], cue="F"), F(score=ex("detail-two-five-one-voicings"), keys=[], light=[3], cue="B")],
  [F(score=ex("detail-two-five-one-voicings"), keys=[], light=[2], cue="A,")],
  [F(score=ex("detail-two-five-one-cadence"), reveal=1, keys=keys_of(["A4", "B4", "C5"], "passing"), cue="last"),
   F(score=ex("detail-two-five-one-cadence"), keys=keys_of(["A4", "B4", "C5"], "passing"), cue="complete")],
  [F(words=[]), F(words=["chromatic passing tones"], cue="chromatic"),
   F(words=["chromatic passing tones", "approach Dm7"], cue="approach"),
   F(score=ex("detail-two-five-one-chromatic"), keys=keys_block(CSM7), cue="new")],
  [F(words=["coming down"]), F(words=["coming down", "G♯/A♭"], cue="G♯/A♭"),
   F(score=bars(blk(BBM7_AB, "Bbm7/Ab")), keys=keys_block(BBM7_AB), cue="same")],
]
# The article's examples and exercises play after these sentence indices, in page order.
# (The basic shape and the block from below aren't replayed: their build-ups play each bar as it
# appears.) Detail examples that the sentences already show bar by bar are not replayed either.
EXAMPLES_AFTER = {6: ["c6-positions"], 10: ["sixth-diminished-scale"],
                  13: ["scale-chord-tones", "exercise-scale-chord-tones"], 19: ["diminished"],
                  21: ["detail-g7b9-c6"], 23: ["exercise-diminished"], 33: ["rootless-major-ninth"],
                  39: ["dominant-seventh"], 40: ["exercise-diatonic"], 48: ["chromatic"],
                  54: ["chromatic-descending", "exercise-chromatic"],
                  61: ["detail-two-five-one-cadence"], 62: ["two-five-one"],
                  63: ["two-five-one-descending", "exercise-two-five-one"]}
# The video's own wording for sentences that spell a chord out note by note: on screen the score
# and keyboard already show the notes, so the narration names the chord and moves on. These are
# recorded separately (scripts/video/narrate-spoken.py); every other sentence is cut from the
# article's narration.
SPOKEN = {
  0: "Piano Block Chords. Four ways to harmonise the major scale.",
  9: "In C, it's the C major scale with an extra semitone between G and A.",
  16: "The C major sixth-diminished scale is composed of chord tones matching C6 and non-chord tones (D, F, G♯ or A♭ and B).",
  22: "Quick note: a diminished seventh chord is built from equal minor thirds, so the same four notes can be named as four different diminished chords: D°7, F°7, A♭°7 or B°7, depending on which note you treat as the root.",
  31: "Drop the root from Cmaj9 and you're left with the rootless voicing.",
  32: "That shape contains both D and B, so use it for those two passing tones, with the melody doubled in the left hand as usual.",
  36: "So it takes a plain dominant seventh instead: G7, with F on top and doubled in the left hand.",
  45: "With A in the melody, the C6 voicing can just as well be read as Am7.",
  46: "G♯ leads to A, so it takes that voicing a half step lower: a G♯m7.",
  47: "B leads to C, so it takes the C6 voicing a half step lower: a B6.",
  50: "B no longer leads to a note a half step away, so it falls back to the rootless Cmaj9 voicing.",
  52: "G is voiced as C6 over its fifth, which you can read as Am7 over G; a half step up, that becomes a B♭m7 over A♭, which slides down into place.",
  54: "E is voiced as C6 over its third, or Am7 over E; a half step up, that becomes a B♭m7 over F.",
  63: "Coming down the scale, the G♯/A♭ chromatic passing tone keeps the same chord as in the example we saw before.",
}
SECTIONS = {0: "Introduction", 7: "The sixth-diminished scale", 14: "Diminished passing tones",
            24: "Diatonic passing tones", 29: "Rootless major ninth voicing",
            34: "Dominant seventh voicing", 41: "Chromatic passing tones", 55: "2 5 1 passing tones"}

# ---- rendering -------------------------------------------------------------------------------
_scores = {}
# The article's own example images paint the passing tones blue, which is also the colour of a
# chord sounding in playback, so the two would cancel out. In the video they are black, except
# where the passing tones are what the example is about: there they take the explanation's orange.
EXPLAIN = "#E8590C"
PASSING_EXPLAINED = {"rootless-major-ninth"}
def article_svg(name):
    svg = open(os.path.join(ROOT, f"src/assets/articles/block-chords/{name}.svg")).read()
    return re.sub(r"#2563eb", EXPLAIN if name in PASSING_EXPLAINED else "#000000", svg, flags=re.I)

def render_score(measures, path):
    low = [n for m in measures for c in m for n in c[3] if int(n[-1]) <= 2]
    source = bc.build("", measures, bass=bool(low))
    if source in _scores: return _scores[source]
    xml = path + ".musicxml"
    open(xml, "w").write(source)
    # The article's detail style for short snippets: natural spacing, never stretched to the page
    # width, so a few chords fill the frame at a readable size.
    # Runs of eighth notes keep MuseScore's default spacing, which gives their chord symbols room.
    eighths = any(c[0] < 2 for m in measures for c in m)
    style = [] if eighths else ["-S", os.path.join(ROOT, "scripts/sheet-music/detail.mss")]
    subprocess.run([bc.MSCORE, *style, "-o", path + ".svg", "-T", "10", xml], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    os.replace(path + "-1.svg", path + ".svg")
    _scores[source] = open(path + ".svg").read()
    return _scores[source]

# Every keyboard in the video spans the same keys, A3 to D6 (all the voicings plus a white key
# either side), so it can stay on screen between sentences and only its colours change.
KEY_RANGE = ("A3", "D6")
_keyboard = {}
def render_keys(spec, path, lenient=False):
    """The keyboard from piano-chord-charts, drawn once without highlights over KEY_RANGE, then
    coloured key by key by exact pitch. (The CLI's own --highlightKeys matches note names without
    octaves, left to right, so with a fixed range a lone C5 would light the first C on the board.)"""
    lo, hi = midi(KEY_RANGE[0]), midi(KEY_RANGE[1])
    if lenient: spec = [(n, role) for n, role in spec if lo <= midi(n) <= hi]
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

def play_keys(rh, lh):
    """The keyboard while one chord sounds: right hand and left hand in their playing colours.
    (Notes beyond the keyboard's range, like the G7♭9 example's low bass, are left off.)"""
    return render_keys([(n, "rh_play") for n in rh] + [(n, "lh_play") for n in lh], "", lenient=True)

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
    render_keys([], os.path.join(out, "k-blank"))     # draws the keyboard once, before any playback copy
    text = sentences(os.path.join(ROOT, "src/articles/block-chords/index.html"))
    if len(text) != len(ROWS):
        raise SystemExit(f"{len(text)} sentences but {len(ROWS)} storyboard rows; update ROWS")
    board = []
    page = open(os.path.join(ROOT, "src/articles/block-chords/index.html"), encoding="utf-8").read()
    clean = lambda t: " ".join(re.sub(r"<[^>]+>", "", t).split())
    exercises = [(clean(t), k) for t, k in re.findall(
        r'<summary>(.*?)</summary>.*?block-chords/([a-z0-9-]+)\.svg', page, re.S)]
    def caption(ex):
        m = re.search(rf'{re.escape(ex)}\.svg".*?<figcaption>(.*?)</figcaption>', page, re.S)
        n = next((i for i, (_, k) in enumerate(exercises, 1) if k == ex), None)
        if n is None: return clean(m[1])
        title = re.sub(r"^Exercise\s*", "", exercises[n - 1][0])
        return f"Exercise {n}: {title[0].upper() + title[1:]}. {clean(m[1])}"
    shown = (None, 0)  # the score on screen and how many of its bars are showing
    for i, ((sentence, block, w0, w1), frames) in enumerate(zip(text, ROWS)):
        row = {"n": i, "section": SECTIONS.get(i), "text": sentence, "block": block, "w0": w0, "w1": w1, "frames": []}
        if i in SPOKEN:
            row["text"] = SPOKEN[i]
            row["spoken"] = hashlib.sha1(SPOKEN[i].encode()).hexdigest()[:12]
        for j, f in enumerate(frames):
            fr = {k: f[k] for k in ("title", "sub", "cue", "example", "photos", "reveal", "words", "mark", "light") if k in f}
            if "score" in f and not f.get("colour"):
                f = {**f, "score": bc.unhighlight(f["score"])}
            if "score" in f:
                fr["score"] = render_score(f["score"], os.path.join(out, f"s{i:02d}-{j}"))
                # Every score shown is played, over the narration: a new score from its first bar,
                # a score that reveals more bars only the bars it adds. The same score left on
                # screen (only the keyboard or the subtitle changes) isn't played again.
                upto = f["reveal"] if "reveal" in f else len(f["score"])
                # (Compared by notes, so the same bars recoloured aren't played again.)
                notes = json.dumps([[[c[0], c[2], c[3]] for c in m] for m in f["score"]])
                first = shown[1] if shown[0] == notes else 0
                if "light" in f:
                    # Nothing plays: the chords the sentence names light up, on the keyboard too.
                    fr["chords"] = [len(m) for m in f["score"]]
                    chords = [c for m in f["score"] for c in m]
                    if f.get("keys") == []:
                        rh, lh = [], []
                        for e in f["light"]:
                            k, which = (e, None) if isinstance(e, int) else e
                            c = chords[k]
                            if which is None or which == "rh": rh += c[2]
                            if which is None: lh += c[3]
                            if isinstance(which, list):
                                both = c[2] + c[3]
                                rh += [both[i] for i in which if i < len(c[2])]
                                lh += [both[i] for i in which if i >= len(c[2])]
                        # In the explanation's tint, both hands: the playback colours mean "sounding".
                        fr["lit_keys"] = render_keys([(n, "lit") for n in rh + lh], "", lenient=True)
                elif upto > first and f.get("play", True):
                    fr["music"] = [[[c[0], c[2], c[3]] for c in m] for m in f["score"][first:upto]]
                    fr["music_id"] = hashlib.sha1(json.dumps(fr["music"]).encode()).hexdigest()[:12]
                    fr["music_from"] = first
                    # The keyboard follows the playing: blank, with each chord lit while it sounds.
                    # (A build-up keeps its keyboard in the colours of the score's labels.)
                    if "keys" in f and ("reveal" not in f or f.get("follow")):
                        f = {**f, "keys": []}
                        fr["play_keys"] = [play_keys(c[1], c[2]) for m in fr["music"] for c in m]
                shown = (notes, upto)
            else:
                shown = (None, 0)
            if "keys" in f:
                fr["keys"] = render_keys(f["keys"], os.path.join(out, f"k{i:02d}-{j}"))
            if "example" in f:
                fr["score"] = article_svg(f["example"])
            row["frames"].append(fr)
        board.append(row)
        if EXAMPLES_AFTER.get(i): shown = (None, 0)
        for ex in EXAMPLES_AFTER.get(i, []):
            board.append({"example": ex, "caption": caption(ex), "frames": [{"score": article_svg(ex), "keys": render_keys([], ""),
                "play_keys": [play_keys(c[2], c[3]) for m in bc.E[ex][1] for c in m]}]})
        print(f"{i:2d} {len(frames)} frame(s)  {sentence[:60]}")
    json.dump(board, open(os.path.join(out, "storyboard.json"), "w"))

if __name__ == "__main__":
    main(sys.argv[1])
