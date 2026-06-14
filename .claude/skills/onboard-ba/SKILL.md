---
name: onboard-ba
description: Use when the user runs /onboard-ba to orient themselves as a business analyst using Sensible Harness. Presents the business-analyst skill set (business-analyst, create-issue), explains how issues flow into delivery, and closes by instructing to run /assess.
model: haiku
---

# Onboarding — Business Analyst

Present this orientation to the user. Keep it practical and welcoming.

## Your role

As a business analyst using Sensible Harness, you work through the **`business-analyst` skill** — a single entry point for backlog work: drafting new issues, reviewing existing ones against the project checklist, and reordering the active board. It enforces Thoughtworks' issue checklist (Context / Scope / Acceptance criteria / Out of scope / Dependencies) so every issue the dev team picks up is ready to code against without back-and-forth.

## Your skills

| Skill | What it does |
|---|---|
| `/business-analyst <description>` | Draft a new issue from a free-text description, check for SPEC conflicts, and file it in Jira |
| `/business-analyst PROJ-N` | Review an existing issue against the checklist and propose concrete edits |
| `/business-analyst` (no args) | Triage the open backlog — survey issues and propose a sequence |
| `/create-issue <description>` | File a new Jira issue directly, without the full BA review flow |

The `business-analyst` skill delegates drafting and filing to `/create-issue` and board management to the Jira CLI (ACLI). You don't need to use them directly — `/business-analyst` handles the routing.

## How issues flow into delivery

Once an issue is filed and sequenced, the dev team picks it up with `/dev #N`. The dev orchestrator validates the issue against the same checklist before branching — if ACs are thin or context is missing, it will route back to the BA flow before writing any code, so quality issues surface at the start rather than mid-PR.

## Next step

Run `/assess-repo` to score this repo across 9 dimensions and produce the initial gap report. The assessment output is a plain-English report you can hand directly to `/business-analyst` to convert each finding into a Jira issue and build the initial backlog.
