---
name: assess-documentation
description: Re-assess the Documentation dimension and update the score. Run after adding or improving README, architecture docs, CONTRIBUTING, TESTING, SECURITY, API docs, or AI governance files.
---

# Assess documentation

Score the Documentation dimension, update `.sensible-harness/assessment.json`, write the per-dimension report, and regenerate the dashboard.

## When to run
After any change to: README.md, ARCHITECTURE.md, CONTRIBUTING.md, ONBOARDING.md, TESTING.md, SECURITY.md, API docs, AGENTS.md, CLAUDE.md, or any file under `docs/`.

## What to assess

Scan all `*.md` files in the repo root and `docs/` tree. Classify each:

| Class | Examples |
|-------|---------|
| README | README.md |
| Architecture | ARCHITECTURE.md, docs/adr/*, docs/architecture* |
| Contributing | CONTRIBUTING.md |
| Onboarding | ONBOARDING.md, docs/getting-started*, docs/setup* |
| Testing | TESTING.md, docs/testing*, docs/test-pyramid* |
| Security | SECURITY.md |
| API docs | docs/api*, OpenAPI/Swagger files |
| AI governance | AGENTS.md, CLAUDE.md, .claude/CLAUDE.md, .cursor/rules* |

For each file found: note path, word count, and whether it is a stub (<100 words).

## Scoring (0–100, start at 100, deduct)

| Gap | Deduction |
|-----|-----------|
| README missing | −30 |
| README stub (<100 words) | −15 |
| README has no setup/install section | −10 |
| No architecture doc | −20 |
| No contributing guide | −15 |
| No onboarding guide | −10 |
| No testing doc | −10 |
| API docs missing (if the project has an API surface) | −10 |
| No AI governance doc (AGENTS.md or CLAUDE.md) | −10 |
| Stub doc (<100 words) counts as 50% present |  |

## Gaps

For each deduction that fired, create a gap entry:
- **P0**: README missing or missing setup section
- **P1**: Architecture or contributing doc missing
- **P2**: Onboarding, testing, or AI governance doc missing
- **P3**: Stubs, cosmetic completeness

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/01-documentation.md`. If no assessment directory exists yet, create one with the current timestamp.
2. Update `.sensible-harness/assessment.json` — patch the `documentation` dimension in the latest entry (or append a new entry if none exists).
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta vs previous, gaps list, report path.
