---
name: assess-test-pyramid
description: Use whenever the user asks to assess the test pyramid, audit test distribution, check for ice-cream-cone or hourglass anti-patterns, or generate a static report on the unit/integration/e2e balance. First locates the project's own test-pyramid definition (TESTING.md, CONTRIBUTING.md testing section, ADR, etc.) — recommends creating one if absent. Then classifies each test against the project's layer definitions, computes percentages, and emits a self-contained HTML report at .claude/reports/test-pyramid-<timestamp>.html with an auditable per-test classification table and threshold-driven recommendations.
model: sonnet
---

# Assess test pyramid

Scan this repo's test suite, classify each test by pyramid layer, compute the percentage breakdown, and emit an HTML report at `.claude/reports/test-pyramid-<timestamp>.html`. The report's purpose is to surface anti-patterns ("ice cream cone", "hourglass") at a glance and hand the team auditable per-test classifications they can disagree with.

This is **static classification only** — do not run the tests. Cover the host project's primary language; if the repo is multi-language, ask the user which language to assess and document the choice in the report.

## 1. Locate the project's test-pyramid definition

Before classifying anything, find the document that defines what counts as each layer **for this project**. Each codebase has its own conventions — what "integration" means here, where the boundary sits, what runtime each layer is allowed to touch. Don't impose generic definitions; impose the project's own.

Look for, in order:

- A dedicated `TESTING.md`, `docs/testing.md`, `docs/test-pyramid.md`, `docs/testing/pyramid.md`, or similar.
- A "Testing", "Test pyramid", or "Test layers" section in `CONTRIBUTING.md` or `README.md`.
- An ADR (`docs/adr/*`, `docs/decisions/*`) that pins the test layers.
- Project-internal conventions referenced from `package.json` `scripts`, `pytest.ini`, or test-runner config files (sometimes the layer mapping lives there as a comment).

**If you find a definition:**

- Summarise the layer names and definitions back to the user before scanning. Confirm you've parsed it correctly.
- Use the project's layer names (don't translate "component" → "integration" silently — preserve the project's vocabulary in the report).
- Apply the project's folder / framework / runtime mappings as the **primary** classification signal. The heuristics in §3 become an internal toolset for *applying* those mappings, plus a fallback for tests the doc doesn't pin.

**If you don't find a definition:**

- **Stop and recommend creating one before generating a report.** Without project-specific definitions, the classification is guesswork dressed up as data, and the report will mislead.
- Offer to draft a starter pyramid doc at `docs/test-pyramid.md` based on the test runners and folder layout you observe — capturing what's there today as the documented baseline rather than inventing new conventions.
- The user may explicitly opt to proceed without a definition (e.g. "just give me a rough read"). If so:
  - Use the generic heuristics in §3 as the sole signal.
  - Mark this in the report header: "No project test-pyramid definition found; classified using generic heuristics."
  - Surface the offer to draft `docs/test-pyramid.md` again at the end.

## 2. Discover the test suite

Defer to the host project's existing convention. Look for, in order:

- A `test/`, `tests/`, `__tests__/`, or `spec/` directory at the repo root.
- A test runner declared in `package.json` (`scripts.test`, `vitest.config.*`, `jest.config.*`, `playwright.config.*`) — follow its `testMatch` / `testDir` if specified.
- For Python: `pytest.ini`, `pyproject.toml` `[tool.pytest.ini_options]`, or `tests/`.
- For Go: `_test.go` files alongside source.
- For Rust: `tests/` directory and `#[cfg(test)]` blocks.

If multiple plausible locations exist (e.g. both `test/` and `tests/`), or no obvious convention, **ask the user** before scanning. Do not silently pick.

## 3. Classify each test

When the project has a pyramid definition (§1), apply *its* mappings first — folder rules, framework rules, runtime constraints, layer names — and use the heuristics below only to fill gaps the doc doesn't address.

When proceeding without a project definition (user opt-in only), apply these heuristics in order — the first that fires wins:

1. **File path** — strongest signal.
   - Path contains `/unit/` or `.unit.` → **unit**.
   - Path contains `/integration/`, `/int/`, or `.integration.` → **integration**.
   - Path contains `/e2e/`, `/end-to-end/`, `.e2e.`, `/playwright/`, or `/cypress/` → **e2e**.

2. **Framework signal** — declared imports / runners.
   - Imports `@playwright/test`, `cypress`, `puppeteer`, or `selenium-webdriver` → **e2e**.
   - Imports `supertest`, `testcontainers`, or boots a real database / HTTP server → **integration**.
   - Pure `vitest` / `jest` / `node:test` / `pytest` / Go `testing` / Rust `#[test]` with no integration signals → **unit** (provisional; later heuristics may reclassify).

3. **Test description / `describe` prefix** — `describe("e2e: …")`, `describe("integration: …")`, `it.skip("[unit] …")`, etc. Only use this when the path and framework signals are ambiguous.

4. **Test duration**, when available from a recent test report. Long-running tests (multi-second) are usually integration or e2e; sub-millisecond tests are usually unit. Treat as a tiebreaker only.

### Resolving ambiguity

When stacked heuristics give conflicting signals, or no signal lands cleanly: **ask the user**. Show the file and the conflicting signals; let them pick the layer.

**Default fallback** (use only when the user is unavailable, e.g. non-interactive runs): classify as **unit**. Surface every fallback decision in the report's classification table so the user can audit and correct.

## 4. Compute percentages

Total = number of test cases (not test files). For each layer, percentage = `count / total * 100`, rounded to one decimal place. If the suite has zero tests, write a report that says so explicitly and skip the recommendations section.

Use the project's layer names where a definition exists. Otherwise default to `unit` / `integration` / `e2e`.

## 5. Generate the HTML report

Write to `.claude/reports/test-pyramid-<timestamp>.html` where `<timestamp>` is a filesystem-safe ISO-like value (e.g. `2026-05-08T14-30-00Z`). Create the directory if missing — it's gitignored.

The report **must contain** these sections, in this order:

1. **Header** — project name (from `package.json` / `pyproject.toml` / fallback to repo dir name), generation timestamp, total test count, and the source of the layer definitions (e.g. "Layer definitions: `docs/test-pyramid.md`" or "No project test-pyramid definition found; classified using generic heuristics.").
2. **Distribution** — percentage per layer, rendered as a horizontal bar (CSS only, no external assets) and a small table. Make the bar visually obvious — pyramid health is the headline.
3. **Recommendations** — derived from the thresholds below. If the distribution is healthy, say so explicitly.
4. **Per-test classification table** — every test, with columns: file path, test name, classified layer, signal that triggered the classification (e.g. "doc: `tests/integration/` rule", "path: /e2e/", "framework: @playwright/test", "user: confirmed", "fallback: default"). This is the auditable artifact; do not omit it.

The HTML must be self-contained: inline `<style>`, no external scripts, no CDN dependencies. It should open correctly via `file://` in any modern browser.

### HTML design system

The report must use the following brand palette and feel polished enough to share with a team. Apply the following design system exactly — do not use generic Bootstrap-style greys or flat colours.

**Brand palette (from `src/banner.ts` — do not deviate):**

| Token | Hex | Role |
|-------|-----|------|
| Talc | `#FFFFFF` | Page background, card surface |
| Mist | `#EEF2F5` | Page canvas, alternating rows |
| Onyx | `#050505` | Body text |
| Wave | `#003049` | Hero / header background, primary brand anchor |
| Sapphire | `#2E8B9A` | Primary interactive colour, unit layer bar |
| Jade | `#5F9B73` | Success / healthy state |
| Amethyst | `#5B4080` | Integration layer bar, secondary accent |
| Turmeric | `#CF8A0E` | Warning (ice-cream cone, hourglass) |
| Flamingo | `#F05273` | Danger / critical (thin foundation), E2E layer bar |

**CSS variables to declare in `:root`:**

```css
:root {
  --bg:          #EEF2F5;
  --surface:     #FFFFFF;
  --border:      #d0dae3;
  --brand:       #003049;
  --brand-light: rgba(0,48,73,0.06);
  --sapphire:    #2E8B9A;
  --jade:        #5F9B73;
  --amethyst:    #5B4080;
  --turmeric:    #CF8A0E;
  --flamingo:    #F05273;
  --text:        #050505;
  --text-muted:  #4a6070;
  --text-dim:    #7a8f9e;
  --text-on-brand: #FFFFFF;
  --success:     #5F9B73;
  --warning:     #CF8A0E;
  --danger:      #F05273;
  --font-mono:   'SF Mono', 'Cascadia Code', 'Fira Code', ui-monospace, monospace;
  --font-sans:   -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
```

**Page shell:**

- `body`: `background: var(--bg); color: var(--text); font-family: var(--font-sans); margin: 0; padding: 0; -webkit-font-smoothing: antialiased;`
- Content wrapper: `max-width: 960px; margin: 0 auto; padding: 0 1.5rem 3rem;`

**Header / hero:**

Full-width hero strip with `background: var(--brand); color: var(--text-on-brand); padding: 2.5rem 1.5rem 2rem;`

Inside the hero (centred within the `max-width` wrapper):
- Wordmark: `"QA ASSESSMENT"` in `font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.55; margin-bottom: 0.75rem;`
- Report title `<h1>`: `font-size: 2rem; font-weight: 700; margin: 0 0 1rem; line-height: 1.2;` in white
- Metadata chips row (project name · timestamp · total tests · definition source) — each chip: `display: inline-block; background: rgba(255,255,255,0.12); border-radius: 4px; padding: 0.2rem 0.6rem; font-family: var(--font-mono); font-size: 0.72rem; margin-right: 0.4rem; margin-bottom: 0.4rem;` in white

**Section cards:**

Each major section (Distribution, Recommendations, Classification table) lives in a card:
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.75rem;
  margin-bottom: 1.5rem;
  margin-top: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,48,73,0.06);
}
.card h2 {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--brand);
  margin: 0 0 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--brand-light);
}
```

**Distribution bars:**

Each layer gets a labelled horizontal bar coloured by role in the pyramid:
- Unit (base layer): `background: var(--sapphire);`
- Integration (mid layer): `background: var(--amethyst);`
- E2E / top layer: `background: var(--flamingo);`

```css
.bar-row   { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.9rem; }
.bar-label { font-family: var(--font-mono); font-size: 0.82rem; width: 130px; color: var(--text-muted); }
.bar-track { background: var(--bg); border-radius: 6px; height: 18px; overflow: hidden; flex: 1; }
.bar-fill  { height: 100%; border-radius: 6px; }
.bar-pct   { font-family: var(--font-mono); font-size: 0.82rem; width: 46px; text-align: right; font-weight: 600; color: var(--text); }
```

**Recommendations:**

Each diagnosis is a left-bordered callout. Colour signals severity:
- Healthy: `border-left: 4px solid var(--jade); background: rgba(95,155,115,0.07);`
- Warning (ice-cream cone, hourglass): `border-left: 4px solid var(--turmeric); background: rgba(207,138,14,0.07);`
- Critical (thin foundation): `border-left: 4px solid var(--flamingo); background: rgba(240,82,115,0.07);`

```css
.callout       { padding: 1rem 1.25rem; border-radius: 0 6px 6px 0; margin-bottom: 0.75rem; }
.callout-title { font-weight: 700; font-size: 0.9rem; margin: 0 0 0.3rem; }
.callout-body  { font-size: 0.85rem; color: var(--text-muted); margin: 0; line-height: 1.55; }
```

**Classification table:**

```css
table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
thead th {
  background: var(--brand);
  color: rgba(255,255,255,0.75);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0.65rem 0.85rem;
  text-align: left;
}
tbody tr:nth-child(even) { background: var(--bg); }
tbody tr:hover            { background: rgba(0,48,73,0.04); }
tbody td {
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
  color: var(--text);
}
```

Layer badge (inline `<span>` in the Classified Layer column):
```css
.badge {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-unit        { background: rgba(46,139,154,0.12); color: var(--sapphire); }
.badge-integration { background: rgba(91,64,128,0.12);  color: var(--amethyst); }
.badge-e2e         { background: rgba(240,82,115,0.12); color: var(--flamingo); }
.badge-fallback    { background: rgba(74,96,112,0.10);  color: var(--text-muted); }
```

Signal source column: `font-family: var(--font-mono); font-size: 0.73rem; color: var(--text-dim);`

**Footer:**

`font-size: 0.75rem; color: var(--text-dim); text-align: center; margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);`
Include: "Generated by assess-test-pyramid on `<timestamp>`"

## 6. Apply the recommendation thresholds

If the project's pyramid definition includes its own thresholds or target distribution (e.g. "we aim for 70/20/10"), use those — preserve the team's stated targets in the report. Otherwise, fall back to these generic rules:

| Condition | Diagnosis | Recommendation |
| --- | --- | --- |
| Base layer ≥ 60% | Healthy base | Maintain; no action. |
| Base layer < 30% | Thin foundation | Expand base-layer coverage of pure logic before adding higher-layer tests. |
| Top layer > 30% | Ice cream cone | Push tests down — convert top-layer assertions into mid- / base-layer where possible. |
| Mid layer < 10% AND top layer ≥ 10% | Hourglass / gap | Fill the middle layer — likely paying top-layer flake costs for behaviour a mid-layer test would cover faster. |

The "base / mid / top" terminology maps to the project's layer names — translate when emitting the report. Multiple conditions can fire simultaneously; list each diagnosis separately.

## 7. Out of scope (do not do these)

- **Don't run the tests.** No `npm test`, `pytest`, etc. Static classification only.
- **Don't change the test code** — no auto-generation of unit tests, deletion of e2e tests, refactors. Recommendations only.
- **Don't compare to a previous report.** Point-in-time analysis only; trend tracking is a separate concern.
- **Don't compute coverage.** That's a different signal and a different skill.
- **Don't classify across languages in a single report.** Ask the user to pick one language for multi-language repos.
- **Don't invent layer definitions** when the project doesn't have one. Recommend creating one instead.

## 8. After writing the report

Tell the user:

- The exact path of the report.
- The source of the layer definitions (project doc path, or "generic heuristics — no project definition found").
- The headline distribution using the project's layer names (e.g. "Unit 42% / Integration 8% / E2E 50%").
- Top diagnosis if any (e.g. "Ice cream cone — top layer exceeds 30%.").
- That the per-test classification table is auditable and they should challenge any rows that look wrong.

Do **not** open the file in a browser automatically; just print the path.
