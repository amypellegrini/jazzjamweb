# Pickup Issue

1. Fetch the specified GitHub issue with `gh issue view`
2. Create a feature branch named `feature/<issue-number>-<short-description>`
3. Set the issue to "In Progress" on the project board
4. Verify the issue is "In Progress" by re-fetching it with `gh issue view` and checking `projectItems` status — do not proceed until confirmed
5. Read relevant code and create an implementation plan
6. Implement using TDD - write tests first, then implementation
7. Run `npx tsc --noEmit` to type-check and fix any TypeScript errors
8. Run full test suite with `npm test`
9. Commit with message referencing the issue: "feat: <description> (#<issue-number>)"
