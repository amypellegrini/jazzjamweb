---
name: release-notes
description: Generate Play Store release notes from a GitHub project
disable-model-invocation: true
argument-hint: [project-number]
---

# Generate Release Notes

Generate Play Store release notes from a GitHub project board.

## Steps

1. List GitHub projects with `gh project list --owner amypellegrini --closed --format json` to find the target project
   - If `$ARGUMENTS` is provided, use it as the project number directly
   - Otherwise, ask the user which closed project to use
2. Fetch all items from the project: `gh project item-list <number> --owner amypellegrini --format json --limit 100`
3. Filter issues to only **features** and **bug fixes** (ignore tests, CI/CD, chores, docs, refactors)
4. Summarise the issues into a Play Store release notes format:
   - Do NOT include issue numbers or conventional commit prefixes (feat:, fix:, etc.)
   - Group into a short intro paragraph, "New features:" bullet list, and "Bug fixes:" bullet list
   - Keep the total length **under 500 characters** (Google Play Store limit)
   - Write in user-facing language — concise, clear, no technical jargon
5. Write the output to `RELEASE_NOTES.txt` in the repo root
6. Display the final character count to confirm it's under 500
