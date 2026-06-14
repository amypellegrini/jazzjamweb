---
name: open-pr
description: Use whenever the user asks to open a pull request for the current branch. Reviews uncommitted changes, commits them atomically (defers to the `commit` skill), pushes the branch with upstream/protected-branch safety checks, opens the PR with `gh pr create` against `main`, and moves the driving issue to "In Review" on the active project board. Refuses to run on `main`.
model: haiku
---

# Open PR

Apply these steps whenever opening a pull request for the current branch.

## Pre-condition — never run on `main`

If the current branch is `main`, refuse. Pull requests are opened from feature branches; there is nothing to open against `main` itself. Surface the current branch name and stop.

The base branch is always `main`. `master`, `develop`, and per-repo base overrides are out of scope — this skill targets `main` only.

## Step 1 — review uncommitted changes

Inspect the working tree with `git status` and `git diff`. Anything not yet committed must be grouped into commits before the PR is opened — work through it in Step 2.

## Step 2 — commit outstanding work

Group related changes into atomic commits — **defer to the `commit` skill** for atomicity and Conventional Commits 1.0.0 format. One concern per commit; never bundle unrelated changes. If the `commit` skill's rules aren't already in context for this conversation, read that skill first.

Skip this step when the working tree is already clean and the branch already carries the commits to be reviewed.

## Step 3 — push the branch

Push the current branch, observing these safety conditions:

- **No upstream tracking ref** — set it as part of the push: `git push --set-upstream <remote> <branch>`.
- **Protected branch** — never push one without explicit authorization in the conversation.

The `commit-and-push` skill encodes the same conditions; when it is installed in the repo, defer to it. `open-pr` does not depend on it being present.

## Step 4 — open the PR

Run `gh pr create` against base `main`:

- **Title** — a concise summary of the branch's intent; Conventional-Commits-style where it fits.
- **Body** — a short summary of what changed and why, plus a test plan when tests were touched.

When `gh pr create` returns, report the PR URL.

> **Issue auto-close link.** When the work was driven by an issue, the PR body should link it so the issue closes on merge (e.g. `Closes #<number>` for GitHub). The exact per-tracker syntax depends on a follow-up — this version of the skill opens the PR *without* the link. Add it by hand for now if the issue should auto-close.

## Step 5 — move the driving issue to "In Review" on the active project board

A PR is up for review, so the issue it delivers should reflect that on the board. This mirrors `pickup-issue`'s "In Progress" sync — resolve everything fresh, never hard-code project numbers, IDs, or field/option IDs (they rotate as milestones change).

- **Determine the driving issue number.** Infer it from the branch name, which `pickup-issue` creates as `feature/<issue-number>-<short-description>` — the number prefix is load-bearing. If the branch carries no issue-number prefix (or the PR isn't issue-driven), skip this step and note it in the final report.
- **Determine the project owner.** Default to the repo owner: `owner=$(gh repo view --json owner -q .owner.login)`. If projects live on a different user/org, ask which owner to use.
- **List open projects:** `gh project list --owner "$owner" --format json` (filter to `closed: false`).
  - If **no open projects** exist, skip this step — note it in the final report.
  - If **exactly one** open project exists, use it.
  - If **more than one** exists, ask via `AskUserQuestion` which is the active roadmap project before proceeding.
- **Fetch the chosen project's Status field fresh:** `gh project field-list <number> --owner "$owner" --format json` — capture the **Status** field ID and the **"In Review"** option ID. Match the option name case-insensitively and tolerate close variants (`In Review`, `In review`, `Review`). If no In-Review-like column exists, do **not** invent one or silently pick another status — surface that the board has no In-Review column and ask whether to add one or leave the status unchanged.
- **Ensure the issue is on the board, then set the status.** The issue may already be an item (e.g. added by `pickup-issue`):
  ```
  # add returns the existing item id if it is already on the board
  item_id=$(gh project item-add <number> --owner "$owner" --url <issue-url> --format json | jq -r .id)
  gh project item-edit \
    --project-id <project-id> \
    --id "$item_id" \
    --field-id <status-field-id> \
    --single-select-option-id <in-review-option-id>
  ```
- **Verify:** `gh project item-list <number> --owner "$owner" --format json` — confirm the issue's status is now **"In Review"**. Report the move (or any skip/blocker) alongside the PR URL.
