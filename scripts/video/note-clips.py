#!/usr/bin/env python3
"""Spoken note names for the video's chord spellings ("D–E–G–B–D"), one clip per note, in the
narration's voice. The video places each on a beat of the drums, so leading and trailing
silence is trimmed: the note starts the moment its clip does.

Run with the Kokoro environment (see scripts/narration/narrate.py):
    .venv-tts/bin/python scripts/video/note-clips.py <storyboard.json> <audio-dir>
Writes <audio-dir>/notes/<note>.wav, e.g. Eb.wav, "F#.wav".
"""
import importlib.util, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("nar", os.path.join(HERE, "..", "narration", "narrate.py"))
nar = importlib.util.module_from_spec(spec); spec.loader.exec_module(nar)

MAX_LEN = 0.56
SPELLING = re.compile(r"^[A-G][♭♯]?(?:–[A-G][♭♯]?)+$")

def spellings(text):
    """The dash-joined note spellings in a sentence, e.g. ["D–E–G–B–D"]."""
    return [core for w in text.split(" ") if SPELLING.match(core := w.strip("().,;:"))]

def ascii_name(n): return n.replace("♭", "b").replace("♯", "#")

if __name__ == "__main__":
    board, out = json.load(open(sys.argv[1])), os.path.join(sys.argv[2], "notes")
    os.makedirs(out, exist_ok=True)
    notes = sorted({n for r in board if "text" in r for s in spellings(r["text"]) for n in s.split("–")})
    pipe = nar.load_pipeline()
    import soundfile as sf
    for n in notes:
        audio, _ = nar.synth(pipe, nar.speak_chord(n) + ".")
        with tempfile.NamedTemporaryFile(suffix=".wav") as raw:
            sf.write(raw.name, audio, nar.RATE)
            # trim silence at both ends (reverse, trim the start, reverse back, trim the start)
            trim = "silenceremove=start_periods=1:start_threshold=-45dB"
            dest = os.path.join(out, ascii_name(n) + ".wav")
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw.name, "-af",
                            f"{trim},areverse,{trim},areverse", dest], check=True)
        # A note has one beat (0.652 s at 92 BPM): speed up any name longer than MAX_LEN to fit,
        # leaving a little air before the next note.
        length = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                                "-of", "csv=p=0", dest]))
        if length > MAX_LEN:
            fitted = dest + ".tmp.wav"
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", dest, "-af", f"atempo={length / MAX_LEN:.4f}",
                            fitted], check=True)
            os.replace(fitted, dest)
    print(f"{len(notes)} note clips: {' '.join(notes)}")
