#!/usr/bin/env python3
"""Record the video's own sentences (storyboard SPOKEN) with the article's narration voice.

    python3 scripts/video/narrate-spoken.py <storyboard.json> <audio-dir>

Writes <audio-dir>/spoken/<id>.mp3 and <id>.json ({duration, words: [[start, end], ...]}), the same
shape as one entry of the article's narration.json, so make-video.mjs cuts and cues them alike.
Recordings that already exist are kept. Needs the Kokoro environment narrate.py uses.
"""
import importlib.util, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("nar", os.path.join(HERE, "../narration/narrate.py"))
nar = importlib.util.module_from_spec(spec); spec.loader.exec_module(nar)

def main(board_file, audio_dir):
    import soundfile as sf
    out = os.path.join(audio_dir, "spoken"); os.makedirs(out, exist_ok=True)
    pipe = None
    for row in json.load(open(board_file)):
        if "spoken" not in row: continue
        base = os.path.join(out, row["spoken"])
        if os.path.exists(base + ".json"): continue
        pipe = pipe or nar.load_pipeline()
        words = row["text"].split(" ")
        audio, tokens = nar.synth(pipe, " ".join(nar.speak_word(w) for w in words))
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, audio, nar.RATE)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav.name, "-b:a", "64k", base + ".mp3"], check=True)
        json.dump({"duration": round(len(audio) / nar.RATE, 3), "words": nar.align(words, tokens)}, open(base + ".json", "w"))
        print(f"{row['n']:2d} {len(audio) / nar.RATE:5.1f}s  {row['text'][:60]}")

if __name__ == "__main__":
    main(*sys.argv[1:3])
