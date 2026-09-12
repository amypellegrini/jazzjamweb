---
name: qa-assessment
description: "Run a full static quality assessment of test distribution, CI coverage and pre-commit hygiene through the QA profile, producing a consolidated report for backlog refinement."
---

# Assess — full quality sweep

Dedicated entry point for a full quality assessment of this repo. No routing, no arguments needed — this skill always runs the complete sweep: test distribution, CI coverage, and pre-commit hygiene. The `qa` subagent owns the composition, gates, and reporting; this skill's job is to spawn it with an unambiguous full-sweep instruction.

Use `$qa` if you need targeted assessments (one dimension), feature verification (`$qa <issue ref>`), or a general-purpose QA entry point. Use `$qa-assessment` when you want the full read in one shot.

## What this skill does

Spawn the `qa` subagent using the available Codex subagent tool with the following explicit instruction:

> Run a **full sweep** quality assessment. Assess all three dimensions in order:
> 1. Test distribution — invoke `assess-test-pyramid`.
> 2. CI coverage — invoke `assess-ci`.
> 3. Pre-commit hygiene — invoke `assess-pre-commit`.
>
> Apply the quality-bar gate before each dimension (locate the project's own standard; if absent, surface it and ask before proceeding on generic heuristics). After all dimensions complete, write the consolidated BA handoff report to `.codex/reports/qa-<timestamp>.md` (plain English, findings enumerated and sized for Jira issues). Report back with per-dimension verdicts, individual report paths, and the BA handoff report path.

Do not add routing logic. Do not inspect arguments — this skill has a single, fixed shape.

## What the subagent owns (do not duplicate here)

- Running each assessment skill and applying the quality-bar gate per dimension.
- The read-only-on-code constraint (recommend fixes, never apply them).
- Graceful degradation when a required skill isn't installed — surfaces the install command and skips that dimension in the full sweep.
- The consolidated BA handoff report at `.codex/reports/qa-<timestamp>.md`.
- Reporting back: per-dimension verdict and individual report paths, quality-bar status per dimension, skipped dimensions, top diagnoses, and the BA handoff report path.

## Output

The subagent produces:

- **Individual dimension reports** under `.codex/reports/` — one per assessed dimension.
- **Consolidated BA handoff report** at `.codex/reports/qa-<timestamp>.md` — plain English findings enumerated for Jira issue creation, one finding per actionable gap.

Surface the BA handoff report path prominently in your response so the user can hand it to `$business-analyst` immediately.

## Codex delegation

Read `.codex/agents/qa.toml` and delegate with that profile when the runtime supports named custom agents. Otherwise use `collaboration.spawn_agent` with a bounded task explicitly instructing the child to read and follow that file’s `developer_instructions`. Pass the user’s request, relevant authorization, task shape, and repository path. Do not assume a custom agent selector exists. If delegation is unavailable, follow the profile inline.

Forward unresolved human decisions to the parent; the parent asks the user and relays the answer. Preserve every approval gate. Background execution does not remove user interaction or imply approval.
