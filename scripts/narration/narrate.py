#!/usr/bin/env python3
"""Pre-record an article's narration with Kokoro TTS (Apache-2.0), plus per-word timings.

Narrates every <h1>, <h2>, <h3>, <aside> and direct <p> child of the page's <article>, in document
order: block i becomes narration/<i>.mp3, and narration/narration.json holds, per block, the
start/end time of each whitespace-separated word as displayed on the page. The page's
read-along script walks the same elements in the same order and highlights word by word.

Chord and note names are rewritten into speakable form (A♭m7 -> "A flat minor seven") only in
what is spoken; the timings are mapped back onto the displayed words.

Setup (one-off; Kokoro needs Python <= 3.12, and its bundled espeak-ng data is broken on
macOS, so it uses Homebrew's):
    brew install espeak-ng ffmpeg
    uv venv --python 3.12 .venv-tts && uv pip install --python .venv-tts/bin/python kokoro soundfile
Run:
    .venv-tts/bin/python scripts/narration/narrate.py src/articles/block-chords/index.html \
        src/assets/articles/block-chords/narration
"""
import hashlib, json, os, re, subprocess, sys, tempfile
from html.parser import HTMLParser

# espeak-ng: ESPEAK_LIB/ESPEAK_DATA override; otherwise Homebrew's on macOS, the distro's on Linux.
def _first(*paths): return next((p for p in paths if os.path.exists(p)), paths[0])
ESPEAK_LIB = os.environ.get("ESPEAK_LIB") or _first(
    "/opt/homebrew/lib/libespeak-ng.dylib", "/usr/lib/x86_64-linux-gnu/libespeak-ng.so.1",
    "/usr/lib/aarch64-linux-gnu/libespeak-ng.so.1")
ESPEAK_DATA = os.environ.get("ESPEAK_DATA") or _first(
    "/opt/homebrew/share/espeak-ng-data", "/usr/lib/x86_64-linux-gnu/espeak-ng-data",
    "/usr/lib/aarch64-linux-gnu/espeak-ng-data", "/usr/share/espeak-ng-data")
VOICE, LANG, RATE = "bf_emma", "b", 24000

# ---- what gets narrated --------------------------------------------------------------------

class Blocks(HTMLParser):
    """Collect the text of article > h1/h2/h3/p/aside, in order (figures, even inside a note, are skipped)."""
    def __init__(self):
        super().__init__(); self.depth = None; self.stack = []; self.blocks = []; self.buf = None
    def handle_starttag(self, tag, attrs):
        parent = self.stack[-1] if self.stack else None
        self.stack.append(tag)
        if self.buf is None and parent == "article" and tag in ("h1", "h2", "h3", "p", "aside"):
            self.buf, self.depth = [], len(self.stack)
    def handle_endtag(self, tag):
        if self.buf is not None and len(self.stack) == self.depth:
            self.blocks.append(" ".join("".join(self.buf).split())); self.buf = None
        if self.stack: self.stack.pop()
    def handle_data(self, data):
        # An example inside a block (a note holding a figure) is not part of the narration.
        if self.buf is not None and "figure" not in self.stack: self.buf.append(data)

# ---- how it is spoken ----------------------------------------------------------------------

ACC = {"♭": " flat", "♯": " sharp", "": ""}
QUALITY = {"": "", "6": " six", "7": " seven", "m7": " minor seven", "maj7": " major seven",
           "maj9": " major nine", "°7": " diminished seven", "7♭9": " seven flat nine"}
CHORD = re.compile(r"([A-G])([♭♯]?)(" + "|".join(sorted(map(re.escape, QUALITY), key=len, reverse=True)) + r")")

def speak_chord(core):
    m = CHORD.fullmatch(core)
    if not m: return None
    letter, acc, q = m.groups()
    # Kokoro reads a lone "A" as the article; force the letter name (misaki phoneme "A" = eɪ).
    name = "[A](/ˈA/)" if letter == "A" else letter
    return name + ACC[acc] + QUALITY[q]

def speak_word(word):
    """Display word -> spoken text, keeping surrounding punctuation for prosody."""
    lead, core, trail = re.fullmatch(r"([(\[]*)(.*?)([).,;:!?\]]*)", word).groups()
    for sep, joiner in (("–", ", "), ("/", " or ")):
        if sep in core:
            parts = [speak_chord(p) for p in core.split(sep)]
            if all(parts): return lead + joiner.join(parts) + trail
    spoken = speak_chord(core)
    return lead + (spoken if spoken else core) + trail

def letters(s):
    s = re.sub(r"\[([^\]]*)\]\(/[^)]*/\)", r"\1", s)  # phoneme markup -> its text
    return re.sub(r"[^0-9a-z]", "", s.lower())

# ---- synthesis + alignment -----------------------------------------------------------------

def load_pipeline():
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    import espeakng_loader
    espeakng_loader.get_library_path = lambda: ESPEAK_LIB
    espeakng_loader.get_data_path = lambda: ESPEAK_DATA
    EspeakWrapper.set_library(ESPEAK_LIB); EspeakWrapper.set_data_path(ESPEAK_DATA)
    from kokoro import KPipeline
    return KPipeline(lang_code=LANG)

def synth(pipe, text):
    import numpy as np
    audio, tokens, offset = [], [], 0.0
    for r in pipe(text, voice=VOICE, speed=1.0):
        a = r.audio.numpy()
        for t in r.tokens or []:
            s = None if t.start_ts is None else offset + t.start_ts
            e = None if t.end_ts is None else offset + t.end_ts
            tokens.append((t.text, s, e))
        audio.append(a); offset += len(a) / RATE
    return np.concatenate(audio), tokens

def align(display_words, tokens):
    """Greedy: each display word consumes Kokoro tokens until their letters cover its spoken form."""
    timings, i = [], 0
    for w in display_words:
        target, got, span = letters(speak_word(w)), "", []
        while i < len(tokens) and (len(got) < len(target) or not target):
            text, s, e = tokens[i]; i += 1
            got += letters(text); span.append((s, e))
            if not target: break
        if got != target:
            print(f"  ! alignment drift at {w!r}: spoken {target!r}, tokens {got!r}", file=sys.stderr)
        starts = [s for s, _ in span if s is not None]; ends = [e for _, e in span if e is not None]
        timings.append([round(min(starts), 3), round(max(ends), 3)] if starts and ends else None)
    # Fill any word Kokoro left untimed from its neighbours.
    for j, t in enumerate(timings):
        if t is None:
            prev = next((x[1] for x in reversed(timings[:j]) if x), 0.0)
            nxt = next((x[0] for x in timings[j + 1:] if x), prev)
            timings[j] = [prev, nxt]
    return timings

def main(html_path, out_dir):
    import soundfile as sf
    parser = Blocks(); parser.feed(open(html_path, encoding="utf-8").read())
    os.makedirs(out_dir, exist_ok=True)
    # Reuse the recording of any block whose text hasn't changed (matched by hash, so it survives
    # blocks being added, removed or reordered). FORCE=1 re-records everything.
    previous = {}
    manifest_path = os.path.join(out_dir, "narration.json")
    if os.path.exists(manifest_path) and not os.environ.get("FORCE"):
        for n, entry in enumerate(json.load(open(manifest_path))):
            mp3 = os.path.join(out_dir, f"{n}.mp3")
            if os.path.exists(mp3): previous[entry["hash"]] = (entry, open(mp3, "rb").read())
    pipe = None
    manifest = []
    for n, text in enumerate(parser.blocks):
        words = text.split(" ")
        digest = hashlib.sha1(text.encode()).hexdigest()[:12]
        if digest in previous:
            entry, mp3 = previous[digest]
            open(os.path.join(out_dir, f"{n}.mp3"), "wb").write(mp3)
            manifest.append(entry)
            print(f"{n:2d}  kept  {text[:60]}")
            continue
        pipe = pipe or load_pipeline()
        audio, tokens = synth(pipe, " ".join(speak_word(w) for w in words))
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, audio, RATE)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav.name, "-b:a", "64k",
                            os.path.join(out_dir, f"{n}.mp3")], check=True)
        manifest.append({"hash": digest,
                         "duration": round(len(audio) / RATE, 3), "words": align(words, tokens)})
        print(f"{n:2d} {len(audio) / RATE:5.1f}s  {text[:60]}")
    # Drop recordings left over from blocks that no longer exist.
    n = len(manifest)
    while os.path.exists(os.path.join(out_dir, f"{n}.mp3")):
        os.remove(os.path.join(out_dir, f"{n}.mp3")); n += 1
    json.dump(manifest, open(manifest_path, "w"), separators=(",", ":"))

if __name__ == "__main__":
    main(*sys.argv[1:3])
