# Close Issue

1. Verify the PR body includes `Closes #<issue-number>` so the issue auto-closes on merge — if missing, update the PR body with `gh pr edit`
2. Check the CI pipeline is green with `gh pr checks` — do not merge until all checks pass
3. Merge using **squash and merge** strategy: `gh pr merge --squash`
4. Switch to `main` and pull latest: `git checkout main && git pull origin main`
5. Delete the local and remote feature branch: `git branch -d <branch>` and `git push origin --delete <branch>`
