# Business Analyst

Manage the GitHub issue backlog and create well-structured issues that follow project guidelines.

## Creating Issues

When creating a new issue, ensure it includes:

1. **Business Value** — clearly articulate why this feature matters and what value it delivers to users
2. **Acceptance Criteria** — define measurable criteria that account for the business value; each criterion should be verifiable
3. **Manual Verification Steps** — unless explicitly stated otherwise, every delivered feature must be human-testable; provide clear, step-by-step reproduction instructions that a person can follow to verify the feature works as expected; if the steps cannot be defined yet, add a checklist item to define them during development before the issue is considered done
4. **Scope** — describe what is in scope and, where helpful, what is explicitly out of scope

Use `gh issue create` with a body formatted in markdown.

**Every new issue must be triaged for labels, milestone, and project — always, without being asked.** Never hard-code label names, milestone titles, project numbers, or field IDs; always discover the current options fresh, because they rotate as milestones change:

- **Labels** — list available labels with `gh label list --limit 100 --json name,description` and apply every label that fits (type, area, phase, goal). Never invent a label that does not exist.
- **Milestone** — list milestones with `gh api repos/:owner/:repo/milestones --jq '.[] | {number, title}'` and assign the most relevant one. If no milestone clearly fits, tell the user and ask which to use rather than leaving it unset silently.
- **Project** — add the issue to the currently-active project (see steps below).

Apply labels and milestone at creation time via `gh issue create --label <name> --milestone <title>` where possible; otherwise set them with `gh issue edit` immediately afterward. After placement, verify all three with `gh issue view <number> --json labels,milestone,projectItems`.

**After creating the issue, add it to the currently-active project.** Never hard-code project numbers or field IDs — active projects rotate as milestones change:

1. List open projects: `gh project list --owner amypellegrini --format json` (filter to `closed: false`)
2. If more than one open project exists, ask the user which one is the active roadmap project for this repo before proceeding
3. Fetch that project's field IDs fresh: `gh project field-list <number> --owner amypellegrini --format json` — capture the Status field ID and the relevant option ID (typically "Todo" for newly-created backlog items, or "In Progress" if the user will pick it up immediately)
4. Add the issue: `gh project item-add <number> --owner amypellegrini --url <issue-url> --format json` — capture the returned item `id`
5. Set status: `gh project item-edit --project-id <project-id> --id <item-id> --field-id <status-field-id> --single-select-option-id <option-id>`
6. Verify: `gh issue view <number> --json projectItems` — confirm the project title matches the active project

## Reviewing / Triaging the Backlog

When asked to review or triage existing issues:

1. Fetch open issues with `gh issue list`
2. For each issue, check whether it meets the guidelines above (business value, acceptance criteria, manual verification steps)
3. Flag issues that are missing required sections and suggest improvements
4. Summarise findings so the user can prioritise next steps

## Sequencing and Reordering Issues in a Project

When issues need to be reordered in a GitHub Project board:

1. **Get the project number and ID:**
   ```
   gh project list --owner <owner> --format json
   ```

2. **List all project items with their IDs and order:**
   ```
   gh project item-list <project-number> --owner <owner> --format json
   ```
   Parse the JSON to get each item's `id`, `content.number`, and position.

3. **Reorder items using the GraphQL mutation `updateProjectV2ItemPosition`:**
   - To move item B before item A: place B after the item that currently precedes A, then place A after B.
   - Use `afterId` to specify the item after which the moved item should appear.
   ```
   gh api graphql -f query='
   mutation {
     updateProjectV2ItemPosition(input: {
       projectId: "<PROJECT_ID>"
       itemId: "<ITEM_TO_MOVE_ID>"
       afterId: "<ITEM_TO_PLACE_AFTER_ID>"
     }) {
       items(first: 1) { nodes { id } }
     }
   }'
   ```

4. **Update the Sequencing section** in the affected issues' bodies to reflect the new order (layer numbers, dependency references).

When swapping two adjacent issues A and B (moving B before A):
- Move B to A's position by setting `afterId` to the item immediately before A
- Move A after B by setting `afterId` to B's item ID

## Arguments

- If invoked with a description (e.g. `/business-analyst add tempo selector for practice mode`), create a new issue using that description as the starting point
- If invoked with an issue number (e.g. `/business-analyst #123`), review that issue against the guidelines and suggest improvements
- If invoked with no arguments, list and triage the open backlog
