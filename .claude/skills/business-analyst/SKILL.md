---
name: business-analyst
description: Use whenever the user asks to create, review, or reorder Jira issues. `/business-analyst <description>` drafts a new issue, `/business-analyst SH-N` reviews an existing one, no arguments triages the open backlog. Also responds to "BA" / "BA agent" aliases in natural-language requests. Enforces Sensible Harness's issue checklist (Context / Scope / Acceptance criteria / Out of scope / Dependencies) and keeps issues sequenced on the active board/sprint. Uses Jira via ACLI as the default issue tracker.
model: haiku
---

# Business Analyst

Slash-command entry point for backlog work. This skill is a routing layer — the actual drafting, reviewing, triaging, SPEC conflict-checking, and board reordering is owned by the `business-analyst` subagent (`.claude/agents/business-analyst.md`). Keep this file thin so the two surfaces never drift.

## Routing

Spawn the `business-analyst` subagent via the Agent tool, passing the user's input plus a one-line shape hint. Pick the shape from the arguments:

- `/business-analyst <free-text description>` → **Draft**. Pass the description verbatim. The subagent will check `SPEC.md` / `CLAUDE.md` for conflicts, ask clarifying questions if needed, draft against the checklist, and file the issue (delegating to `/create-issue`).
- `/business-analyst SH-N` (or `SH-5 SH-7 SH-12`, etc.) → **Review**. Pass the issue keys. The subagent will audit each against the checklist and propose concrete edits.
- `/business-analyst` (no arguments) → **Triage**. The subagent will survey open issues and propose a sequence, optionally applying it to the active board/sprint if the user asks.

If the argument is genuinely ambiguous (e.g. could be a description *or* an issue key), ask the user via AskUserQuestion before dispatching — don't guess.

## What the subagent owns (do not duplicate here)

- The issue checklist (Context / Scope / Acceptance criteria / Out of scope / Manual verification / Dependencies).
- Reading `SPEC.md` and `CLAUDE.md` and checking the request for conflicts (non-goals, technical conventions, iteration discipline) before drafting.
- Asking clarifying questions when the request is underspecified, rather than inventing checklist content to fill gaps.
- The `jira issue create` flow via ACLI (delegated further to the `/create-issue` skill) and issue-type defaults.
- Active-board/sprint placement and reordering (`jira sprint add`, `jira issue rank`).
- Reporting back: per-shape summary, resolved ambiguities, surfaced conflicts, missing prerequisites.

## Why the split

The agent definition is the canonical behavioural spec. Both invocation paths — `/business-analyst …` and natural-language ("BA agent, please…") — route to the same instructions, so there is one source of truth and no drift between the slash command and the subagent.

## Cursor

Cursor has no subagent equivalent today. Cursor users invoking this rule should follow the workflow inline by reading `.claude/agents/business-analyst.md` — same task shapes (Draft / Review / Triage), same checklist, but executed by the primary agent rather than spawned into its own context.
