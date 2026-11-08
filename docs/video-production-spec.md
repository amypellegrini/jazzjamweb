# Video production spec

Rules for turning an article into a narrated YouTube lesson, as settled while producing the block
chords video (`scripts/video/`). Follow them from the first draft. Each rule exists because breaking
it drew review feedback, so a new video should reach the same standard in one or two review rounds,
not ten.

**Rule of thumb:** the viewer must always be able to tell **what is being said**, **what is being
shown**, and **what is sounding**. They must never be shown or played something before the
narration names it.

---

## 1. Pipeline

Run from the repo root. `W` is a scratch work dir, never inside the repo.

```sh
python3 scripts/video/storyboard.py $W/storyboard                       # scores, keyboards, storyboard.json
python3 scripts/video/narrate-elevenlabs.py $W/storyboard/storyboard.json $W/el-<Voice> --voice <voice id>
python3 scripts/video/audio.py <engine.mid> <musicpracticepro dir> $W/audio $W/storyboard/storyboard.json
NARRATION=$W/el-<Voice> node scripts/video/make-video.mjs $W/storyboard/storyboard.json $W/audio $W
```

- **`storyboard.py`:** one row per narrated sentence, each a list of frames.
  - Every score is rendered with MuseScore 4 from the same voicing data as the article.
  - Every keyboard is drawn by `piano-chord-charts`, then recoloured key by key.
- **`narrate-elevenlabs.py`:** records one file per sentence, keyed by the SHA-1 of its text. A re-run only pays for text that changed.
  - `--rows 9,22 --force` re-records specific rows.
- **`audio.py`:** writes the drums, every full example, and every storyboard snippet (`music/<id>.wav` + `.events.json`).
- **`make-video.mjs`:**
  - Drives a Playwright page (`scene.js`) frame by frame.
  - Assembles the audio sample-exactly.
  - Writes `block-chords.mp4` and `youtube-description.txt`.
- **MuseScore crashes:** MuseScore 4 occasionally segfaults on a score it rendered fine before. Re-run the storyboard step once before investigating.
- **Generated files:** never hand-edit generated assets. Change the source (`storyboard.py`, the article, `block-chords.py`) and re-run.

## 2. Canvas and layout

| Element | Rule |
|---|---|
| Frame | 1920×1080, 30 fps, white background (`#fff`), ink `#142030`. No boxes around music. |
| Brand | "JazzJam", top-left (64 px, 44 px), Outfit 600 30 px. |
| Section label (kicker) | Top-right, Outfit 600 24 px, uppercase, letter-spacing .08em, `#3670a0`. Empty on title cards. |
| Visual area | `top 110px; bottom 90px; left/right 80px`, a centred column with 40 px gap. Score above keyboard. |
| Subtitles | **None.** They distract. The narration and anchor words carry the text. |
| Snippet scores | One scale for every snippet: 0.32 px per MuseScore unit alone (max 560 px high), 0.235 with a keyboard (max 400 px high), max 1760 px wide. A one-staff melody is never blown up to grand-staff height, and **consecutive snippets render at equal size.** |
| Article examples | As wide as the frame allows (≤ 1680 px wide, ≤ 600 px high), keyboard underneath. |
| Keyboard | Always the **same range, A3–D6**, so it can stay on screen and only recolour. 150 px high under a score, 240 px alone. Notes outside the range are skipped, never an error in playback. |
| Photos | 560 px high, 10 px radius, name (Outfit 600 36 px) and credit line (Outfit 400 20 px, `#5a6b7d`) under each. Credits come from `assets/people/credits.json` and go into the YouTube description. |

## 3. Fonts

| Use | Font |
|---|---|
| UI, titles, anchor words, names | **Outfit** (Google Fonts) 400/600/700 |
| Long-form text (unused now that subtitles are off) | Literata |
| ♭ ♯ ♮ in any text | `"Accidentals"` (Apple Symbols / Arial Unicode MS / Segoe UI Symbol, U+266D–266F) listed **first** in the font stack, so accidentals never fall back to tofu or a mismatched glyph. |
| Title | Outfit 700 128 px, line-height 1.05 |
| Title subtitle | Outfit 400 46 px, `#4c6882` |
| Third line (outro note) | Outfit 400 34 px, `#5a6b7d` |
| Anchor words | Outfit 700 104 px, line-height 1.1 |

## 4. Narration

### Script

- The narration is the article's sentences in reading order: one storyboard row per sentence. The row count must equal the sentence count (`storyboard.py` refuses otherwise).
- **Name chords, don't spell them.** The score and keyboard already show the notes.
  - Write "G7, with F on top", not "G–B–D–F".
  - Spell notes only where the explanation depends on it (e.g. the 2 5 1 at the top of the scale: "A, B and C").
  - Put the video's wording in `SPOKEN`, keyed by row.
- **The title card speaks its title and its subtitle.** Phrase the subtitle as a promise, e.g. "Piano Block Chords. Four ways to harmonise the major scale."
- **Signal asides.** A tangent opens with "Quick note:", and its anchor words start with "quick note".
- **Name chords precisely.** Write "a diminished seventh chord", not "a diminished seventh".
- **Don't point by number.** Refer back to earlier material as "the example we saw before", never "Example 16".
- **Don't over-explain a figure.** Name the scale and what was added ("the C major scale with an extra semitone between G and A"), not every note in it.

### Voice

- ElevenLabs, model `eleven_v4`, British English. The chosen voice is **Megan** (`45Ax8wdajmGTaLOJAJwK`), used by id; a library voice doesn't need to be added to the account.
- Each request carries the previous and next sentences as `previous_text`/`next_text`, so intonation runs across cuts.
- **Spoken form** (`narrate-elevenlabs.py speak()`):
  - Chord symbols are expanded by `narrate.py speak_word` (A♭m7 → "A-flat minor seven").
  - **Never send Kokoro's phoneme markup** (`[A](/ˈA/)`) to ElevenLabs. It makes the voice drop the "A" or read it as the article "a".
  - Hyphenate accidentals to the letter: "A-flat", "G-sharp".
  - "G♯/A♭" is read as "G-sharp or A-flat".
- **Verify note names by speech-to-text** (`/v1/speech-to-text`, `scribe_v1`) on every sentence that names a note. Listening isn't possible from the pipeline; STT is the check.
- **Key handling:** the API key lives only in the gitignored `.env.local` (from `npx -y @elevenlabs/cli@latest onboard init`) or `ELEVENLABS_API_KEY`.
  - Never print it, commit it, or accept it pasted in chat.
  - The key has no `voices_write`, which is fine.
  - A full narration costs about 6,000 credits; re-recording one sentence costs about 100–300.

## 5. Timing and audio synchronisation

### Cues

- Every frame after a row's first appears on a **cue word** of its sentence, found by prefix match after stripping leading punctuation.
  - A cue may be a phrase ("and B").
  - Pick a cue that is unique up to that point: "C," not "C" when "C6" comes earlier.
- **Nothing is shown or played before the narration names it.**
- **The first frame of a row:**
  - Without a cue, it appears as the sentence starts.
  - With a cue, the previous picture holds until then. After a title card or a full example the screen clears instead (see §6).

### Snippet playback over narration

- A frame whose score adds bars plays those bars (swung, app piano) from the next beat after its cue.
- The bars fade in 0.45 s ahead of the sound (`LEAD_IN`); the release tail is 0.3 s.
- **A snippet always plays in full.** If its music would still be sounding at the next cue, the narration waits.
  - It waits at the **last comma or full stop** before that cue (a natural breath).
  - With no punctuation, it waits at the cue itself. Avoid that case by design: a mid-phrase pause reads as a defect.
- **Explanations don't play.** If a snippet is there to be talked about (spelling, comparing, naming chords), mark it `play=False`; it plays in full after the explanation. This also removes most mid-phrase waits, the main source of "narration cut" feedback.
- The row lasts until the narration plus pause or the music ends, whichever is later.

### Cutting the narration

- **Where to cut:**
  - Every cut point (sentence boundary, cue, wait) is the **quietest 10 ms** in the gap between the two words' timings.
  - The search window is widened 60 ms either side, because a word's first consonant (the "s" of "stack", the "l" of "left", the "p" of "passing") starts before its timed start.
  - Cutting at the timing alone clips it: "s-tack".
- Every narration slice gets 5 ms fade-in/out so a cut never clicks.
- **Pauses:** 1.2 s after each sentence, 1.6 s after a title.

### Full examples, drums and piano

- Full article examples:
  - Enter on the **next downbeat** of the drums, at least 0.35 s away.
  - Play in full, with every chord lit in sync (from `events.json`).
  - Leave 0.8 s of tail before the narration resumes.
- **Drums** (from the app's backing-track engine, same tempo, 92 BPM swing):
  - 0.15 gain under the voice, 0.35 while the piano plays, with short ramps either side.
  - **Silent during title cards** (fade out 0.5 s before, back in 0.3 s after).
  - Faded out over the outro.
- The audio is built from measured pieces padded to exact timeline positions. Rounding never accumulates, and build-up chords land on the drums' beats to the sample.

## 6. Screen state

- **Never leave the screen blank or stale while the narration talks.**
  - A sentence with nothing to show gets **anchor words** (§7).
  - After a **title card** or a **full example**, the screen clears before the next sentence. The previous graphic never sits under narration that has moved on to a new topic. A short blank gap is fine; a stale graphic is not.
- Title cards disappear when the narration after them starts.
- Elements are persistent and animate between frames (0.6 s, `cubic-bezier(.22,.7,.2,1)`), never hard cuts:
  - What stays slides or resizes (FLIP).
  - What's new fades and slides in.
  - What leaves fades out where it was. All leavers are measured before any is removed, so none collapses.
  - A score that stays reveals its next bars in place.
  - The keyboard recolours in place.
- **Build-ups** (basic shape, block from below) start empty (`reveal=0`) and add each step on its cue word.

## 7. Anchor words

- **Use them** for any stretch of narration with no picture: an opening, a gap after a title or an example, a definition.
- **Choose terms that carry meaning**: a technique, a concept, a chord type ("harmonisation techniques", "block chords", "locked hands", "sixth-diminished scale", "diminished seventh chord", "equal minor thirds", "2 5 1 chords", "chromatic approach").
  - **Never** filler ("only works", "every technique"). If no meaningful phrase exists, show the sentence's graphic from its start instead.
- **Build-up:** words appear one at a time on the cue where each is spoken.
  - The newest word is in its accent colour; earlier ones settle to ink.
  - Accents rotate blue `#2563EB`, green `#2F9E44`, crimson `#C2255C`, violet `#7048E8`.
  - Words enter with `translateY(40px) scale(.8)`.
- **When the narration moves on, the text moves on.** Switch to a new set on the next anchor word, instead of leaving the old line up while a new sentence starts.

## 8. Colour coding

Three independent colour systems. **They must never share a colour on the same element type**, or they cancel each other out.

### 8.1 Notation roles (the article's code, used in labels and build-ups)

| Role | Notehead / text | Keyboard tint |
|---|---|---|
| Melody | crimson `#C2255C` | `#DDA5B8` |
| Chord tones | green `#2F9E44` | `#A6D1AE` |
| Left hand / doubling | violet `#7048E8` | `#BDB2E6` |
| Passing tones | blue `#2563EB` | `#A7BCE8` |
| Root (dropped) | red `#E03131` | — |
| Other scale notes (context) | — | muted `#E9CF9A` |
| A note a voicing lacks | — | red `#EE8A8A` |

### 8.2 Playback (what is sounding now)

| | Noteheads | Keyboard |
|---|---|---|
| Right hand | blue `#2563EB` | chart blue `#A0C6E8` (piano-chord-charts' default highlight) |
| Left hand | violet `#7048E8` | violet `#BDB2E6` |

- **Only what sounds is lit.**
  - While a snippet or example plays, its keyboard is blank except the chord sounding.
  - Noteheads light in sync with the audio and clear when it stops.
- Left-hand noteheads are detected by staff (each system is a grand staff; staves alternate right/left), never by pitch.
- Noteheads are matched to chords by the line band they sit on, then by x position (two-line scores repeat x positions).

### 8.3 Explanation (what the narration points at)

| | Noteheads / rests | Keyboard |
|---|---|---|
| Highlight | orange `#E8590C` | orange tint `#F5B990` |

- Used for chords lit as named, notes picked out ("G, B and D in both chords"), "the left hand plays the whole scale", "the right hand rests".

### 8.4 The rules that hold it together

1. **Playback blue ≠ explanation orange.** Anything an explanation highlights uses orange. Blue on a notehead always means "sounding".
2. **Passing tones are black by default**, in snippets *and* in the article's own example images, which are recoloured when loaded.
   - Blue passing tones would hide the playback blue.
   - Where colouring the passing tones *is* the point of the example, they take the explanation orange instead (currently only `rootless-major-ninth`, in `PASSING_EXPLAINED`).
   - In general, highlight passing tones only when the full scale is on screen and the sentence is about its passing tones.
3. **Keyboard colours always state their meaning:**
   - Role tints for a labelled build-up (the keys match the label text: melody crimson, chord tones green, root violet).
   - Playback colours only while sounding.
   - Orange tint for explanation.
   - Green/blue role tints when the narration sorts notes into chord tones and passing tones.
4. **One chord at a time on the keyboard.** Overlapping two chords' keys reads as one big chord.
   - When a sentence names several chords of the same kind together ("C6 on the chord tones"), light them in the score and mark only their melody notes on the keyboard.
5. **A scale on the keyboard runs C to B.** Don't repeat the top C.
6. **Don't colour what isn't being discussed.** A key or notehead in a different colour must answer "why is this one coloured?". If the answer is "no reason" (e.g. a green top C among blue passing keys), make it match.

## 9. Explaining with scores

- **Keep context on screen.** When an explanation walks through a scale or progression, show the **whole harmonised scale** once and **light each chord as it is named**.
  - Don't swap to a separate two-chord snippet per sentence.
  - This applies to the chromatic approaches, the dominant seventh and G7♭9 placement, and the 2 5 1 voicings ("render all the chords and highlight them when mentioned").
- **Name before showing.** Never show a chord the narration hasn't reached yet; show the full set and light each one on its cue.
- **Sorting notes:** when a sentence sorts notes ("the four notes of C6 (C, E, G and A) … the passing tones (D, F, A♭ and B)"), light them one by one on their cues. Build the colour-coded keyboard up the same way: chord tones green, then passing tones blue added.
- **Part-of-chord highlights:** use note-level highlights, e.g. `light=[[0, [0, 1, 2]], [1, [1, 2, 3]]]` (chord index, notes counted top down, right hand then left).
- **Hands and rests:** `mark="lh"` picks out the left hand's notes; `mark="rests"` the right hand's rests.
- **Don't play during it:** a sentence that explains a figure doesn't play it. The full example plays after the explanation.
- **Keyboard on every score:** a score of chords always has a keyboard under it (a blank keyboard that follows playback, if nothing else).

## 10. Titles, chapters and outro

- **Section title cards:** title plus a one-sentence subtitle stating the technique ("Harmonise passing tones as diminished chords."). No drums under them.
- **Chapters:** every section start is written into the YouTube description as a chapter (`m:ss Title`).
- **Outro, 4 s:**
  - "Check the full course" / "jazzjam.app/courses/block-chords" / "Find the link in the description below".
  - The description lists the course link first, then the article and the app.
- **No pricing anywhere**, in the video or the description.

## 11. Review before delivering

Do these before handing a render over:

1. **Map timestamps to rows.** Sum the `audio.txt` piece durations to list each row's start time. Reviewers give feedback by timestamp.
2. **Contact sheets.** Pull frames (`ffmpeg -ss <t> -frames:v 1`, tiled) at every changed moment, and zoom on any score where highlighting changed. Check that:
   - Lit chords are the right ones, whole, and in the right colour.
   - No blue passing tone sits under playback blue.
   - The keyboard shows one chord at a time.
   - No stale graphic sits under new narration, and no screen is blank where anchor words should be.
3. **STT on narration** that names notes or chords.
4. **Mid-phrase waits.** Look for `wait-s<row>-<frame>` pieces in `audio.txt`. Any wait not at punctuation is a likely "narration cut" complaint: make the earlier snippet `play=False` or move the cue.
5. **Report honestly.** State what was verified by frames or STT and what can only be judged by ear.

## 12. Implementation notes

- **`storyboard.py` frame options:**
  - `score`, `keys`, `title`/`sub`, `cue`, `example`, `photos`, `reveal`, `words`.
  - `play=False`, `mark`, `light`.
  - `colour=True` keeps passing-tone blue; avoid it (see §8.4).
  - `follow=True` makes a build-up's keyboard follow playback instead of keeping label colours.
- **`EXAMPLES_AFTER`:** places the full article examples after given rows.
- **`SPOKEN`:** holds the video's own wording.
- **Keyboard recolouring:** done by exact pitch on the SVG's `rect` order (white keys, then the black key after each C, D, F, G, A). The CLI's own `--highlightKeys` ignores octaves.
- **`scene.js` lights:** `window.light(k, cls)` takes a chord index, a list, `[k, "rh"]` or `[k, [notes]]`; `cls` is `"sounding"` (playback) or `"lit"` (explanation).
