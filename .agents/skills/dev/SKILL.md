---
name: dev
description: "Use whenever the user asks to drive a feature end-to-end — `$dev #N` picks up an existing issue, `$dev <description>` drives from scratch (BA handoff first), no arguments asks what to drive. Also responds to \"dev agent\" / \"dev\" aliases in natural-language requests. Routes to the `dev` subagent, which composes the DEV workflow (pickup → $tdd loop → commits → open-pr → $check-ci → address-pr-comments → close-issue) with load-bearing gates including repo-readiness (flags missing test harness / CI / issue tracker rather than silently skipping process), plan-approval, and AC-verification."
---

# Dev orchestrator

Skill entry point for driving a feature end-to-end — pickup → commits (via TDD) → PR → review handling → close. This skill is a routing layer; the actual workflow, gates, and skill composition are owned by the `dev` subagent (`.codex/agents/dev.toml`). Keep this file thin so the two surfaces never drift.

## Routing

Spawn the `dev` subagent using the available Codex subagent tool, passing the user's input plus a one-line shape hint. Pick the shape from the arguments:

- `$dev #N` (or a bare issue number / Jira key) → **Pickup**. Pass the issue reference. The subagent will read the issue, validate it against the checklist, summarise it back, branch, and gate on plan-approval before any code.
- `$dev <free-text description>` → **Drive from scratch**. Pass the description verbatim. The subagent will route the BA → DEV handoff (file the issue via `$business-analyst` first if one doesn't exist yet), then drive the resulting issue end-to-end.
- `$dev` (no arguments) → **Ask**. The subagent will ask the user what to drive (pickup an existing issue or start from a description) directly before doing anything else.

If the argument is genuinely ambiguous (e.g. could be a description *or* a stale issue reference like `5`), ask the user directly before dispatching — don't guess.

## What the subagent owns (do not duplicate here)

- The full DEV workflow composition: `pickup-issue` → repeated `$tdd` (once per AC) → `commit` / `commit-and-push` → `open-pr` → `$check-ci` → `address-pr-comments` → `close-issue`.
- All load-bearing gates: repo-readiness, issue-quality, plan-approval, TDD loop, atomic-commits, review-comment classification, AC-verification, CI, post-PR CI checkpoint.
- Graceful degradation when a required atomised skill isn't installed — surface the missing skill (`.agents/skills/<skill>/SKILL.md`) and stop.
- Reporting back: per-stage outcomes, gates that paused for approval, skills that ran, missing prerequisites.

## Why the split

The agent definition is the canonical behavioural spec. Both invocation paths — `$dev …` and natural-language ("dev agent, please drive #N") — route to the same instructions, so there is one source of truth and no drift between the skill invocation and the subagent.

## Codex delegation

Read the referenced `.codex/agents/` TOML definition and delegate with its `developer_instructions`, the user input, and the repository path. If the tool cannot select a custom agent by name, explicitly instruct the spawned agent to read that definition. If delegation is unavailable, follow the same definition inline. Relay unresolved human decisions to the parent if direct user input is unavailable; wait for the response before dependent work.
