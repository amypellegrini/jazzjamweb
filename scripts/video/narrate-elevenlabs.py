#!/usr/bin/env python3
"""Record the video's narration with an ElevenLabs voice, one file per sentence.

    python3 scripts/video/narrate-elevenlabs.py <storyboard.json> <out-dir> --voice <name or id> [--rows 1,4,32]
    python3 scripts/video/narrate-elevenlabs.py --find <name>          # look a voice up in the library

Writes <out-dir>/<id>.mp3 and <id>.json ({duration, words: [[start, end], ...]}) per sentence, where
<id> is the first 12 hex digits of the sentence text's SHA-1 (the shape make-video.mjs reads; point it
at the folder with NARRATION=<out-dir>). A sentence already recorded is kept, so a re-run only pays
for changed text. Chord names are spoken with the article's rules (narrate.py's speak_word), and each
request carries the sentences either side, so the intonation runs on across the cuts.

The API key comes from ELEVENLABS_API_KEY, or else from the repo's gitignored .env.local, where
`npx -y @elevenlabs/cli@latest onboard init` stores it. It is never printed or written anywhere.
"""
import argparse, base64, hashlib, importlib.util, json, os, re, subprocess, sys, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("nar", os.path.join(HERE, "../narration/narrate.py"))
nar = importlib.util.module_from_spec(spec); spec.loader.exec_module(nar)

API = "https://api.elevenlabs.io"
MODEL = "eleven_v4"

def key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    env = os.path.join(HERE, "../../.env.local")
    if not k and os.path.exists(env):
        for line in open(env):
            name, _, value = line.strip().partition("=")
            if name == "ELEVENLABS_API_KEY": k = value.strip().strip("'\"")
    if not k: sys.exit("no ElevenLabs key: run `npx -y @elevenlabs/cli@latest onboard init` in the repo root")
    return k

def call(path, body=None, query=None):
    url = API + path + ("?" + urllib.parse.urlencode(query) if query else "")
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"xi-api-key": key(), "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        sys.exit(f"{e.code} {path}: {e.read().decode()[:400]}")

def find(name):
    """The account's own voices first, then the shared library."""
    mine = [v for v in call("/v1/voices")["voices"] if v["name"].lower().startswith(name.lower())]
    lib = call("/v1/shared-voices", query={"search": name, "language": "en", "page_size": 30})["voices"]
    return mine, lib

def resolve(voice):
    if len(voice) >= 20 and voice.isalnum(): return voice
    mine, lib = find(voice)
    if mine: return mine[0]["voice_id"]
    british = [v for v in lib if v["name"].lower().startswith(voice.lower()) and v.get("accent") == "british"]
    if not british: sys.exit(f"no British voice called {voice!r}; try --find {voice}")
    return british[0]["voice_id"]           # a library voice speaks by id, without adding it to the account

def speak(word):
    """narrate.py's spoken form, minus Kokoro's phoneme markup for the letter A (ElevenLabs reads
    the markup itself and drops or mumbles the A), with each accidental hyphenated to its letter
    ("A-flat"), so the letter is said as a note name, not as the article."""
    s = nar.speak_word(word).replace("[A](/ˈA/)", "A")
    return re.sub(r"\b([A-G]) (flat|sharp)\b", r"\1-\2", s)

def record(voice_id, text, before, after, base):
    words = text.split(" ")
    spoken = [speak(w) for w in words]
    line = " ".join(spoken)
    body = {"text": line, "model_id": MODEL, "language_code": "en"}
    if before: body["previous_text"] = " ".join(speak(w) for w in before.split(" "))
    if after: body["next_text"] = " ".join(speak(w) for w in after.split(" "))
    r = call(f"/v1/text-to-speech/{voice_id}/with-timestamps", body, {"output_format": "mp3_44100_128"})
    open(base + ".mp3", "wb").write(base64.b64decode(r["audio_base64"]))
    a = r["alignment"]
    if "".join(a["characters"]) != line:
        sys.exit(f"alignment text differs from the request for {text[:40]!r}")
    starts, ends = a["character_start_times_seconds"], a["character_end_times_seconds"]
    timings, at = [], 0
    for s in spoken:                          # each display word spans the characters of its spoken form
        lo, hi = at, at + max(len(s), 1) - 1
        timings.append([round(starts[lo], 3), round(ends[hi], 3)])
        at += len(s) + 1
    duration = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                     base + ".mp3"], capture_output=True, text=True).stdout)
    json.dump({"duration": round(duration, 3), "words": timings}, open(base + ".json", "w"))
    return duration

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("board", nargs="?"); ap.add_argument("out", nargs="?")
    ap.add_argument("--voice"); ap.add_argument("--rows"); ap.add_argument("--find")
    ap.add_argument("--force", action="store_true", help="re-record the --rows even if recorded")
    o = ap.parse_args()
    if o.find:
        mine, lib = find(o.find)
        for v in mine: print(f"mine     {v['voice_id']}  {v['name']}")
        for v in lib: print(f"library  {v['voice_id']}  {v['name']}  ({v.get('accent')}, {v.get('gender')}, {v.get('age')})  {v.get('description', '')[:60]}")
        return
    rows = [r for r in json.load(open(o.board)) if "text" in r]
    pick = {int(n) for n in o.rows.split(",")} if o.rows else None
    voice_id = resolve(o.voice)
    os.makedirs(o.out, exist_ok=True)
    for i, r in enumerate(rows):
        if pick is not None and r["n"] not in pick: continue
        base = os.path.join(o.out, hashlib.sha1(r["text"].encode()).hexdigest()[:12])
        if os.path.exists(base + ".json") and not o.force: continue
        before = rows[i - 1]["text"] if i > 0 else ""
        after = rows[i + 1]["text"] if i + 1 < len(rows) else ""
        print(f"{r['n']:2d} {record(voice_id, r['text'], before, after, base):5.1f}s  {r['text'][:60]}")

if __name__ == "__main__":
    main()
