---
name: commit-and-push
description: Use whenever the user asks to commit AND push in a single step ("commit and push", "ship it"). Composes the commit skill's rules (atomic commits, Conventional Commits 1.0.0), syncs with the remote (fetch + rebase if the branch is behind/diverged) and pushes afterwards. Refuses to push when the commit didn't land, when the branch has no upstream tracking, when a pre-push rebase hits conflicts, when the user said "commit only", or when the target is `main` / a protected branch without explicit authorization.
model: haiku
---

# Commit and push

Composes the `commit` skill with a push. Use this only when the user has explicitly asked for both — "commit and push", "ship it", or similar. If the user said only "commit", use the `commit` skill alone.

## Steps

1. Apply the `commit` skill end-to-end. If its rules aren't already in context for this conversation, read them from `.claude/skills/commit/SKILL.md` first.
2. Once the commit has landed successfully, sync with the remote before pushing:
   - `git fetch` the tracking remote, then compare the local branch against its upstream (e.g. `git rev-list --left-right --count @{upstream}...HEAD`, or `git status -sb`).
   - **Up to date or ahead only** (remote has no new commits): proceed to push.
   - **Behind or diverged** (remote has commits the local branch lacks): `git pull --rebase` to replay the local commit on top of the remote.
     - If the rebase hits conflicts, **stop**. Surface the conflicting files and let the user resolve before continuing — do not auto-resolve or `git pull --rebase --strategy`-force.
     - After a clean rebase, re-confirm the commit is intact, then push.
3. Run `git push`.

## Refuse to push when

- The commit failed (pre-commit hook, merge conflict, missing identity, etc.). Surface the error; do not push.
- The local branch has no upstream tracking. Surface the `git push --set-upstream <remote> <branch>` suggestion and let the user authorize before retrying.
- The pre-push rebase (step 2) hit conflicts. Surface the conflicting files; do not push until the user has resolved them.
- The user said "commit only", "don't push", or similar — use the `commit` skill alone instead.
- The push target is `main` (or another protected branch) AND the user hasn't explicitly authorized pushing to it in this conversation.

## After a successful push

Report the pushed commit hash and the remote ref it landed on. Keep it terse — one line is enough.
