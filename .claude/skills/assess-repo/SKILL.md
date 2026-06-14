---
name: assess-repo
description: Use whenever the user asks to assess the repository, generate an engineering health report, score the codebase, or run the initial repository assessment after sensible-harness init. Scores the repo across 9 dimensions (documentation, test quality, code quality infrastructure, architecture, CI/CD, security, observability, dependency health, AI governance), writes per-dimension markdown reports to .sensible-harness/reports/assessment/<timestamp>/, updates an interactive HTML dashboard, and generates repo-specific setup-workspace and onboard-me skills for the selected platforms.
---

# Assess repository

Generate a comprehensive, scored assessment of this repository's engineering health across 9 dimensions. Write one markdown report per dimension, a machine-readable JSON snapshot, and an interactive HTML dashboard. Then generate platform-aware `setup-workspace` and `onboard-me` skills tailored to this repo.

Read `.sensible-harness/manifest.json` to determine which platforms were selected during `sensible-harness init`. All output files live under `.sensible-harness/`.

The timestamp for this run: produce one ISO-like value for all outputs (e.g. `2026-06-08T10-00-00Z`, filesystem-safe). Use it consistently across all file paths written in this session.

---

## Phase 1 — Tech stack detection

Identify the following. Record all findings; they feed into later phases.

- **Primary language(s)**: check for `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`, `*.csproj`.
- **Package manager**: `pnpm-lock.yaml` → pnpm; `yarn.lock` → yarn; `bun.lockb` → bun; `package-lock.json` → npm; `poetry.lock` → poetry; `Pipfile.lock` → pipenv; `Cargo.lock` → cargo; etc.
- **Runtime manager**: `.nvmrc`, `.node-version`, `.tool-versions`, `.python-version`, `rust-toolchain.toml`.
- **Test framework**: `vitest.config.*`, `jest.config.*`, `playwright.config.*`, `pytest.ini`, `pyproject.toml [tool.pytest]`, `_test.go` files, `#[cfg(test)]` blocks.
- **Linter**: `.eslintrc*`, `eslint.config.*`, `.pylintrc`, `ruff.toml`, `[tool.ruff]`, `.rubocop.yml`, `golangci.yml`.
- **Formatter**: `.prettierrc*`, `prettier.config.*`, `[tool.black]`, `[tool.isort]`, `rustfmt.toml`.
- **Type checker**: `tsconfig.json` with `"strict": true`, `mypy.ini`, `[tool.mypy]`, `pyright`, `flow`.
- **Pre-commit / hooks**: `.husky/`, `.pre-commit-config.yaml`, `lefthook.yml`, `[tool.commitizen]`.
- **CI platform**: `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`, `azure-pipelines.yml`.
- **Monorepo signals**: `pnpm-workspace.yaml`, `nx.json`, `turbo.json`, `lerna.json`, `packages/` or `apps/` directories.

---

## Phase 2 — Documentation inventory

Scan all `*.md` files in the repo root and `docs/` tree. Classify each:

| Class | Examples |
|-------|---------|
| README | `README.md`, `readme.md` |
| Architecture | `ARCHITECTURE.md`, `docs/architecture*`, `docs/adr/*` |
| Contributing | `CONTRIBUTING.md`, `docs/contributing*` |
| Onboarding | `ONBOARDING.md`, `docs/getting-started*`, `docs/setup*` |
| Testing | `TESTING.md`, `docs/testing*`, `docs/test-pyramid*` |
| Security | `SECURITY.md`, `docs/security*` |
| API docs | `docs/api*`, OpenAPI/Swagger files |
| Domain model | `docs/domain*`, `docs/glossary*`, `docs/ubiquitous-language*` |
| AI governance | `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `.cursor/rules*` |
| ADRs | `docs/adr/*`, `docs/decisions/*`, `docs/rfcs/*` |
| Runbooks | `docs/runbook*`, `docs/ops*`, `docs/incident*` |

For each file found: record path, word count, last-modified date if inferable, and note if it is a stub (< 100 words).

---

## Phase 3 — Test quality

Delegate to `/assess-test-pyramid`. Pass this context so it does not halt on missing policy docs:

> "Running as part of /assess-repo full sweep. If no project test-pyramid definition is found, proceed with generic heuristics rather than stopping. Do not ask the user for input — make the best classification you can and flag the missing definition as a gap in the output."

After `/assess-test-pyramid` completes, read its HTML report from `.sensible-harness/reports/test-pyramid-<timestamp>.html`. Extract:
- Total test count and layer distribution percentages
- Anti-patterns detected (ice-cream-cone, hourglass, missing layer)
- Whether a test-pyramid definition document was found
- Overall assessment verdict

Record these findings. They feed Phase 12 scoring for the Test Quality dimension.

---

## Phase 4 — Code quality infrastructure

**4a — Static tooling (inline)**

Assess directly:

- **Linter**: config file present (not just a devDependency)? Configured to fail on errors? Integrated into CI?
- **Formatter**: config present? Integrated into CI or pre-commit?
- **Type checker**: strict mode enabled? (For TypeScript: `"strict": true` in tsconfig. For Python: `strict = true` in mypy or pyright config.)
- **Lockfile**: present and committed?
- **Editor config**: `.editorconfig` present?

**4b — Pre-commit hooks (delegated)**

Delegate to `/assess-pre-commit`. Pass this context:

> "Running as part of /assess-repo full sweep. If no project pre-commit policy document is found, proceed with generic heuristics rather than stopping. Do not ask the user for input — assess what is present and flag the missing policy doc as a gap."

After `/assess-pre-commit` completes, read its markdown report from `.sensible-harness/reports/assess-pre-commit-<timestamp>.md`. Extract:
- Which gate categories are covered by hooks: format, lint, typecheck, test, commit message, secrets scan
- Whether hooks are committed to the repo (enforced for all developers)
- Bypassability risk (are the same checks also in CI as defence-in-depth?)

Record these findings. They feed Phase 12 scoring for the Code Quality Infrastructure dimension.

---

## Phase 5 — Architecture analysis

1. **Detect the architectural pattern** from directory structure and import patterns:
   - MVC: `controllers/`, `models/`, `views/`
   - Layered: `domain/`, `application/`, `infrastructure/`, `presentation/`
   - Feature-sliced: `features/` or `modules/` with sub-layers inside each
   - Monorepo multi-package: `packages/`, `apps/`, `libs/`
   - Flat / unstructured: no discernible pattern
2. **Check for layer violations**: imports from a higher layer into a lower layer (e.g. domain importing from infrastructure). Sample 10–20 files.
3. **Compare to documentation**: if an architecture doc exists, does the code match? Note contradictions.
4. **Assess separation of concerns**: are business logic, I/O, and framework glue mixed in the same files?

---

## Phase 6 — CI/CD & delivery conventions

**6a — CI pipeline (delegated)**

Delegate to `/assess-ci`. Pass this context:

> "Running as part of /assess-repo full sweep. If no project CI policy document is found, proceed with generic heuristics rather than stopping. Do not ask the user for input — assess what is present and flag the missing policy doc as a gap."

After `/assess-ci` completes, read its markdown report from `.sensible-harness/reports/assess-ci-<timestamp>.md`. Extract:
- Whether a CI pipeline exists and which platform (GitHub Actions, GitLab, CircleCI, etc.)
- Gate coverage: build, test, lint, typecheck, security — each Covered / Partial / Not Covered
- Whether CI runs on PRs and on the main branch

**6b — Delivery conventions (inline)**

Assess directly:

- **Commit conventions**: `commitlint.config.*`, `.commitlintrc*`, `[tool.commitizen]`, or conventional-commits mentioned in CONTRIBUTING.md?
- **PR template**: `.github/PULL_REQUEST_TEMPLATE.md` or equivalent?
- **Branch strategy**: documented in CONTRIBUTING.md or README? Infer from branch names in git log if accessible.
- **Release pipeline**: `semantic-release`, `standard-version`, `release-please`, or manual release notes doc?
- **Deploy pipeline**: deploy step in CI? Separate deploy config?

Record all findings from 6a and 6b. They feed Phase 12 scoring for the CI/CD & Delivery Conventions dimension.

---

## Phase 7 — Security baseline

Assess:

- **`.env.example`**: present at repo root or in documented location?
- **Secrets in tracked files**: scan for obvious secret patterns — `password =`, `api_key =`, `secret =`, `private_key`, AWS key patterns (`AKIA[0-9A-Z]{16}`), base64-encoded tokens in config files. Flag matches with file:line references. Do not print the secret values — print `[REDACTED]`.
- **`.gitignore` coverage**: does `.gitignore` include `.env`, `*.key`, `*.pem`, `secrets/`?
- **Auth layer documented**: is there any documentation of authentication/authorisation patterns in the codebase?
- **Security scan in CI**: `trivy`, `snyk`, `dependabot alerts`, `semgrep`, `npm audit`, `safety` in CI pipeline?
- **Dependency pinning**: are dependencies pinned to exact versions or using caret/tilde ranges?

---

## Phase 8 — Observability

Assess:

- **Logging**: a logging library configured (`winston`, `pino`, `structlog`, `slog`, `zap`, `logrus`)? Log levels used? Structured logging (JSON output)?
- **Error handling**: consistent error handling patterns? Uncaught exception handlers? Error boundaries (React)? `process.on('uncaughtException')` or equivalent?
- **Metrics / monitoring**: `prometheus`, `opentelemetry`, `datadog`, `newrelic`, `sentry` configured?
- **Health check endpoint**: `/health`, `/healthz`, `/ping` route present?
- **Runbooks**: any runbook or on-call documentation?
- **Distributed tracing**: trace IDs propagated? OpenTelemetry instrumentation?

---

## Phase 9 — Dependency health

Assess:

- **Lockfile present and committed**: already noted in Phase 4 — record here too.
- **Manifest vs. lockfile consistency**: if `package.json` has dependencies not in the lockfile, or vice versa, note it.
- **Undeclared imports**: sample 10–20 source files and check whether imports reference packages not in the manifest.
- **Private registry setup**: if a `.npmrc`, `.yarnrc.yml`, or `pip.conf` references a private registry, is it documented?
- **Dependency count**: note total direct + dev dependency count. Flag if > 100 direct dependencies (signal of potential bloat).
- **Known outdated tooling**: check if the declared Node/Python/etc. version is out of active support (Node < 18, Python < 3.9 as of 2026).

---

## Phase 10 — AI governance

Assess:

- **AGENTS.md / CLAUDE.md quality**: present? Covers: project purpose, tech stack, directory layout, conventions, how the agent should work? Word count > 200?
- **Accuracy**: does the governance doc match what you observe in the code? (Cross-check language, package manager, test framework claims.)
- **Installed skills**: is `.claude/skills/` or `.cursor/commands/` present? Are skills documented with names and descriptions?
- **AI conventions**: are there explicit rules about what the agent should/should not do autonomously?
- **Context documents**: are there any `*.md` files explicitly written to orient an AI agent vs. written for humans?

---

## Phase 11 — Contradiction detection

Cross-check claims made in documentation against what you observe in the code. For each contradiction, assign severity:

- **P0**: Blocks onboarding or causes incorrect agent behaviour (e.g. README says `npm install` but only `pnpm-lock.yaml` exists)
- **P1**: Likely to cause confusion or wasted effort
- **P2**: Minor inconsistency, low impact
- **P3**: Cosmetic / style mismatch

Examples to check:
- README setup instructions vs. actual package manager lockfile
- Stated Node/Python version vs. `.nvmrc` / `.python-version`
- Claimed architecture pattern vs. directory structure
- Documented test commands vs. scripts in `package.json`
- AGENTS.md technology claims vs. actual stack
- CI badge in README pointing to non-existent workflow

Collect all contradictions. Each one feeds into the score of its relevant dimension.

---

## Phase 12 — Score each dimension and write per-area markdown reports

### Scoring

Score each dimension 0–100. Apply these weights for the overall score:

| Dimension | Weight |
|-----------|--------|
| Documentation | 20% |
| Test Quality | 15% |
| Code Quality Infrastructure | 15% |
| Architecture | 15% |
| CI/CD & Delivery Conventions | 10% |
| Security Baseline | 10% |
| Observability | 5% |
| Dependency Health | 5% |
| AI Governance | 5% |

Overall score = weighted average. Grade: A (90–100), B (80–89), C (65–79), D (50–64), F (< 50).

### Scoring guidance per dimension

**Documentation (0–100)**
Start at 100. Deduct for each missing or stub document:
- README missing or < 100 words: −30
- README has no setup/install section: −10
- No architecture doc: −20
- No contributing guide: −15
- No onboarding guide: −10
- No testing doc: −10
- API docs missing (if the project has an API surface): −10
- No AI governance doc: −10 (more in Phase 10)
- Stub docs (< 100 words) count as 50% present

**Test Quality (0–100)**
- No tests at all: 0
- Test framework present but 0 tests: 10
- Tests present; apply distribution scoring:
  - unit ≥ 60% and e2e < 30%: +60
  - unit 40–59%: +40; unit < 40%: +20
  - e2e 30–50%: −10; e2e > 50%: −20
  - Zero integration layer: −10
- CI runs tests: +20
- Test pyramid definition documented: +10
- Coverage configured: +10

**Code Quality Infrastructure (0–100)**
- Linter configured: +25
- Formatter configured: +20
- Type checker in strict mode: +20
- Pre-commit hooks: +20
- Lockfile committed: +10
- Contradictions from Phase 11 related to tooling: deduct 5–15 each

**Architecture (0–100)**
- Detectable pattern: +30
- Pattern documented: +20
- No layer violations found in sample: +30
- Code matches architecture doc: +20
- Deduct for violations and mismatches

**CI/CD & Delivery Conventions (0–100)**
- CI pipeline exists: +25
- Tests run in CI: +20
- Lint/type-check in CI: +15
- Commit conventions enforced: +15
- PR template present: +10
- Branch strategy documented: +10
- Release pipeline: +5

**Security Baseline (0–100)**
- `.env.example` present: +20
- No secrets found in tracked files: +30 (deduct 15 per secret found, min 0)
- `.gitignore` covers secrets: +20
- Auth documented: +15
- Security scan in CI: +15

**Observability (0–100)**
- Logging configured with a library: +30
- Structured logging: +20
- Error handling patterns consistent: +20
- Health check endpoint: +15
- Monitoring/metrics configured: +10
- Runbooks present: +5

**Dependency Health (0–100)**
- Lockfile present: +30
- Manifest/lockfile consistent: +20
- No undeclared imports found in sample: +25
- Runtime version in active support: +15
- Private registry documented (if used): +10

**AI Governance (0–100)**
- AGENTS.md/CLAUDE.md present: +25
- Word count > 200: +15
- Covers tech stack and conventions: +20
- Accurate (no contradictions with code): +20
- Installed skills present: +10
- Explicit agent behaviour rules: +10

### Report format

Write one file per dimension. Assign gaps a priority:
- **P0**: Blocking — prevents onboarding, causes agent errors, or is a security risk
- **P1**: Important — causes confusion or wasted agent effort
- **P2**: Notable — good practice, meaningful improvement
- **P3**: Nice-to-have — polish

Create the directory `.sensible-harness/reports/assessment/<timestamp>/` and write these files:

```
00-overview.md
01-documentation.md
02-test-quality.md
03-code-quality-infra.md
04-architecture.md
05-ci-cd-conventions.md
06-security.md
07-observability.md
08-dependency-health.md
09-ai-governance.md
```

**`00-overview.md` format:**

```markdown
# Repository Assessment: Overview
**Repository**: <repo-name> | **Date**: <date> | **Overall Score**: <score>/100 (<grade>)

## Dimension Scores
| Dimension | Score | Grade | P0 Gaps | P1 Gaps |
|-----------|-------|-------|---------|---------|
| Documentation | 45 | D | 2 | 4 |
...

## Total Gaps: P0: N, P1: N, P2: N, P3: N

## Top Priorities
1. [Highest-impact P0 gap with one-sentence rationale]
2. ...
```

**Per-dimension report format:**

```markdown
# Assessment: <Dimension Name>
**Repository**: <repo-name> | **Date**: <date> | **Score**: <score>/100 (<grade>)

## Summary
[One-paragraph narrative of what was found]

## Present
- [x] <item found> — <brief note>
...

## Gaps
### P0 — Blocking
- **<gap title>** — <one-sentence finding>
  - Impact: <what this blocks or breaks>
  - Suggested ticket: "<title for BA agent>"

### P1 — Important
...

### P2 — Notable
...

## Contradictions
- <file:line> references X but Y is observed (P0/P1/P2/P3)

## Suggested Tickets (for BA agent)
| Title | Context | Acceptance Criteria |
|-------|---------|---------------------|
| <ticket title> | <one line of context> | <one measurable AC> |
```

---

## Phase 13 — Write assessment.json snapshot

Write (or append to) `.sensible-harness/assessment.json`. The file is a JSON array; append a new entry for this run. If the file does not exist, create it with a one-element array.

Entry schema:

```json
{
  "timestamp": "<ISO timestamp>",
  "repository": "<repo name — basename of cwd>",
  "overall": { "score": <number>, "grade": "<letter>" },
  "dimensions": {
    "documentation":          { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "test_quality":           { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "code_quality_infra":     { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "architecture":           { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "ci_cd_conventions":      { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "security":               { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "observability":          { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "dependency_health":      { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> },
    "ai_governance":          { "score": <n>, "grade": "<l>", "p0_gaps": <n>, "p1_gaps": <n> }
  },
  "total_gaps": { "p0": <n>, "p1": <n>, "p2": <n>, "p3": <n> },
  "reports_dir": ".sensible-harness/reports/assessment/<timestamp>/"
}
```

---

## Phase 14 — Regenerate assessment-summary.html

Write `.sensible-harness/assessment-summary.html`. This is a self-contained static HTML file — no external dependencies, all CSS and JS inline. Regenerate it from scratch on each run, embedding the full history from `assessment.json`.

The page must include:

1. **Hero section**: current overall score (large numeral) + letter grade + repo name + date.
2. **Dimension score bars**: one row per dimension. Each bar shows the current score (0–100), a trend indicator (↑ / ↓ / — vs. previous run, green/red/grey), and the dimension weight.
3. **Gap summary**: counts for P0 / P1 / P2 / P3 with delta vs. previous run.
4. **Run history table**: columns = date, overall score, grade, P0 count, P1 count, change summary (derived from score delta).
5. **Score history chart**: a simple sparkline or bar chart per dimension showing all historical scores. Use only inline SVG — no canvas, no Chart.js, no external libraries.
6. **Report links**: for the current run, a list of links to the per-area `.md` reports (relative paths).
7. **Footer**: "Generated by Sensible Harness assess-repo on `<timestamp>`".

Style requirements: dark mode friendly (use CSS variables), readable on a 1280px screen, no external fonts, monospace for scores and numbers, sans-serif for prose.

---

## Phase 15 — Generate setup-workspace skill

Read `.sensible-harness/manifest.json` to determine the selected platforms.

`setup-workspace` is a repo-specific skill that guides a developer (or agent) through setting up a local development environment from scratch. It is **not** a generic template — write it based on what you discovered in Phases 1–10.

The skill must cover, where applicable:
- Required runtime versions (from `.nvmrc`, `.tool-versions`, etc.)
- Package manager install command (exact, using the detected package manager)
- Any environment variable setup (reference `.env.example` if present)
- Database or service setup (if detected from docker-compose, service config, or documentation)
- Hook installation (`npm run prepare`, `pre-commit install`, etc.)
- IDE-specific setup (extensions, settings — if cursor.yaml is a target)
- How to run tests to verify the environment is working
- Any platform-specific notes (detected from CI config or README)

For each platform in the manifest, write to the correct location:

| Platform | Output path |
|----------|-------------|
| `claude-code` | `.claude/skills/setup-workspace/SKILL.md` |
| `cursor` | `.cursor/commands/setup-workspace.md` |

Format the skill as a markdown checklist the agent can execute step by step, with verification steps after each major action.

Record `setup-workspace` in `.sensible-harness/manifest.json` under a `generated` array:
```json
"generated": ["setup-workspace"]
```

---

## Phase 16 — Generate onboard-me skill

`onboard-me` is a repo-specific skill that orients a developer or AI agent to the codebase — what it does, how it's structured, where things live, and what the key workflows are. It is written based on what you discovered in Phases 1–10.

The skill must cover:
- **Project purpose**: one-paragraph description derived from README + code structure
- **Tech stack summary**: language, framework, runtime, package manager (from Phase 1)
- **Directory tour**: top-level directories and what each contains (from Phase 5 architecture analysis)
- **Key workflows**: how to run tests, how to build, how to start the dev server — exact commands
- **Contribution workflow**: branch naming, commit conventions, PR process (from Phase 6)
- **Architecture overview**: detected pattern and layer descriptions (from Phase 5)
- **Key domain concepts**: any domain model, glossary, or domain language found in Phase 2
- **Where things are**: a quick reference map — "auth lives in X", "API routes in Y", etc.
- **What the agent should NOT do autonomously**: extracted from AGENTS.md / CLAUDE.md if present

For each platform in the manifest, write to:

| Platform | Output path |
|----------|-------------|
| `claude-code` | `.claude/skills/onboard-me/SKILL.md` |
| `cursor` | `.cursor/commands/onboard-me.md` |

Record `onboard-me` in `.sensible-harness/manifest.json` under the `generated` array alongside `setup-workspace`.

---

## Completion

After all phases complete, print a summary:

```
Assessment complete.

Overall score: <score>/100 (<grade>)

Reports: .sensible-harness/reports/assessment/<timestamp>/
Dashboard: .sensible-harness/assessment-summary.html
Snapshot: .sensible-harness/assessment.json

Top 3 gaps:
  P0: <gap> (<dimension>)
  P0: <gap> (<dimension>)
  P1: <gap> (<dimension>)

Generated skills:
  setup-workspace → <path(s)>
  onboard-me      → <path(s)>

Feed the per-area reports to /business-analyst to create tickets for each gap.
```
