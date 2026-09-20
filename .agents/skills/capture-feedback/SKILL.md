---
name: capture-feedback
description: "Use whenever the user wants to record feedback, an idea or an improvement noticed mid-session without stopping the current task (\"capture feedback: …\", \"note this for later\", \"feedback for the harness\"). This repo keeps no feedback store: the skill locates the jazzjam-workbench checkout this repo is a submodule of and runs its capture, which records the exact wording and the date under the workbench's docs/feedback/not-addressed/ and pushes it straight to the workbench main. Stops and says feedback cannot be stored from here when this checkout is not inside a workbench checkout. Never writes under this repo, never triages, never creates issues."
---

# Capture feedback (delegates to the workbench)

Feedback lives in one place: the private `jazzjam-workbench` repo, under `docs/feedback/`.
This repo is a submodule of it and keeps **no** feedback folder of its own, so this skill is
a thin hand-off to the workbench's `capture-feedback` — it finds the workbench, runs its
script, and reports. Nothing is written under `jazzjamweb`.

The point is that a capture costs the user nothing: they say the thing, it lands on the
workbench `main`, and they are back on their task. No clarification, no triage.

## Steps

1. **Locate the workbench.** Walk up from this repo's top level
   (`git rev-parse --show-toplevel`) through its parent directories until one holds both
   `scripts/feedback.py` and `content/shared.json`; that directory is the workbench
   checkout. For the submodule at `<workbench>/jazzjamweb` it is the parent; for a task
   worktree such as `<workbench>/.scratch/wt<issue>-jazzjamweb` it is two levels up.

   If no parent qualifies — a standalone clone, a CI checkout, a worktree outside the
   workbench — **stop** and say: *Feedback can't be stored from here: this checkout is not
   inside a jazzjam-workbench checkout. Capture it from the workbench.* Do not create a
   feedback folder in this repo as a fallback, and do not write it to the issue instead.
2. **Take the wording exactly as given.** No rephrasing, no summarising, no typo fixes.
   Keep line breaks.
3. **Run the workbench capture** with the workbench as the script's root (the default
   when the script is run from where it lives):

   ```sh
   python3 "<workbench>/scripts/feedback.py" capture "<the wording>"
   ```

   Multi-line wording, or wording with quotes: write it to a scratch file and pass
   `--file <path>` (or `--file -` on stdin). Set `PYTHONIOENCODING=utf-8` on Windows.
4. **Read the result.**
   - `Captured docs/feedback/not-addressed/<date>-<slug>.md on main, pushed to origin/main`
     — done.
   - A line starting `feedback:` on stderr — **not done**. Relay the reason verbatim with
     the fix it names, and stop. The script refuses when the workbench checkout is not on
     `main`, when its `main` carries unpushed commits (it will not bundle them), or when
     the push is rejected; it never touches this repo either way. Do not route around a
     refusal.
5. **Report one line** — the workbench path and that it is on `origin/main` — then go
   straight back to the task that was interrupted.

## Out of scope

- Marking feedback as dealt with: that is the workbench's `address-feedback` skill, run
  from the workbench.
- Reviewing, ranking or triaging feedback; turning it into a GitHub issue.
- Moving a board item, touching the PR, or committing anything in this repo.
