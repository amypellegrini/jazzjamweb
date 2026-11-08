#!/usr/bin/env python3
"""Audio for the video, made the way the JazzJam app makes it.

1. Drums: the drum track of a backing track rendered by the app's engine
   (musicpracticepro `npm run render -- ... --audio none`), with the count-in removed, played
   through FluidSynth and the app's soundfont with the app's settings.
2. Piano examples: the article's examples as MIDI with the engine's swing (each beat's eighths
   warped to 2/3 + 1/3, `swingTime` in musicpracticepro/pipeline/notesToMidiData.ts), on the
   engine's piano channel, program and velocity, through the same soundfont. Also writes each
   example's swung chord timings for the on-screen highlighting.

3. The storyboard's scores, played over the narration as they appear: each frame's newly shown
   bars, swung, same piano.

    python3 scripts/video/audio.py <engine.mid> <musicpracticepro dir> <out-dir> [storyboard.json]
Writes <out-dir>/drums.wav, <out-dir>/<example>.wav, <out-dir>/<example>.events.json and
<out-dir>/music/<music_id>.wav, one per storyboard score (storyboard.json names each).
"""
import importlib.util, json, os, struct, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
spec = importlib.util.spec_from_file_location("bc", os.path.join(ROOT, "scripts/sheet-music/block-chords.py"))
bc = importlib.util.module_from_spec(spec); spec.loader.exec_module(bc)

# The engine's constants (musicpracticepro pipeline/notesToMidiData.ts, prependPreCount.ts,
# render/audioRenderCommands.ts).
TPQ, PIANO_CHANNEL, PIANO_PROGRAM, PIANO_VELOCITY, DRUMS_CHANNEL = 480, 2, 0, 80, 9
PRE_COUNT_BEATS, GAIN, RATE = 8, 0.7, 44100
SOUNDFONT = "android/app/src/main/assets/MS_Basic.sf3"

def swing_time(ticks):
    beat, pos = divmod(ticks, TPQ)
    f = pos / TPQ
    f = f * 4 / 3 if f <= 0.5 else 2 / 3 + (f - 0.5) * 2 / 3
    return round(beat * TPQ + f * TPQ)

# ---- minimal Standard MIDI File reading/writing ------------------------------------------------
def vlq(n):
    out = [n & 0x7F]
    while n > 0x7F:
        n >>= 7; out.append((n & 0x7F) | 0x80)
    return bytes(reversed(out))

def read_vlq(b, i):
    n = 0
    while True:
        c = b[i]; i += 1; n = (n << 7) | (c & 0x7F)
        if not c & 0x80: return n, i

def chunks(data):
    i = 0
    while i < len(data):
        kind, size = data[i:i + 4], struct.unpack(">I", data[i + 4:i + 8])[0]
        yield kind, data[i + 8:i + 8 + size]; i += 8 + size

def track_channels(track):
    """The set of MIDI channels a track's channel events use."""
    chans, i, status = set(), 0, None
    while i < len(track):
        _, i = read_vlq(track, i)
        if track[i] & 0x80: status = track[i]; i += 1
        if status == 0xFF:
            i += 1; n, i = read_vlq(track, i); i += n
        elif status in (0xF0, 0xF7):
            n, i = read_vlq(track, i); i += n
        else:
            chans.add(status & 0x0F)
            i += 1 if status >> 4 in (0xC, 0xD) else 2
    return chans

def smf(tracks):
    head = b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), TPQ)
    return head + b"".join(b"MTrk" + struct.pack(">I", len(t)) + t for t in tracks)

def fluidsynth(mid, wav, mpp):
    subprocess.run(["fluidsynth", "-ni", "-g", str(GAIN), "-r", str(RATE), "-O", "s16", "-T", "wav",
                    "-F", wav, os.path.join(mpp, SOUNDFONT), mid], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

# ---- drums -------------------------------------------------------------------------------------
def drums(engine_mid, mpp, out):
    parts = list(chunks(open(engine_mid, "rb").read()))
    tracks = [body for kind, body in parts if kind == b"MTrk"]
    meta = [t for t in tracks if not track_channels(t)]           # tempo / time signature
    drum = [t for t in tracks if track_channels(t) == {DRUMS_CHANNEL}]
    if len(drum) != 1: raise SystemExit(f"expected one drum track, found {len(drum)}")
    mid = os.path.join(out, "drums.mid")
    open(mid, "wb").write(smf(meta + drum))
    full = os.path.join(out, "drums-full.wav")
    fluidsynth(mid, full, mpp)
    bpm = tempo_of(meta[0])
    count_in = PRE_COUNT_BEATS * 60 / bpm
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", full, "-ss", f"{count_in:.6f}",
                    os.path.join(out, "drums.wav")], check=True)
    return bpm

def tempo_of(track):
    i = track.find(b"\xFF\x51\x03")
    return 60e6 / int.from_bytes(track[i + 3:i + 6], "big")

# ---- piano ------------------------------------------------------------------------------------
def swung(chords, bpm, mpp, mid, wav):
    """Chords as (eighths, notes), one after another, swung like the engine and played on its
    piano through the app's soundfont. Returns each chord's (start, end) in seconds."""
    eighth = TPQ // 2
    on_off, spans, t = [], [], 0
    for dur, notes in chords:
        start, end = swing_time(t), swing_time(t + dur * eighth)
        for n in notes:
            on_off.append((start, 1, bc_midi(n))); on_off.append((end, 0, bc_midi(n)))
        spans.append((start / TPQ * 60 / bpm, end / TPQ * 60 / bpm))
        t += dur * eighth
    on_off.sort(key=lambda e: (e[0], e[1]))  # note-offs before note-ons at the same tick
    track, last = bytearray(), 0
    track += vlq(0) + bytes([0xFF, 0x51, 0x03]) + round(60e6 / bpm).to_bytes(3, "big")
    track += vlq(0) + bytes([0xC0 | PIANO_CHANNEL, PIANO_PROGRAM])
    for tick, kind, note in on_off:
        track += vlq(tick - last) + bytes([(0x90 if kind else 0x80) | PIANO_CHANNEL, note, PIANO_VELOCITY if kind else 0])
        last = tick
    track += vlq(0) + b"\xFF\x2F\x00"
    open(mid, "wb").write(smf([bytes(track)]))
    fluidsynth(mid, wav, mpp)
    return spans

def example(name, measures, bpm, mpp, out):
    """An article example, plus its chord timings (with the notation's x positions) for highlighting."""
    spans = swung([(c[0], c[2] + c[3]) for m in measures for c in m], bpm, mpp,
                  os.path.join(out, f"{name}.mid"), os.path.join(out, f"{name}.wav"))
    xs = json.load(open(os.path.join(ROOT, f"src/assets/articles/block-chords/{name}.cursor.json")))
    events = [{"t": round(a, 3), "end": round(b, 3), "x": x["x"], "top": x.get("top", 0), "bottom": x.get("bottom", 100)} for (a, b), x in zip(spans, xs)]
    json.dump(events, open(os.path.join(out, f"{name}.events.json"), "w"))

STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def bc_midi(n):
    import re
    m = re.fullmatch(r"([A-G])(bb|b|#)?(-?\d)", n)
    return STEP[m[1]] + {"bb": -2, "b": -1, "#": 1, None: 0}[m[2]] + 12 * (int(m[3]) + 1)

if __name__ == "__main__":
    engine_mid, mpp, out = sys.argv[1:4]
    os.makedirs(out, exist_ok=True)
    bpm = drums(engine_mid, mpp, out)
    if round(bpm) != bc.BPM:
        raise SystemExit(f"engine render is {bpm:.1f} BPM but the examples are {bc.BPM}; re-render at --tempo {bc.BPM}")
    for name, (_, measures) in bc.E.items():
        example(name, measures, bc.BPM, mpp, out)
    if len(sys.argv) > 4:
        music = {f["music_id"]: f["music"] for r in json.load(open(sys.argv[4]))
                 for f in r.get("frames", []) if f.get("music")}
        os.makedirs(os.path.join(out, "music"), exist_ok=True)
        for k, m in music.items():
            spans = swung([(c[0], c[1] + c[2]) for bar in m for c in bar], bc.BPM, mpp,
                          os.path.join(out, "music", k + ".mid"), os.path.join(out, "music", k + ".wav"))
            json.dump([{"t": round(a, 3), "end": round(b, 3)} for a, b in spans],
                      open(os.path.join(out, "music", k + ".events.json"), "w"))
        print(f"{len(music)} storyboard scores")
    print(f"drums + {len(bc.E)} swung piano examples at {bc.BPM} BPM -> {out}")
