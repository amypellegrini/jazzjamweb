---
name: assess-repo
description: Use whenever the user asks to assess the repository, generate an engineering health report, score the codebase, or run the initial repository assessment after sensible-harness init. Scores the repo across 9 dimensions (documentation, test quality, code quality infrastructure, architecture, CI/CD, security, observability, dependency health, AI governance), writes per-dimension markdown reports to .sensible-harness/reports/assessment/<timestamp>/, updates an interactive HTML dashboard, and generates repo-specific setup-workspace and onboard-me skills for the selected platforms.
model: sonnet
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

Delegate to `/assess-documentation`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/01-documentation.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-documentation` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- Which doc classes are present vs. missing (feeds Phase 11 contradiction detection)

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

Delegate to `/assess-code-quality`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/03-code-quality-infra.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-code-quality` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- Which tooling is configured: linter, formatter, type checker, lockfile, pre-commit hooks (feeds Phase 11)

---

## Phase 5 — Architecture analysis

Delegate to `/assess-architecture`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/04-architecture.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-architecture` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- Detected pattern, layer violations found, whether code matches docs (feeds Phase 11)

---

## Phase 6 — CI/CD & delivery conventions

Delegate to `/assess-ci-cd`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/05-ci-cd-conventions.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-ci-cd` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- CI platform, gate coverage, delivery convention findings (feeds Phase 11)

---

## Phase 7 — Security baseline

Delegate to `/assess-security`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/06-security.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-security` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- Any secrets found (file:line, values redacted)

---

## Phase 8 — Observability

Delegate to `/assess-observability`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/07-observability.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-observability` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts

---

## Phase 9 — Dependency health

Delegate to `/assess-dependency-health`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/08-dependency-health.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-dependency-health` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- Lockfile status and runtime version verdict (feeds Phase 11)

---

## Phase 10 — AI governance

Delegate to `/assess-ai-governance`. Pass this context:

> "Running as part of /assess-repo full sweep. Write your markdown report to `.sensible-harness/reports/assessment/<timestamp>/09-ai-governance.md`. Do NOT update assessment.json — assess-repo will write the full snapshot at the end. Do NOT invoke /regenerate-dashboard — assess-repo will do that in Phase 14."

After `/assess-ai-governance` completes, extract from its output:
- Score (0–100) and P0/P1/P2/P3 gap counts
- Accuracy issues found (governance doc contradictions with code — feeds Phase 11)

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

## Phase 12 — Compute overall score and write 00-overview.md

Each dimension skill (Phases 2–10) has already written its per-dimension markdown report. Collect the scores and gap counts returned by each skill and compute the weighted overall score:

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

Apply contradiction penalties from Phase 11: deduct 5–15 points from the relevant dimension score for each confirmed contradiction (cap dimension score at 0).

### 00-overview.md format

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

Style requirements: readable on a 1280px screen minimum, no external fonts, monospace for scores and numbers, sans-serif for prose.

### Design system

The dashboard must use the Sensible Harness brand palette. Apply the following exactly.

**Brand palette:**

| Token | Hex | Role |
|-------|-----|------|
| Talc | `#FFFFFF` | Card / panel surface |
| Mist | `#EEF2F5` | Page canvas background |
| Onyx | `#050505` | Body text |
| Wave | `#003049` | Hero background, section headers, nav |
| Sapphire | `#2E8B9A` | Score bars, primary interactive |
| Jade | `#5F9B73` | Grade A / healthy / positive trend |
| Amethyst | `#5B4080` | Secondary accent, Grade B |
| Turmeric | `#CF8A0E` | Grade C / warning / P1 gaps |
| Flamingo | `#F05273` | Grade D–F / danger / P0 gaps |

**CSS variables (`:root`):**

```css
:root {
  --bg:           #EEF2F5;
  --surface:      #FFFFFF;
  --border:       #d0dae3;
  --brand:        #003049;
  --brand-light:  rgba(0,48,73,0.06);
  --sapphire:     #2E8B9A;
  --jade:         #5F9B73;
  --amethyst:     #5B4080;
  --turmeric:     #CF8A0E;
  --flamingo:     #F05273;
  --text:         #050505;
  --text-muted:   #4a6070;
  --text-dim:     #7a8f9e;
  --text-on-brand:#FFFFFF;
  --grade-a:      #5F9B73;
  --grade-b:      #2E8B9A;
  --grade-c:      #CF8A0E;
  --grade-d:      #F05273;
  --grade-f:      #c0392b;
  --font-mono:    'SF Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
  --font-sans:    -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
```

**Page layout:**

- `body`: Mist background, Onyx text, sans-serif, `margin: 0; padding: 0; -webkit-font-smoothing: antialiased;`
- Content wrapper: `max-width: 1100px; margin: 0 auto; padding: 0 1.5rem 4rem;`

**Hero section:**

Full-width Wave strip: `background: var(--brand); color: var(--text-on-brand); padding: 3rem 1.5rem 2.5rem;`

Inside hero (within max-width wrapper):
- Wordmark `"SENSIBLE HARNESS"`: `font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.35em; text-transform: uppercase; opacity: 0.5; display: block; margin-bottom: 1rem;`
- Repo name `<h1>`: `font-size: 2.2rem; font-weight: 800; margin: 0 0 0.25rem;`
- Date: `font-family: var(--font-mono); font-size: 0.85rem; opacity: 0.6;`
- Score block (to the right on desktop, stacked on mobile): Large score numeral `font-size: 5rem; font-weight: 800; font-family: var(--font-mono); line-height: 1;` + letter grade `font-size: 1.5rem; font-weight: 700; margin-left: 0.5rem; align-self: flex-end; padding-bottom: 0.5rem;`
  - Grade colours applied as `color`:  A→`var(--grade-a)`, B→`var(--grade-b)`, C→`var(--grade-c)`, D→`var(--grade-d)`, F→`var(--grade-f)`

**Section cards:**

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1.75rem;
  margin-top: 1.5rem;
  box-shadow: 0 1px 4px rgba(0,48,73,0.07);
}
.card h2 {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--brand);
  margin: 0 0 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--brand-light);
}
```

**Dimension score bars:**

```css
.dim-row   { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.dim-name  { font-size: 0.85rem; width: 220px; flex-shrink: 0; color: var(--text); }
.dim-track { background: var(--bg); border-radius: 6px; height: 16px; overflow: hidden; flex: 1; }
.dim-fill  { height: 100%; border-radius: 6px; background: var(--sapphire); }
.dim-score { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; width: 36px; text-align: right; color: var(--text); }
.dim-trend { font-size: 0.8rem; width: 20px; text-align: center; }
.dim-trend.up   { color: var(--jade); }
.dim-trend.down { color: var(--flamingo); }
.dim-trend.flat { color: var(--text-dim); }
.dim-weight { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-dim); width: 32px; text-align: right; }
```

Bar fill colour varies by score: ≥80 → `var(--jade)`; 65–79 → `var(--sapphire)`; 50–64 → `var(--turmeric)`; <50 → `var(--flamingo)`. Set with an inline `style="background: <colour>;"` on `.dim-fill`.

**Gap summary:**

Four pill counters side by side:
```css
.gap-pills { display: flex; gap: 1rem; flex-wrap: wrap; }
.gap-pill  {
  display: flex; flex-direction: column; align-items: center;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 8px; padding: 0.75rem 1.25rem; min-width: 80px;
}
.gap-pill .count { font-family: var(--font-mono); font-size: 2rem; font-weight: 800; line-height: 1; }
.gap-pill .label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 0.25rem; color: var(--text-muted); }
.gap-pill .delta { font-family: var(--font-mono); font-size: 0.72rem; margin-top: 0.2rem; }
```

P0 count colour: `var(--flamingo)`; P1: `var(--turmeric)`; P2: `var(--sapphire)`; P3: `var(--text-muted)`.
Delta: positive (more gaps) → flamingo; negative (fewer gaps) → jade; zero → dim.

**Run history table:**

```css
table { width: 100%; border-collapse: collapse; font-size: 0.83rem; }
thead th {
  background: var(--brand);
  color: rgba(255,255,255,0.7);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.65rem 0.85rem;
  text-align: left;
}
tbody tr:nth-child(even) { background: var(--bg); }
tbody tr:hover            { background: rgba(0,48,73,0.04); }
tbody td { padding: 0.55rem 0.85rem; border-bottom: 1px solid var(--border); }
```

Grade cells: wrap grade letter in `<span class="grade grade-X">` where X is A/B/C/D/F, styled:
```css
.grade { font-family: var(--font-mono); font-weight: 800; font-size: 0.9rem; }
.grade-A { color: var(--grade-a); } .grade-B { color: var(--grade-b); }
.grade-C { color: var(--grade-c); } .grade-D { color: var(--grade-d); }
.grade-F { color: var(--grade-f); }
```

**Score history chart (inline SVG):**

One SVG sparkline per dimension. Each line uses stroke colour matching the bar fill rule above (jade/sapphire/turmeric/flamingo). Background rect: Mist (`#EEF2F5`). Grid lines: `stroke: #d0dae3; stroke-width: 1`. Data polyline: `stroke-width: 2; fill: none`. Dot markers at each data point: `r="3"`, same colour as line.

**Report links:**

A grid of link cards:
```css
.link-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
.link-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 0.75rem 1rem; text-decoration: none; color: var(--brand);
  font-size: 0.82rem; font-weight: 600; transition: border-color 0.15s;
}
.link-card:hover { border-color: var(--sapphire); }
```

**Footer:**

`font-size: 0.75rem; color: var(--text-dim); text-align: center; margin-top: 4rem; padding-top: 1rem; border-top: 1px solid var(--border);`

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
