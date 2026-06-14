---
name: assess-ai-governance
description: Re-assess the AI Governance dimension and update the score. Run after updating AGENTS.md, CLAUDE.md, adding skills, or adding explicit agent behaviour rules.
---

# Assess AI governance

Score the AI Governance dimension, update `.sensible-harness/assessment.json`, and regenerate the dashboard.

## When to run
After updating AGENTS.md or CLAUDE.md, installing new skills, adding agent behaviour rules, or improving the accuracy of AI governance docs.

## What to assess

- **AGENTS.md / CLAUDE.md quality**: present? Covers project purpose, tech stack, directory layout, conventions, agent workflow? Word count >200?
- **Accuracy**: does the governance doc match what you observe in the code? (Cross-check language, package manager, test framework claims.)
- **Installed skills**: is `.claude/skills/` or `.cursor/commands/` present? Are skills documented with names and descriptions?
- **AI conventions**: are there explicit rules about what the agent should/should not do autonomously?
- **Context documents**: any `*.md` files explicitly written to orient an AI agent?

## Scoring (0–100)

| Item | Points |
|------|--------|
| AGENTS.md or CLAUDE.md present | +25 |
| Word count >200 | +15 |
| Covers tech stack and conventions | +20 |
| Accurate — no contradictions with code | +20 |
| Installed skills present | +10 |
| Explicit agent behaviour rules | +10 |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/09-ai-governance.md`.
2. Update `.sensible-harness/assessment.json` — patch `ai_governance`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, accuracy issues found, gaps, report path.
