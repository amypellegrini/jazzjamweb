---
name: assess-security
description: Re-assess the Security Baseline dimension and update the score. Run after adding .env.example, fixing .gitignore, documenting auth, or wiring a security scanner in CI.
---

# Assess security baseline

Score the Security Baseline dimension, update `.sensible-harness/assessment.json`, and regenerate the dashboard.

## When to run
After adding `.env.example`, updating `.gitignore`, documenting authentication patterns, or adding security scanning to CI.

## What to assess

- **`.env.example`**: present at repo root or in documented location?
- **Secrets in tracked files**: scan for patterns — `password =`, `api_key =`, `secret =`, `private_key`, AWS key patterns (`AKIA[0-9A-Z]{16}`), base64-encoded tokens. Flag with file:line. Print `[REDACTED]` — never print secret values.
- **`.gitignore` coverage**: covers `.env`, `*.key`, `*.pem`, `secrets/`?
- **Auth documented**: any documentation of authentication/authorisation patterns?
- **Security scan in CI**: `trivy`, `snyk`, `dependabot`, `semgrep`, `npm audit`, `safety` in pipeline?

## Scoring (0–100)

| Item | Points |
|------|--------|
| `.env.example` present | +20 |
| No secrets found in tracked files | +30 (−15 per secret found, min 0) |
| `.gitignore` covers secrets | +20 |
| Auth layer documented | +15 |
| Security scan in CI | +15 |

## Output

1. Write `.sensible-harness/reports/assessment/<latest-timestamp>/06-security.md`.
2. Update `.sensible-harness/assessment.json` — patch `security`.
3. Invoke `/regenerate-dashboard`.
4. Tell the user: new score, delta, secrets found (file:line only, values redacted), gaps, report path.
