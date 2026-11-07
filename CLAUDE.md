# Project Rules

## Shared Content

`src/_data/shared.json` is GENERATED from the private jazzjam-workbench repo — never
edit it by hand. See [SHARED_CONTENT_SPEC.md](SHARED_CONTENT_SPEC.md) before touching
the Pro Unlock section or other app-shared content. Never add pricing to the site —
a Playwright guardrail enforces this.

## Workflow entry points

These repository rules apply to Claude and Codex. Claude uses `.claude/skills/` and
`.claude/agents/`; Codex uses `.agents/skills/` and `.codex/agents/`.
The self-contained `.agents/skills/code-review/SKILL.md` is shared by both tools;
Claude reads it as a procedure, without requiring a Codex runtime.
Both use [the child handoff procedure](docs/workflow-lifecycle.md). Board columns
and next steps are owned by the workbench `docs/board-columns.md`; this repo does
not define a separate column set.

## Article assets and cloud sessions

Articles live in `src/articles/<slug>/index.html`. Their notated examples and narration are
GENERATED — edit the sources, never the outputs:

- Examples: `scripts/sheet-music/<slug>.py` → `src/assets/articles/<slug>/*.musicxml|svg|mp3|cursor.json`
  (MuseScore 4, version pinned in `.github/workflows/render-assets.yml`).
- Keyboard charts: those MusicXML + cursor timings → `scripts/keyboards/keyboard.js <slug>` →
  `src/assets/articles/<slug>/*.keyboard.svg|keys.json` (compact keyboards from the
  `piano-chord-charts` CLI; `keys.json` lists the keys each chord lights). Re-run it after
  re-rendering the examples; it needs no MuseScore, so it runs anywhere `npm ci` does.
- Narration: the article's `h1/h2/h3/p/aside` text → `src/assets/articles/<slug>/narration/`
  (Kokoro TTS). Unchanged paragraphs keep their recording (matched by text hash).

Cloud sessions can't run MuseScore 4 or download the Kokoro model. Don't render locally there:
edit the sources, push to a branch, and the **Render Assets** workflow renders and commits the
outputs back (it runs on push when the sources or the workflow change; a person can also run it
from the Actions tab — cloud session tokens can't dispatch workflows). Pull before further edits, since the workflow
adds a commit. Changing the text of a paragraph re-records only that paragraph's narration.
