---
name: onboard-qa
description: Use when the user runs /onboard-qa to orient themselves as a QA engineer using Sensible Harness. Presents the qa agent, the QA skill set (assess, assess-test-pyramid, assess-ci, assess-pre-commit, qa-test), and closes by instructing to run /assess.
model: haiku
---

# Onboarding — QA Engineer

Present this orientation to the user. Keep it practical and welcoming.

## Your role

As a QA engineer using Sensible Harness, you work through the **`qa` orchestrator** — a single entry point for both static quality assessments (point-in-time checks of the codebase) and dynamic feature verification (running a feature against its acceptance criteria). QA is read-only on the code under test: you surface findings and recommend fixes, but never apply them — that's a dev move.

## Your agent: `qa`

The `qa` agent does two kinds of work:

**Static assessments** — analyse the repo as-is, no test execution:
- **Test distribution** — classifies every test by pyramid layer, computes the balance, and flags ice-cream-cone or hourglass anti-patterns.
- **CI coverage** — checks what the pipeline actually verifies (build, test, lint, typecheck, security) and where the gaps are.
- **Pre-commit hygiene** — checks which local gates are enforced before a commit lands and whether they're bypassable.

**Feature verification** — run a feature against its acceptance criteria:
- Checks out the feature branch, builds a test plan (happy-path, edge, negative scenarios), posts it to the issue, runs the feature, and posts a close/address-gaps assessment to the PR.

Every assessment writes an auditable report to `.sensible-harness/reports/`. After a full sweep, a consolidated BA handoff report is written so `/business-analyst` can convert each finding directly into a Jira issue.

## Your skills

| Skill | What it does |
|---|---|
| `/qa-assessment` | Full sweep — test distribution, CI coverage, and pre-commit hygiene in one shot |
| `/qa` | Same full-sweep entry point, plus routing for targeted dimensions and feature verification |
| `/qa-test #N` | Verify a specific feature against its driving issue's acceptance criteria |
| `/assess-test-pyramid` | Test distribution report only |
| `/assess-ci` | CI coverage report only |
| `/assess-pre-commit` | Pre-commit hygiene report only |

## Invoking the orchestrator

- **Full quality sweep:** `/qa-assessment` or `/qa`
- **One dimension:** `/qa test-pyramid`, `/qa ci`, `/qa pre-commit`
- **Feature verification:** `/qa #N` or `/qa-test #N` — replace `N` with the issue number or Jira key

## Next step

Run `/assess-repo` to score this repo across 9 dimensions and establish the initial quality baseline. The assessment output includes a plain-English BA handoff report under `.sensible-harness/reports/` that you can hand directly to `/business-analyst` to convert any gaps into Jira issues.
