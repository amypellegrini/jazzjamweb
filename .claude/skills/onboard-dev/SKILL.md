---
name: onboard-dev
description: Use when the user runs /onboard-dev to orient themselves as a developer using Sensible Harness. Presents the dev agent, the developer skill set (pickup-issue, tdd, commit, open-pr, address-pr-comments, check-ci, close-issue), and closes by instructing to run /assess.
model: haiku
---

# Onboarding — Developer

Present this orientation to the user. Keep it practical and welcoming.

## Your role

As a developer using Sensible Harness, you work through the **`dev` orchestrator** — a single entry point that drives a feature from issue to merged PR. You don't need to juggle individual skill names; `/dev` composes them in the right order with the right gates.

## Your agent: `dev`

The `dev` agent drives a feature end-to-end:

1. **Pickup** — reads the issue, validates it against the project checklist, creates the feature branch, and gates on your approval of the implementation plan before writing any code.
2. **Implement** — runs one TDD cycle per acceptance criterion: red test → green impl → refactor → commit. Repeats until every AC is covered.
3. **Open PR** — pushes the branch and opens a PR against `main`, linking `Closes #N` for auto-close on merge.
4. **Review** — classifies each review comment (bug-fix / scope-aligned / out-of-scope / style-only) and applies or pushes back with reasoning.
5. **Close** — verifies every AC against the diff, waits for green CI, squash-merges, and cleans up.

## Your skills

These are the atomised primitives `dev` composes. You can also invoke any of them directly.

| Skill | What it does |
|---|---|
| `/dev #N` | Pick up an issue and drive it end-to-end |
| `/pickup-issue #N` | Read and validate an issue, create the feature branch, gate on the implementation plan |
| `/tdd` | One red → green → refactor → commit cycle for a single acceptance criterion |
| `/commit` | Atomic commit enforcing Conventional Commits 1.0.0 |
| `/commit-and-push` | Commit and push in one step |
| `/open-pr` | Push the branch and open a PR against `main` |
| `/address-pr-comments` | Classify and respond to review comments with reasoned decisions |
| `/check-ci` | Verify the CI status of the current branch's PR |
| `/close-issue` | Verify ACs, wait for green CI, merge, and clean up |

## Invoking the orchestrator

- **Pick up an existing issue:** `/dev #N` — replace `N` with the issue number (GitHub) or Jira key (e.g. `PROJ-123`).
- **Drive from a description:** `/dev <free-text description>` — the orchestrator routes through the BA flow to file an issue first, then drives it.

## Next step

Run `/assess-repo` to score this repo across 9 dimensions, surface gaps, and generate the repo-specific `onboard-me` and `setup-workspace` skills. The assessment report is also the input the BA and QA roles use to build the initial backlog.
