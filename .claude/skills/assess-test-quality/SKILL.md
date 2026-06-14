---
name: assess-test-quality
description: Re-assess the Test Quality dimension and update the score. Run after adding tests, restructuring the test suite, or updating the test pyramid definition.
---

# Assess test quality

Score the Test Quality dimension by delegating to `assess-test-pyramid`, then update `.sensible-harness/assessment.json` and regenerate the dashboard.

## When to run
After adding tests, restructuring test directories, adding a testing doc, or wiring test coverage.

## Steps

1. Load `.claude/skills/assess-test-pyramid/SKILL.md` and follow it to generate a fresh test pyramid report. Pass context: "Running as part of /assess-test-quality. If no project test-pyramid definition is found, proceed with generic heuristics."
2. Read the generated HTML report from `.sensible-harness/reports/test-pyramid-<timestamp>.html`. Extract:
   - Layer distribution percentages
   - Anti-patterns detected (ice-cream-cone, hourglass, missing layer)
   - Whether a pyramid definition document was found
3. Score the dimension:

| Condition | Points |
|-----------|--------|
| No tests at all | 0 (stop, return 0) |
| Test framework present, 0 tests | 10 |
| Unit ≥60% and E2E <30% | +60 |
| Unit 40–59% | +40 |
| Unit <40% | +20 |
| E2E 30–50% | −10 |
| E2E >50% | −20 |
| Zero integration layer | −10 |
| CI runs tests (check CI config) | +20 |
| Test pyramid definition documented | +10 |
| Coverage configured | +10 |

Cap at 100.

4. Write `.sensible-harness/reports/assessment/<latest-timestamp>/02-test-quality.md`.
5. Update `.sensible-harness/assessment.json` — patch `test_quality`.
6. Invoke `/regenerate-dashboard`.
7. Tell the user: new score, delta vs previous, headline distribution, anti-patterns found, report path.
