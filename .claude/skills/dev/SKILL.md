---
name: dev
description: Use whenever the user asks to drive a feature end-to-end — `/dev #N` picks up an existing issue, `/dev <description>` drives from scratch (BA handoff first), no arguments asks what to drive. Also responds to "dev agent" / "dev" aliases in natural-language requests. Two phases — routes to the `dev` subagent to plan (issue-quality gate; drafts a plan decomposed into atomised-skill steps), then the main agent gates the plan's approval with the human directly and executes it step by step, spawning each step under its skill's own pinned model (tdd, commit, open-pr, check-ci) or running the gate-heavy steps inline (address-pr-comments, close-issue).
model: haiku
---

# Dev orchestrator

Slash-command entry point for driving a feature end-to-end in two phases: **plan** (the `dev` subagent picks up the issue, branches, and drafts a plan decomposed into atomised-skill steps; you gate its approval with the human and resume the subagent to save it) and **execute** (you — the main agent — run the approved plan step by step, each step under its skill's own pinned model). Gate 2 and the plan draft are owned by the `dev` subagent (`.claude/agents/dev.md`); gate 3 (plan approval) and the execution loop below are owned by this file, because only the main agent has a reliable channel to the human and can dispatch model-routed spawns.

## Routing — the planning phase

Spawn the `dev` subagent via the Agent tool, passing the user's input plus a one-line shape hint. Spawn it **in the foreground** (synchronously, `run_in_background: false`) — gate 2 (issue-quality) surfaces to the human via the subagent's own `AskUserQuestion`, and those prompts cannot reach the human from a backgrounded agent. Pick the shape from the arguments:

- `/dev #N` (or a bare issue number / Jira key) → **Pickup**. Pass the issue reference. The subagent will read the issue, validate it against the checklist, summarise it back, branch, and draft a plan.
- `/dev <free-text description>` → **Drive from scratch**. Pass the description verbatim. The subagent will route the BA → DEV handoff (file the issue via `/business-analyst` first if one doesn't exist yet), then proceed as Pickup with the resulting issue.
- `/dev` (no arguments) → **Ask**. The subagent will ask the user what to drive (pickup an existing issue or start from a description) via `AskUserQuestion` before doing anything else.

If the argument is genuinely ambiguous (e.g. could be a description *or* a stale issue reference like `5`), ask the user via AskUserQuestion before dispatching — don't guess.

If the subagent's report contains **no plan at all** — a readiness gap stopped the run, or the issue-quality gate is unresolved — **stop. Do not execute anything.** Surface the report to the human and let them decide. Otherwise, the report carries a **drafted, not-yet-approved plan** — proceed to the plan-approval gate below.

## The plan-approval gate — yours, not the subagent's

Gate 3 (plan-mode) is the single most load-bearing pause in the whole workflow, and it belongs to **you**, not the `dev` subagent — you're the one with a reliable, direct channel to the human. The subagent hands you a drafted plan and stops; it never gates its own approval or explains why. When you receive that draft:

1. **Paste the plan in full into your own text output.** The human cannot see the subagent's report — only your text renders. Never reference it ("see above") or reduce it to a one-line summary; the human needs the actual plan to approve it.
2. **Ask the human directly**, via `AskUserQuestion` — **Approve plan** / **Request changes**. Present only the plan and that choice. Never mention the subagent's tooling, its runtime, or how it would otherwise have asked the human itself — that's an internal implementation detail with no bearing on the plan, and it must never appear in anything the human reads.
3. **On approval**, resume the `dev` subagent (`SendMessage`) with a plain instruction: the plan is approved, save it as a comment on the driving issue, and end its turn. Take its own send-back at face value here — you gated this with the human yourself, moments ago, in this same conversation.
4. **On requested changes**, resume the subagent with the specific feedback. It returns a revised, still-unapproved plan — repeat from step 1.
5. Once the subagent confirms the plan was saved to the driving issue, proceed to **Execution** below with the approved plan.

## Execution — you run the approved plan

With an approved plan in hand, execute its steps **in order**. Each step names its primitive, its pinned model, and a dispatch mode:

- **`[spawn]` steps** (`tdd`, `commit`, `commit-and-push`, `open-pr`, `check-ci`): dispatch via the Agent tool — general-purpose agent, **foreground**, and pass the step's pinned model explicitly as the Agent tool's `model` parameter (this per-invocation routing is the entire point: it is the only mechanism the harness honours for running a step under the skill's pinned model). Prompt template:

  > Load `.claude/skills/<skill>/SKILL.md` with the Read tool and follow it exactly. Inputs: <the step's inputs, verbatim from the plan>. The implementation plan is already approved. Report back the outcome the skill's own reporting section asks for.

- **`[inline]` steps** (`address-pr-comments`, `close-issue`): read the skill's SKILL.md yourself and follow it in the main session. These steps carry per-comment and per-AC human pauses that must reach the human natively; that outweighs model routing for them (they are sonnet-pinned; inline runs at the session model by design).

Execution discipline:

- **Between `tdd` steps**, run the full test suite; a failure means stop and surface — do not proceed to the next step on a broken suite.
- **Conditional steps** (`address-pr-comments`, the `check-ci` after it) only fire when review comments exist; skipping them is not a failure.
- **Stop conditions** — a spawned step reports failure or an unmet precondition; a step's inputs are missing from the plan; the working tree or branch state diverges from what the plan assumes. In every case: stop, surface to the human, and wait. **Never improvise around a broken step and never re-scope the plan yourself** — plan changes go back through the human (re-run `/dev` to replan).

## Gate integrity — executing is not approving

Gate 2 (issue-quality) was answered by the human during the subagent's planning pass; gate 3 (plan approval) was answered by the human directly through you, in the plan-approval-gate step above. The plan comment saved on the driving issue is the proof all three cleared. Executing the approved plan step by step is **not** answering a gate. But you still never answer one yourself:

- **Never** approve, modify, or re-scope the plan on your own initiative — however solid or improvable it looks. If you're ever handed a plan that skipped the approval gate above, that plan is not executable; run it through the gate first.
- When an `[inline]` step — or a spawned step, via its own `AskUserQuestion` — surfaces a gate decision (review-comment classification, AC sign-off, merge), the decision belongs to the **human**. Relay verbatim, wait for their answer, and pass it on stated as such.

## What the subagent owns (do not duplicate here)

- The planning workflow: task shapes, gate 2 (issue-quality), `pickup-issue` composition (branch + board sync), drafting the plan (format, verbatim-AC rule, gates 4–9 encoding), and — once you've resumed it with approval — the save-to-card handoff.
- Graceful degradation when a required atomised skill isn't installed — surface the install command (`sensible-harness <skill>`) and stop.
- Reporting back: the drafted plan verbatim, gate 2's decision, manifest gaps. Gate 3's approval and the plan-saved confirmation are yours to obtain and relay, not the subagent's to report.

## Why the split

The agent definition is the canonical planning spec — both invocation paths (`/dev …` and natural-language "dev agent, please drive #N") route to the same instructions. Execution lives here, in the main agent's hands, because per-skill model routing requires Agent-tool spawns that only the main session can dispatch, and because the execution-phase human gates (per-comment classification, AC sign-off, merge) reach the human natively in the main session.

## Cursor

Cursor has no subagent equivalent and no model routing today. Cursor users invoking this rule should follow both halves inline by reading `.claude/agents/dev.md` — same planning contract, same gates — and then execute the approved plan themselves in the primary session, without per-step model routing.
