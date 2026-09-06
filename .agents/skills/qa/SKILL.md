---
name: qa
description: "Use whenever the user asks to assess a repo's quality posture — `$qa` runs a full sweep (test pyramid, CI coverage, pre-commit hygiene) and consolidates the findings, `$qa <dimension>` runs a single assessment. Also responds to \"QA agent\" / \"QA\" aliases in natural-language requests. Routes to the `qa` subagent, which composes the QA assessment skills (assess-test-pyramid, assess-ci, assess-pre-commit) with load-bearing discipline: the quality-bar gate (surface the project's own standard rather than imposing generic defaults), a strict read-only constraint (reports and recommendations only), graceful degradation on missing skills, and auditable point-in-time reports under .codex/reports/."
---

# QA orchestrator

Skill entry point for assessing a repo's quality posture — test distribution, CI coverage, pre-commit hygiene — and consolidating the findings into one auditable read. This skill is a routing layer; the actual assessment composition, gates, and reporting are owned by the `qa` subagent (`.codex/agents/qa.toml`). Keep this file thin so the two surfaces never drift.

## Routing

Spawn the `qa` subagent using the available Codex subagent tool, passing the user's input plus a one-line shape hint. Pick the shape from the arguments:

- `$qa` (no arguments) → **Full sweep**. The subagent runs every installed assessment skill, applies the quality-bar gate per dimension, and consolidates the results into a single quality summary.
- `$qa <dimension>` (e.g. `test-pyramid`, `ci`, `pre-commit`) → **Targeted assessment**. Pass the dimension. The subagent runs that single static assessment and reports.
- `$qa <issue ref>` (e.g. `#41`, a bare number, or a Jira key) → **Feature verification**. Pass the issue reference. The subagent invokes `qa-test`: check out the feature branch, build a test plan from the issue's ACs, post it to the issue, run the feature, post a close/address-gaps assessment to the issue and PR, and — on a clean pass only — move the issue to "Ready For Sign Off" on the active project board. (Directly invocable as `$qa-test #N` too.)
- `$qa <free-text>` (e.g. "is our test pyramid healthy?") → **Ask / route**. The subagent maps the request to a shape (assessment vs. feature verification), asking the user directly if the mapping is ambiguous.

If the argument is genuinely ambiguous, ask the user directly before dispatching — don't guess.

## What the subagent owns (do not duplicate here)

- The QA skill composition: static assessments (`assess-test-pyramid`, `assess-ci`, `assess-pre-commit`) consolidated into one read, plus dynamic feature verification (`qa-test`).
- The load-bearing discipline: the quality-bar gate (surface the project's own standard before judging; never silently impose generic defaults), the read-only-on-code constraint (recommend fixes, never apply them — that's `$dev`), graceful degradation on missing skills, and auditable point-in-time reporting under `.codex/reports/`. For feature verification, `qa-test`'s issue and PR comments are its deliverable and go out autonomously (the clean-tree check before branch checkout is the one destructive-action gate).
- Graceful degradation when a required assessment skill isn't installed — surface the missing skill and skip that dimension (full sweep) or stop (targeted run).
- Reporting back: per-dimension verdict and report path, quality-bar status per dimension, assessments skipped for missing skills, and top diagnoses.

## Why the split

The agent definition is the canonical behavioural spec. Both invocation paths — `$qa …` and natural-language ("QA agent, please assess the test pyramid") — route to the same instructions, so there is one source of truth and no drift between the skill invocation and the subagent.

## Codex delegation

Read the referenced `.codex/agents/` TOML definition and delegate with its `developer_instructions`, the user input, and the repository path. If the tool cannot select a custom agent by name, explicitly instruct the spawned agent to read that definition. If delegation is unavailable, follow the same definition inline. Relay unresolved human decisions to the parent if direct user input is unavailable; wait for the response before dependent work.
