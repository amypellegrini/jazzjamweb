# Pickup Issue

1. Fetch the specified GitHub issue with `gh issue view`
2. **Validate understanding and quality** — before any branch or code work:
   a. Summarise the issue back to the user in your own words to confirm you understand it correctly
   b. Check the issue against the /business-analyst criteria: **Business Value**, **Acceptance Criteria**, **Manual Verification Steps**, and **Scope**. Flag any sections that are missing or weak.
   c. Ask any clarifying questions — do NOT proceed until the user confirms understanding is correct and all questions are resolved
   d. If the issue is missing required sections, suggest improvements and ask the user whether to update the issue before continuing
3. Ensure the main branch is up to date by running `git pull origin main` before creating any branch
4. Create a feature branch named `feature/<issue-number>-<short-description>`
5. **Discover the currently-active project and set the issue to "In Progress" on it.** Never hard-code project numbers, IDs, or field IDs — active projects rotate as milestones change.
   a. List open projects: `gh project list --owner amypellegrini --format json` (filter to `closed: false`)
   b. If more than one open project exists, ask the user which one is the active roadmap project for this repo before proceeding
   c. Fetch that project's field IDs fresh: `gh project field-list <number> --owner amypellegrini --format json` — capture the Status field ID and the "In Progress" option ID
   d. Add the issue: `gh project item-add <number> --owner amypellegrini --url <issue-url> --format json` — capture the returned item `id`
   e. Set status: `gh project item-edit --project-id <project-id> --id <item-id> --field-id <status-field-id> --single-select-option-id <in-progress-option-id>`
6. Verify the issue is on the correct project with "In Progress" status by re-fetching it with `gh issue view <number> --json projectItems` — confirm the project title matches the active project and status is "In Progress" before proceeding
7. You MUST enter plan mode before doing any implementation work. Read relevant code, research the codebase, and create a thorough implementation plan. Do NOT exit plan mode until the user has reviewed and approved the plan.
8. Once the plan is approved, exit plan mode and implement using TDD — write tests first, then implementation
9. Make atomic commits using Conventional Commits format (e.g. `test:`, `feat:`, `fix:`, `refactor:`). Each commit should address a single concern and reference the issue number (e.g. `feat: add tempo selector (#42)`)

## Design-only issues

When an issue is **design-only** (no production code — mockups, UX flows, wireframes), follow the same branch + PR workflow as a code feature (`feature/<issue-number>-<short-description>`), but:

- **Artifact format:** HTML mockups, consistent with existing `designs/` folder conventions (dark + light variants where applicable, phone-frame 375×812, same font stack and CSS token naming).
- **Location:** inside the top-level `designs/` directory. Organise freely (e.g. `designs/screens/` for single frames, or a subfolder per flow for multi-step journeys). Update `designs/index.njk` to surface new screens in the gallery.
- **UX principles to optimise for** (apply before visual polish):
  1. **Limit options** — prevent decision fatigue; avoid overwhelming the user with controls.
  2. **Shortest path to outcome** — target **no more than 3 taps** from the starting point to completion.
- **Deliverable shape:** start with UX flow journeys (user paths from entry → outcome, annotated), *then* produce screen mockups. Propose multiple options first and let the user pick before committing to a single direction.
- **TDD does not apply** — skip the test-first loop, but still make atomic Conventional Commits (`design:` or `docs:` prefix when appropriate).
