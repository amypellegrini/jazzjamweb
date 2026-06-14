---
name: assess-code-quality
description: Re-assess the Code Quality Infrastructure dimension and update the score. Run after adding or configuring a linter, formatter, type checker, pre-commit hooks, or lockfile.
---

# Assess code quality infrastructure

Score the Code Quality Infrastructure dimension (static tooling + pre-commit hooks), update `.sensible-harness/assessment.json`, and regenerate the dashboard.

## When to run
After configuring ESLint, Prettier, TypeScript strict mode, pre-commit hooks, or committing a lockfile.

## Steps

**Part A — Static tooling (inline)**

Check directly:
- **Linter**: config file present (`.eslintrc*`, `eslint.config.*`, `.pylintrc`, `ruff.toml`, etc.) and not just a devDependency?
- **Formatter**: config present (`.prettierrc*`, `[tool.black]`, etc.)?
- **Type checker**: strict mode enabled? (`"strict": true` in tsconfig, `strict = true` in mypy/pyright)
- **Lockfile**: present and committed?
- **Editor config**: `.editorconfig` present?

**Part B — Pre-commit hooks (delegated)**

Load `.claude/skills/assess-pre-commit/SKILL.md` and follow it. Extract: which gate categories are covered (format, lint, typecheck, test, commit-msg, secrets), whether hooks are committed, bypassability risk.

**Scoring (0–100)**

| Item | Points |
|------|--------|
| Linter configured | +25 |
| Formatter configured | +20 |
| Type checker in strict mode | +20 |
| Pre-commit hooks committed | +20 |
| Lockfile committed | +10 |
| Deduct 5–15 per tooling contradiction found | − |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/03-code-quality-infra.md`.
2. Update `.sensible-harness/assessment.json` — patch `code_quality_infra`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, gaps, report path.
