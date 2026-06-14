---
name: qa-assessment
description: Use whenever the user asks to run a full quality assessment of the repo — test distribution, CI coverage, and pre-commit hygiene — and produce a consolidated findings report. Spawns the `qa` subagent with an explicit full-sweep instruction: runs all three installed assessment skills, applies the quality-bar gate per dimension, and writes a plain-language markdown report at .sensible-harness/reports/qa-<timestamp>.md ready for the BA agent to convert gaps into Jira issues.
model: haiku
---

# Assess — full quality sweep

Dedicated entry point for a full quality assessment of this repo. No routing, no arguments needed — this skill always runs the complete sweep: test distribution, CI coverage, and pre-commit hygiene. The `qa` subagent owns the composition, gates, and reporting; this skill's job is to spawn it with an unambiguous full-sweep instruction.

Use `/qa` if you need targeted assessments (one dimension), feature verification (`/qa <issue ref>`), or a general-purpose QA entry point. Use `/assess` when you want the full read in one shot.

## What this skill does

Spawn the `qa` subagent via the Agent tool with the following explicit instruction:

> Run a **full sweep** quality assessment. Assess all three dimensions in order:
> 1. Test distribution — invoke `assess-test-pyramid`.
> 2. CI coverage — invoke `assess-ci`.
> 3. Pre-commit hygiene — invoke `assess-pre-commit`.
>
> Apply the quality-bar gate before each dimension (locate the project's own standard; if absent, surface it and ask before proceeding on generic heuristics). After all dimensions complete, write the consolidated BA handoff report to `.sensible-harness/reports/qa-<timestamp>.md` (plain English, findings enumerated and sized for Jira issues). Report back with per-dimension verdicts, individual report paths, and the BA handoff report path.

Do not add routing logic. Do not inspect arguments — this skill has a single, fixed shape.

## What the subagent owns (do not duplicate here)

- Running each assessment skill and applying the quality-bar gate per dimension.
- The read-only-on-code constraint (recommend fixes, never apply them).
- Graceful degradation when a required skill isn't installed — surfaces the install command and skips that dimension in the full sweep.
- The consolidated BA handoff report at `.sensible-harness/reports/qa-<timestamp>.md`.
- Reporting back: per-dimension verdict and individual report paths, quality-bar status per dimension, skipped dimensions, top diagnoses, and the BA handoff report path.

## Output

The subagent produces:

- **Individual dimension reports** under `.sensible-harness/reports/` — one per assessed dimension.
- **Consolidated BA handoff report** at `.sensible-harness/reports/qa-<timestamp>.md` — plain English findings enumerated for Jira issue creation, one finding per actionable gap.

Surface the BA handoff report path prominently in your response so the user can hand it to `/business-analyst` immediately.

## Cursor

Cursor has no subagent equivalent today. Cursor users invoking this rule should follow the workflow inline by reading `.claude/agents/qa.md` with an explicit "full sweep" instruction — same composition and gates, but executed by the primary agent rather than spawned into its own context.
