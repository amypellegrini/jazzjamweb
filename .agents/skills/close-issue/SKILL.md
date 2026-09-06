---
name: close-issue
description: "Use whenever the user asks to merge a PR that closes its driving issue (\"close #N\", \"merge #14\", \"ship the PR\"). Verifies acceptance criteria pass/fail against the diff, confirms the PR auto-closes the issue, requires merge authorization (an approving review or an explicit user instruction — silence is not approval), waits for green CI (delegated to $check-ci where installed), squash-merges, and cleans up local + remote branch. Invoked as the final step of the $dev orchestrator's composition."
---

# Close issue

Apply these steps whenever invoked to merge a PR that closes its driving issue. The skill verifies acceptance criteria against the diff, confirms the PR auto-closes the issue, requires merge authorization (an approving review or an explicit user instruction — silence is not approval), waits for green CI (delegated to `$check-ci` where installed), squash-merges, and cleans up the branch.

The `$dev` orchestrator invokes this as its final composed step; humans can also invoke it directly.

## Step 1 — AC-verification gate

Fetch the issue with `gh issue view <number>` and read its **Acceptance criteria** section. Compare each criterion against the PR diff (`git diff main...HEAD`) and the test results.

**List each AC with a pass/fail verdict.** If any AC is **not** covered by the diff, **stop and flag it** — do **not** proceed to merge until the user confirms either:

- the AC is genuinely out of scope and the issue should be updated, or
- the AC needs another pass (loop back to `$tdd`).

This is the single most load-bearing pause at the close end of the workflow.

## Step 2 — verify auto-close link

The PR body must contain `Closes #<issue-number>` (or `Fixes #N` / `Resolves #N`) so the issue auto-closes on merge. If missing, update the PR body with `gh pr edit <pr> --body-file <file>`.

## Step 3 — CI gate

When CI is configured on the target repo, **wait for green checks** before merging.

- If the `check-ci` skill is installed, **delegate** to `$check-ci`. It returns a single verdict: `green` / `failing` / `no-CI-configured`.
- Otherwise, run `gh pr checks` directly. Treat **failing** as a stop (surface the failing-run URLs); treat **no checks reported** as proceed-with-note (the project doesn't have CI set up).

Do **not** proceed to merge on a failing CI verdict. Surface the failures and let the user decide.

## Step 4 — merge-authorization gate

Merging requires a **positive signal**; silence is not approval. Check for either:

- an **approving review** on the PR — `gh pr view <pr> --json reviewDecision` returns `APPROVED`, or
- the **user explicitly instructing the merge** — "merge it", "close #N", "ship the PR", or a direct human invocation of this skill (which is itself that instruction).

An empty `reviewDecision` (the repo has no required reviewers configured), green CI, and zero review comments do **not** satisfy this gate — that state means the PR is still awaiting review. When invoked from the `$dev` monitoring loop without either signal, **stop here**: report the PR as open, In Review, and awaiting merge authorization, and let the monitoring loop keep polling. Do not proceed to step 5.

## Step 5 — squash-merge

Merge using the **squash and merge** strategy: `gh pr merge <pr> --squash --delete-branch=false`. We delete the branch ourselves in step 8 so the local cleanup is consistent.

## Step 6 — stash any uncommitted changes

Before switching branches, check for uncommitted changes with `git status`. If there are unstaged or staged changes (or untracked files unrelated to the PR), run `git stash --include-untracked` to preserve them. Note this so you can restore them in step 9.

## Step 7 — switch to main and pull

`git checkout main && git pull origin main`.

## Step 8 — clean up the feature branch

- Delete the local branch: `git branch -d <branch>`.
- Delete the remote branch: `git push origin --delete <branch>`.

## Step 9 — restore stashed changes (only if step 6 stashed anything)

`git stash pop`.

## Step 10 — project-board cleanup (when the issue was synced to a project)

If the issue was synced to a project board earlier in the flow (`pickup-issue` → "In Progress", then `open-pr` → "In Review"), the issue's GitHub auto-close (from step 5's merge) will close the issue but the project-board status may not transition to "Done" automatically depending on the project's workflow settings. Re-fetch with `gh issue view <number> --json projectItems` — if status is still "In Review", "In Progress", or similar, transition it to **"Done"** using the same `gh project item-edit` shape as `pickup-issue` step 4.

## Step 11 — report back

Report: PR URL, merge commit SHA, issue number closed, branch deleted (local + remote), AC pass/fail summary from step 1, CI verdict from step 3, and the merge-authorization signal from step 4 (approving review vs. explicit user instruction).
