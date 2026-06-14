---
name: assess-ci-cd
description: Re-assess the CI/CD & Delivery Conventions dimension and update the score. Run after adding or updating CI pipelines, commit conventions, PR templates, or release pipelines.
---

# Assess CI/CD & delivery conventions

Score the CI/CD & Delivery Conventions dimension by delegating pipeline analysis to `assess-ci`, then assess delivery conventions inline.

## When to run
After adding CI workflows, commit conventions, PR templates, branch strategy docs, or release pipelines.

## Steps

**Part A — CI pipeline (delegated)**

Load `.claude/skills/assess-ci/SKILL.md` and follow it. Extract: whether CI exists, which platform, gate coverage (build / test / lint / typecheck / security — each Covered / Partial / Not Covered), whether CI runs on PRs and main.

**Part B — Delivery conventions (inline)**

- **Commit conventions**: `commitlint.config.*`, `.commitlintrc*`, or conventional-commits in CONTRIBUTING.md?
- **PR template**: `.github/PULL_REQUEST_TEMPLATE.md` or equivalent?
- **Branch strategy**: documented?
- **Release pipeline**: `semantic-release`, `release-please`, or manual release notes?

## Scoring (0–100)

| Item | Points |
|------|--------|
| CI pipeline exists | +25 |
| Tests run in CI | +20 |
| Lint / type-check in CI | +15 |
| Commit conventions enforced | +15 |
| PR template present | +10 |
| Branch strategy documented | +10 |
| Release pipeline configured | +5 |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/05-ci-cd-conventions.md`.
2. Update `.sensible-harness/assessment.json` — patch `ci_cd_conventions`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, gate coverage table, missing items, report path.
