---
name: capture-feedback
description: "Use whenever the user wants to record feedback, an idea or an improvement noticed mid-session without stopping the current task (\"capture feedback: …\", \"note this for later\", \"feedback for the harness\"). This repo keeps no feedback store: the skill locates the jazzjam-workbench checkout this repo is a submodule of and runs its capture, which records the exact wording and the date under the workbench's docs/feedback/not-addressed/ and pushes it straight to the workbench main. Stops and says feedback cannot be stored from here when this checkout is not inside a workbench checkout, and asks for the workbench to be updated when it predates feedback capture. Never writes under this repo, never triages, never creates issues."
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
   (`git rev-parse --show-toplevel`) through its parent directories until one holds
   `content/shared.json`; that directory is the workbench checkout. For the submodule at
   `<workbench>/jazzjamweb` it is the parent; for a task worktree such as
   `<workbench>/.scratch/wt<issue>-jazzjamweb` it is two levels up.

   If no parent qualifies — a standalone clone, a CI checkout, a worktree outside the
   workbench — **stop** and say: *Feedback can't be stored from here: this checkout is not
   inside a jazzjam-workbench checkout. Capture it from the workbench.* Do not create a
   feedback folder in this repo as a fallback, and do not write it to the issue instead.

   If the workbench is found but has no `scripts/feedback.py`, it is a workbench checkout
   from before feedback capture existed — not a missing one. **Stop** and say: *The
   workbench at `<workbench>` predates feedback capture (no `scripts/feedback.py`). Update
   it — pull its `main` — and capture again.* Do not pull it yourself mid-task, and do not
   fall back to writing the feedback anywhere else.
2. **Take the wording exactly as given.** No rephrasing, no summarising, no typo fixes.
   Keep line breaks.
3. **Run the workbench capture** with the workbench as the script's root (the default
   when the script is run from where it lives), passing the wording on stdin through a
   quoted heredoc — always, even for one short line:

   ```sh
   python3 "<workbench>/scripts/feedback.py" capture --file - <<'FEEDBACK'
   <the wording, exactly as given, line breaks and all>
   FEEDBACK
   ```

   The quotes around `'FEEDBACK'` are what keep the wording verbatim: inside them the
   shell expands nothing, so backticks, `$`, quotes and `!` reach the file as typed.
   Never pass the wording as a command-line argument — inside double quotes,
   `` `desk-check` `` runs `desk-check` and `$HOME` becomes a path. If a line of the
   wording is exactly `FEEDBACK`, pick a terminator that does not occur in it. The
   newline that ends the heredoc is not recorded. The script reads the wording as UTF-8
   whatever the console code page, so on Windows the heredoc works as-is from Git Bash.
   With no POSIX shell (PowerShell), write the wording to a scratch file with the
   file-writing tool, never through a shell command, and pass `--file <path>`. Never
   pipe or redirect the wording in PowerShell: Windows PowerShell 5.1 turns every
   character outside ASCII piped to a program into `?`, and its `>` and `Set-Content`
   write UTF-16 or the ANSI code page.
4. **Read the result.**
   - `Captured docs/feedback/not-addressed/<date>-<slug>.md on main, pushed to origin/main`
     — done. A line after it is a note about the workbench's local `main`; pass it on as
     is.
   - A line starting `feedback:` on stderr — **not done**. Relay the reason verbatim with
     the fix it names, and stop. The capture lands on the workbench `main` whatever that
     checkout has out: on a feature branch it is left untouched and the commit is made in
     a throwaway worktree, and unpushed commits on `main` simply go up with it. It still
     stops when it cannot fetch `origin/main`, when local changes in a checkout with
     `main` out block the fast-forward, when the commit fails (a hook, signing), or when
     the push is rejected; it never touches this repo either way. Do not route around a
     refusal.
5. **Report one line** — the workbench path and that it is on `origin/main` — then go
   straight back to the task that was interrupted.

## Out of scope

- Addressing feedback: the workbench's `address-feedback` skill, run from the
  workbench, turns an item into a GitHub issue through the workbench's
  `business-analyst` skill, then marks it addressed.
- Reviewing, ranking or triaging feedback; turning it into a GitHub issue from here.
- Moving a board item, touching the PR, or committing anything in this repo.
