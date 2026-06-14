---
name: assess-pre-commit
description: Use whenever the user asks to check whether pre-commit hooks are configured, audit what local quality gates are enforced before a commit lands, or assess whether those gates can be bypassed. Detects hook frameworks (pre-commit, husky, lefthook, lint-staged), classifies what each hook enforces, checks for bypassability, and writes a plain-language markdown report at .sensible-harness/reports/assess-pre-commit-<timestamp>.md.
---

# Assess pre-commit hygiene

Scan this repo's local quality gate setup, classify what each hook enforces, assess whether gates can be trivially bypassed, and write a plain-language markdown report at `.sensible-harness/reports/assess-pre-commit-<timestamp>.md`. The report's purpose is to show the team what guardrails exist before a commit reaches the shared branch, where the gaps are, and whether any gate is only theatrical (bypassable with a single flag).

This is a **static, read-only assessment** — do not install hooks, modify configuration, or run any hook scripts. Recommendations only.

## 1. Locate the project's pre-commit documentation

Before scanning configuration files, look for a document that states which local gates are mandatory for this project.

Look for, in order:

- A "Pre-commit", "Git hooks", or "Local development setup" section in `CONTRIBUTING.md` or `README.md`.
- A dedicated `docs/hooks.md`, `docs/pre-commit.md`, or similar.
- An ADR or decision doc that specifies which hooks developers must install.

**If you find documentation:**

- Summarise the stated requirements before scanning.
- Judge gaps against those requirements, not generic expectations.

**If you don't find documentation:**

- Surface the absence. Two options:
  - **Recommend documenting the hook setup first** — offer to draft a starter "Contributing — local setup" section based on what you find.
  - **Proceed on generic heuristics (explicit opt-in)** — mark the report header: "No pre-commit policy document found; assessed using generic heuristics."
- Do not proceed silently on generic defaults.

## 2. Detect hook frameworks

Scan the repo for evidence of a hook framework. Look for:

| Location / file | Framework |
|---|---|
| `.pre-commit-config.yaml` | pre-commit (Python framework, widely cross-language) |
| `.husky/` directory | Husky (Node.js projects) |
| `lint-staged` key in `package.json` | lint-staged (often paired with Husky) |
| `.lefthook.yml` or `lefthook.yml` | Lefthook |
| `.git-hooks/` or `git-hooks/` directory | Custom scripts |
| `.git/hooks/` | Directly committed hooks (uncommitted — note this explicitly) |
| `Makefile` target named `install-hooks` or similar | Manual setup pattern |

If **no hook framework is found**, that is the primary finding. Report it clearly; skip the rest of the classification. Record it as a gap.

Note: hooks in `.git/hooks/` are not committed to the repo and therefore not enforced for all contributors. If the only hooks found are uncommitted, flag this explicitly — a hook that only one developer has installed is not a team gate.

## 3. Classify what each hook enforces

For each hook found, identify which gate category it belongs to:

| Category | Examples |
|---|---|
| **Format** | prettier, black, gofmt, rustfmt, shfmt |
| **Lint** | eslint, ruff, golangci-lint, shellcheck, markdownlint |
| **Typecheck** | tsc --noEmit, mypy, pyright |
| **Test** | runs a test suite (e.g. jest --onlyFailures, pytest) |
| **Commit message** | commitlint, commitizen, conventional-commits check |
| **Secrets scan** | gitleaks, detect-secrets, truffleHog |

Use hook names, scripts, and the frameworks' configuration as signals. When a hook's purpose isn't clear from its name alone, read the `entry` or `run` field to determine what it executes.

Record:

- Which categories have at least one hook.
- Which categories have no hook at all.
- For each hook: the framework it belongs to, the gate category, and what tool or script it runs.

## 4. Assess bypassability

Local hooks can be skipped with `git commit --no-verify`. This is sometimes intentional (emergency fix), sometimes dangerous (common workaround for slow hooks). Assess:

- **Is `--no-verify` mentioned in docs?** If it appears in `CONTRIBUTING.md` or a runbook as an approved escape hatch, note that.
- **Are hooks also enforced in CI?** If CI runs the same checks (lint, format, typecheck), bypassing the hook locally doesn't permanently escape the gate — the PR will still fail. This is "defence-in-depth." If CI does *not* run the same checks, a bypassed hook means the gate disappears entirely.
- **Slow hooks** — if any hook runs the full test suite or a noticeably expensive command, flag it. Slow hooks are commonly bypassed in practice because developers can't afford to wait. Recommend scoping them (e.g. only run tests for changed files) rather than removing them.

## 5. Write the report

Write to `.sensible-harness/reports/assess-pre-commit-<timestamp>.md` where `<timestamp>` is a filesystem-safe ISO-like value (e.g. `2026-05-08T14-30-00Z`). Create the directory if missing — it's gitignored.

Use plain language throughout. Describe what each hook *does* in terms of what it prevents or enforces, not its implementation detail. Technical specifics (tool names, config keys) belong in parentheses or a detail table.

**Report structure:**

```markdown
# Pre-commit Hygiene Report — <project name>
**Generated:** <timestamp>
**Frameworks detected:** <name(s), or "None">
**Policy document:** <path, or "None found — assessed using generic heuristics">

## At a glance

| Gate | Status |
|---|---|
| Format | ✅ Enforced / ❌ Not enforced |
| Lint | ... |
| Typecheck | ... |
| Test | ... |
| Commit message | ... |
| Secrets scan | ... |

**Hooks committed to repo:** Yes / No (found only in .git/hooks/)
**Defence-in-depth (also in CI):** Yes / Partial / No

## Findings

### <Finding title>
**Observation:** <What was found, in plain English>
**Business impact:** <Why it matters>
**Recommendation:** <What to do>

...

## What's working well
<Acknowledge gates that are covered — always include this if anything is enforced>

## Hook inventory
<Table: hook name, framework, gate category, tool/script, bypassable-in-CI>
```

If all gate categories are covered and hooks are committed to the repo, the findings section should say so explicitly. A clean bill of health is a valid result.

## 6. Out of scope

- Do not install or configure any hooks.
- Do not run any hook scripts.
- Do not assess whether hooks are *fast enough* in absolute terms — only flag hook speed as a bypassability risk if the hook is obviously expensive (e.g. runs the full test suite).
- Do not compare against a previous report — point-in-time only.

## 7. After writing the report

Tell the user:

- The exact report path.
- Whether a policy document was found or generic heuristics were used.
- The at-a-glance gate table (copy it inline).
- Any gaps or bypassability concerns, each in one sentence.
- That the hook inventory is auditable and they should flag misclassifications.
