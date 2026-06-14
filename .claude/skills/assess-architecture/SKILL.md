---
name: assess-architecture
description: Re-assess the Architecture dimension and update the score. Run after restructuring directories, adding an architecture doc, or refactoring layers.
---

# Assess architecture

Score the Architecture dimension, update `.sensible-harness/assessment.json`, and regenerate the dashboard.

## When to run
After directory restructuring, adding ARCHITECTURE.md, extracting layers, or fixing import violations.

## What to assess

1. **Detect the architectural pattern** from directory structure and import patterns:
   - MVC: `controllers/`, `models/`, `views/`
   - Layered: `domain/`, `application/`, `infrastructure/`, `presentation/`
   - Feature-sliced: `features/` or `modules/` with sub-layers inside each
   - Monorepo: `packages/`, `apps/`, `libs/`
   - Flat / unstructured: no discernible pattern
2. **Check for layer violations**: imports from a higher layer into a lower layer. Sample 10–20 files.
3. **Compare to documentation**: if an architecture doc exists, does the code match?
4. **Separation of concerns**: are business logic, I/O, and framework glue mixed in the same files?

## Scoring (0–100)

| Item | Points |
|------|--------|
| Detectable architectural pattern | +30 |
| Pattern documented in ARCHITECTURE.md or ADR | +20 |
| No layer violations found in 10–20 file sample | +30 |
| Code matches architecture doc | +20 |
| Deduct for each violation or mismatch found | − |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/04-architecture.md`.
2. Update `.sensible-harness/assessment.json` — patch `architecture`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, pattern detected, violations found, report path.
