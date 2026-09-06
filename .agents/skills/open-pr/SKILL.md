---
name: open-pr
description: "Use whenever the user asks to open a pull request for the current branch. Reviews uncommitted changes, commits them atomically (defers to the `commit` skill), pushes the branch with upstream/protected-branch safety checks, opens the PR with `gh pr create` against `main`, and syncs the driving issue to \"In Review\" on the active project board. Refuses to run on `main`."
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
- **Issue auto-close link** — when the work is issue-driven, the body **must** contain
  `Closes #<number>` (or `Fixes #N` / `Resolves #N`) on its own line, so the issue closes on merge.
  Take the number from the branch prefix, the same way step 5 does. A bare `Refs #N` does **not**
  create the link and does **not** close the issue — use it only for issues this PR genuinely does
  not close.

**Add the link now, at creation — not later.** GitHub Projects' "Pull request linked to issue"
automation fires the moment the link appears and resets the item's status. Created with the link,
that fires here, and step 5 immediately corrects the status to "In Review". Added days later, it
fires then instead — yanking an item out of "Ready For Sign Off" mid-acceptance, for no reason
connected to the work.

When `gh pr create` returns, report the PR URL, and confirm the link registered:
`gh pr view <pr> --json closingIssuesReferences` should list the driving issue. An empty list means
the keyword is missing or malformed — fix it before moving on.

## Step 5 — sync the driving issue to "In Review" on the active project board

Opening the PR is the moment the work transitions from *in progress* to *awaiting review*. Mirror that on the project board so it stays an honest reflection of the work.

First, **determine the driving issue**:

- The feature branch carries the issue number as its prefix (`codex/<issue-number>-<short-description>` — the prefix is load-bearing). Parse it from the current branch name.
- Failing that, read the `Closes #<number>` / `Fixes #N` / `Resolves #N` link from the PR body.
- If neither yields an issue (the branch isn't issue-driven, or there is no tracker), **skip this step** and note it in the final report.

Then sync the board. GitHub Projects rotate as milestones change — **never hard-code project numbers, IDs, or field IDs**; resolve them fresh every time, exactly as `pickup-issue` does:

- Determine the project owner. Default to the repo's owner: `owner=$(gh repo view --json owner -q .owner.login)`. If projects live on a different user/org, ask the user which owner to use.
- List open projects: `gh project list --owner "$owner" --format json` (filter to `closed: false`).
- If **no open projects** exist, skip this step — note it in the final report.
- If **exactly one** open project exists, use it.
- If **more than one** open project exists, ask the user directly which is the active roadmap project for this repo.
- Fetch the chosen project's field IDs fresh: `gh project field-list <number> --owner "$owner" --format json` — capture the **Status** field ID and the **"In Review"** option ID. If the board has no "In Review" option (its column may be named "Review", "In review", etc.), match by intent; if none exists at all, surface it and skip rather than guessing.
- Resolve the issue's item on the board. Re-fetch with `gh issue view <number> --json projectItems`; if the issue was picked up via `pickup-issue` it is already on the board. If it is **not** on the board (e.g. `open-pr` was invoked directly without a prior pickup), add it: `gh project item-add <number> --owner "$owner" --url <issue-url> --format json` — capture the returned item `id`.
- Set the status:
  ```
  gh project item-edit \
    --project-id <project-id> \
    --id <item-id> \
    --field-id <status-field-id> \
    --single-select-option-id <in-review-option-id>
  ```

## Step 6 — verify the project sync (only when step 5 ran)

Re-fetch the issue: `gh issue view <number> --json projectItems` — confirm the project title matches and the status is **"In Review"** before reporting success.

> **Issue auto-close link.** Handled in step 4, which opens the PR *with* `Closes #<number>` and
> verifies it registered. Non-GitHub trackers may need different syntax; that remains a follow-up.
