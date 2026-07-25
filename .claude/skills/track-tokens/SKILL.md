---
name: track-tokens
description: Use whenever the user asks to report, collect, or post the current session's token spend — the main session's own usage plus every spawned subagent task. Also responds to "track tokens" / "token usage" / "token spend" in natural-language requests. Routes to the `track-tokens` subagent, which reads the session's transcripts, aggregates a task-by-task breakdown and grand total, always reports it in-session, and posts it as a comment on the related issue (when one can be identified) via the active tracker.
model: haiku
---

# Track-tokens

Slash-command entry point for collecting and reporting the current session's token spend. This skill is a routing layer; the transcript-reading, aggregation, and issue-posting logic is owned by the `track-tokens` subagent (`.claude/agents/track-tokens.md`). Keep this file thin so the two surfaces never drift.

## Routing

Spawn the `track-tokens` subagent via the Agent tool, passing along any free-text argument as-is. There is a single task shape today: `/track-tokens` collects and reports the current session's token spend — main session plus every spawned subagent task.

## What the subagent owns (do not duplicate here)

The transcript-reading, aggregation, in-session reporting, and issue-posting behaviour. See `.claude/agents/track-tokens.md` for the current state of that contract.

## Why the split

The agent definition is the canonical behavioural spec — both invocation paths (`/track-tokens` and natural-language requests like "how many tokens did this session use?") route to the same instructions, so there is one source of truth and no drift between the slash command and the subagent.

## Cursor

Cursor has no subagent equivalent today. Cursor users invoking this rule should follow the workflow inline by reading `.claude/agents/track-tokens.md` — same composition, executed by the primary agent rather than spawned into its own context.
