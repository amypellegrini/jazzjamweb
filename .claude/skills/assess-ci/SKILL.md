---
name: assess-ci
description: Use whenever the user asks to check whether CI is configured, audit what the pipeline verifies, or identify gaps in automated quality gates. Locates the repo's CI configuration files, classifies what each pipeline step covers (build, test, lint, typecheck, security), surfaces any uncovered gates, and writes a plain-language markdown report at .sensible-harness/reports/assess-ci-<timestamp>.md.
---

# Assess CI coverage

Scan this repo's CI configuration, classify what each pipeline step verifies, identify uncovered gates, and write a plain-language markdown report at `.sensible-harness/reports/assess-ci-<timestamp>.md`. The report's purpose is to give the team an honest read on automated quality gates — what runs on every change, what's missing, and what that costs them.

This is a **static, read-only assessment** — do not run any pipelines, modify any workflow files, or install any CI configuration. Recommendations only.

## 1. Locate the project's CI policy documentation

Before scanning configuration files, look for a document that describes what CI is *expected* to cover for this project. Each team has different standards — don't impose generic ones.

Look for, in order:

- A dedicated `docs/ci.md`, `docs/pipeline.md`, or similar.
- A "CI", "Continuous Integration", or "Pipeline" section in `CONTRIBUTING.md` or `README.md`.
- An ADR (`docs/adr/*`, `docs/decisions/*`) that defines pipeline requirements.

**If you find a policy document:**

- Summarise the stated expectations back to the user before scanning.
- Judge gaps against those stated expectations, not generic defaults.
- Preserve the project's vocabulary in the report (e.g. if they call it "the build" don't rename it "compilation").

**If you don't find a policy document:**

- Stop and surface the absence. Two options for the user:
  - **Recommend documenting the CI policy first** — offer to draft a starter `docs/ci-policy.md` based on what you find, capturing the current state as the documented baseline.
  - **Proceed on generic heuristics (explicit opt-in)** — mark the report header: "No CI policy document found; assessed using generic heuristics."
- Do not proceed silently on generic defaults.

## 2. Detect CI systems

Scan the repo root and common locations for CI configuration. Look for:

| File / directory | System |
|---|---|
| `.github/workflows/*.yml` or `.yaml` | GitHub Actions |
| `.circleci/config.yml` | CircleCI |
| `.gitlab-ci.yml` | GitLab CI/CD |
| `Jenkinsfile` | Jenkins |
| `azure-pipelines.yml` | Azure DevOps |
| `bitbucket-pipelines.yml` | Bitbucket Pipelines |
| `.travis.yml` | Travis CI |
| `Makefile` targets named `ci` or `check` | Make-based CI (often a wrapper) |

If **no CI configuration is found**, that is the primary finding. Report it clearly and skip the rest of the classification (there is nothing to classify). Record it as a gap finding.

If **multiple systems are found**, assess each one. Note if they cover different triggers (e.g. one runs on PRs, another on deploys).

## 3. Classify what each step verifies

For each workflow or pipeline, identify which quality gates are active. Use step names, `run:` commands, action IDs (e.g. `actions/setup-node`), and job names as signals.

The five gate categories:

| Category | Signals to look for |
|---|---|
| **Build** | `tsc`, `npm run build`, `cargo build`, `go build`, `mvn compile`, `gradle build`, build-related actions |
| **Test** | `npm test`, `pytest`, `go test`, `cargo test`, `jest`, `vitest`, `mocha`, `rspec`, test-runner actions |
| **Lint** | `eslint`, `ruff`, `golangci-lint`, `rubocop`, `flake8`, `pylint`, `stylelint`, lint-runner actions |
| **Typecheck** | `tsc --noEmit`, `mypy`, `pyright`, type-checking actions |
| **Security** | `npm audit`, `snyk`, `trivy`, `grype`, `semgrep`, SAST/SCA actions, dependency scanning |

For each gate category, record:

- **Covered** — at least one step verifies it.
- **Partially covered** — a step exists but only runs on certain branches or is allowed to fail (`continue-on-error: true`).
- **Not covered** — no step found.

### Branch / trigger coverage

Also note whether CI runs on:

- Pull requests / merge requests (most important for catching regressions before merge)
- The main / default branch (catches what slipped through)
- All branches (broadest coverage)
- Only specific branches or tags

If CI only runs on push to main and not on PRs, surface that as a gap — it means regressions can be merged before they're caught.

## 4. Identify gaps

Gaps are gate categories that are **not covered** or **only partially covered**. For each gap:

- Name it in plain language (e.g. "No security scanning" not "SCA absent").
- State the business consequence briefly (e.g. "Known vulnerabilities in dependencies may go undetected until a security audit").
- Give a concrete recommendation (e.g. "Add a dependency audit step to the CI pipeline").

Do not invent gaps. If a gate isn't covered, say so. If it is covered, do not manufacture a finding to fill the report.

## 5. Write the report

Write to `.sensible-harness/reports/assess-ci-<timestamp>.md` where `<timestamp>` is a filesystem-safe ISO-like value (e.g. `2026-05-08T14-30-00Z`). Create the directory if missing — it's gitignored.

The report must use plain language throughout. Avoid raw pipeline YAML, command-line flags, or action IDs in the main findings — describe *what happens* and *what it means*, not the implementation detail. Technical specifics belong in parentheses or a detail section if needed.

**Report structure:**

```markdown
# CI Coverage Report — <project name>
**Generated:** <timestamp>
**CI system:** <name, or "None detected">
**Policy document:** <path, or "None found — assessed using generic heuristics">

## At a glance

| Gate | Status |
|---|---|
| Build | ✅ Covered / ⚠️ Partial / ❌ Not covered |
| Test | ... |
| Lint | ... |
| Typecheck | ... |
| Security | ... |

**Runs on pull requests:** Yes / No / Partial

## Findings

### <Finding title>
**Status:** Gap / Partial gap
**Observation:** <What was found>
**Business impact:** <Why it matters>
**Recommendation:** <What to do>

...

## What's working well
<Brief acknowledgement of gates that are in good shape — always include this if anything is covered>

## Detailed step inventory
<Optional — list each workflow/job and the gates it covers, for auditability>
```

If everything is covered and CI runs on PRs, the findings section should say so explicitly ("No gaps found") rather than being omitted. A clean bill of health is a valid result.

## 6. Out of scope

- Do not run any pipelines or trigger any CI jobs.
- Do not edit CI configuration files. If you see a fix, recommend it.
- Do not compare against a previous report — point-in-time only.
- Do not assess CI *performance* (speed, flakiness, cost) — that's a separate dimension.

## 7. After writing the report

Tell the user:

- The exact report path.
- Whether a CI policy document was found or generic heuristics were used.
- The at-a-glance gate table (copy it inline — don't make them open the file for the headline).
- Any gaps, each in one sentence.
- That the detailed step inventory in the report is auditable and they should flag anything that was misclassified.
