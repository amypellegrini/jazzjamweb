---
name: assess-dependency-health
description: Re-assess the Dependency Health dimension and update the score. Run after updating dependencies, committing a lockfile, or updating the runtime version.
---

# Assess dependency health

Score the Dependency Health dimension, update `.sensible-harness/assessment.json`, and regenerate the dashboard.

## When to run
After running `npm install`, updating `package.json`, committing a lockfile, or upgrading the Node/Python/runtime version.

## What to assess

- **Lockfile present and committed**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `poetry.lock`, `Cargo.lock`, etc.
- **Manifest vs. lockfile consistency**: dependencies in manifest present in lockfile?
- **Undeclared imports**: sample 10–20 source files — do imports reference packages not in the manifest?
- **Private registry**: if `.npmrc` / `.yarnrc.yml` / `pip.conf` references a private registry, is it documented?
- **Dependency count**: note total direct + dev count. Flag if >100 direct dependencies.
- **Runtime version support**: is the declared Node/Python/etc. version in active support (Node ≥18, Python ≥3.9 as of 2026)?

## Scoring (0–100)

| Item | Points |
|------|--------|
| Lockfile present and committed | +30 |
| Manifest / lockfile consistent | +20 |
| No undeclared imports in sample | +25 |
| Runtime version in active support | +15 |
| Private registry documented (if used) | +10 |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/08-dependency-health.md`.
2. Update `.sensible-harness/assessment.json` — patch `dependency_health`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, lockfile status, runtime version verdict, gaps, report path.
