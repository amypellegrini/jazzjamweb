---
name: close-issue
description: "Merge a PR after current-head review, QA and explicit human acceptance; verify the driving issue, squash-merge, and clean up the branch. Code-review approval alone never authorizes product acceptance."
---

# Close issue

Read [the shared lifecycle contract](../../../docs/workflow-lifecycle.md) before
acting. Both Claude and Codex use its acceptance, Blocked and same-head rules.

1. Resolve the repository, open PR, full head SHA and driving issue explicitly.
   Read the issue, comments, PR diff and current project items. List each acceptance
   criterion with its verification evidence; missing evidence is a gap, not a pass.
2. For board-tracked work require Ready For Sign Off, current-head passing review
   and QA records, and the human's explicit per-criterion sign-off. Quote/link the
   human decisions. If a gate is missing, report the actual status and next action:
   review handoff, qa-test, or sign-off. A reviewDecision of APPROVED, green CI,
   a coordinator instruction or silence does not supply human acceptance. Honor
   an explicit user override only as described in the shared contract.
3. Verify the PR's closingIssuesReferences includes the driving issue. A PR that
   contributes only part of a cross-repo issue uses Refs instead of auto-closing it;
   close that issue only after all its work is accepted and merged. If adding a
   missing closing link is appropriate, use `gh pr edit --body-file`, then re-fetch
   board state: link automation may have changed it. Do not force it back or merge
   with an unmet status gate.
4. Read and follow check-ci in this tool's skill directory (or `gh pr checks` if
   unavailable). Require green configured checks at the verified head. Missing or
   pending checks are not green; if CI is not configured, report the missing gate
   and require an explicit user acknowledgement before proceeding.
5. Immediately re-fetch PR head, CI and board state and revalidate the shared
   contract. Squash-merge with `gh pr merge <PR> --repo <owner/repo> --squash
   --delete-branch=false --match-head-commit <verified-SHA>`. A mismatch stops the
   merge and requires fresh verification. Confirm merged state and merge commit.
6. Clean up only this task's clean branch/worktree. Preserve unrelated local work;
   do not switch or stash another task's checkout. Fetch main, and remove the
   merged branch locally/remotely only after confirming it has no newer commits.
7. Re-fetch project items after merge. Move only Ready For Sign Off to Done with
   live IDs, then verify. Already Done needs no write. For every other status,
   including Blocked, leave it unchanged and report the discrepancy to the human.
8. Report PR URL, merged SHA, issue state, cleanup, AC evidence, CI and the exact
   human authorization. Report actual board state, including any incomplete cleanup.
