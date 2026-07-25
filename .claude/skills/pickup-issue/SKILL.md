---
name: pickup-issue
description: Use whenever the user asks to start work on a specific issue ("pick up issue #N", "let's tackle SH-42", "take this one"). Detects the configured issue tracker from .sensible-harness/manifest.json and routes to the GitHub (gh CLI) or Jira (ACLI) workflow. Validates the issue against the project checklist, creates the feature branch, syncs the issue to "In Progress" on the active board, and gates implementation behind plan-mode approval. Invoked as the first step of the /dev orchestrator's composition; also invocable directly by humans.
model: haiku
---

# Pickup issue

Apply these steps whenever invoked to start work on an issue. The skill reads `.sensible-harness/manifest.json` to detect the configured issue tracker, then routes to the GitHub or Jira workflow. It validates the issue, creates a feature branch, syncs the issue to "In Progress" on the active board, and gates implementation behind plan-mode approval.

The `/dev` orchestrator invokes this as its first composed step; humans can also invoke it directly.

## Step 0 — detect the issue tracker

```bash
cat .sensible-harness/manifest.json
```

Check the `issueTracker` field:

- `"github"` → follow the **GitHub workflow** (steps 1–7 below).
- `"jira"` → follow the **Jira workflow** (steps 1–7 below).
- Missing or `null` → **stop**. Ask the user to configure the tracker first: `sensible-harness issue-tracker <github|jira>`.

---

## GitHub workflow

### Step 1 — fetch the issue

Run `gh issue view <number>` to read the issue. If the current directory's `origin` points at a different repo than where the issue lives, pass `--repo <owner>/<name>` explicitly — do **not** silently repoint `origin`.

### Step 2 — validate understanding and quality

Before any branch or code work:

- Summarise the issue back to the user in your own words to confirm you understand it correctly.
- Check the issue body for the sections this repo expects — typically Context, Scope (sketch), Acceptance criteria / out-of-scope, Manual verification, Dependencies / related. Flag any that are missing or weak.
- Ask any clarifying questions — do **not** proceed until the user confirms understanding is correct and all questions are resolved.
- If the issue is missing required sections, suggest improvements and ask the user whether to update the issue (via `/business-analyst #N` review) before continuing.

### Step 3 — sync `main` and create the feature branch

- `git pull origin main` to ensure the base is current.
- `git checkout -b feature/<issue-number>-<short-description>` — the issue number prefix is load-bearing; downstream skills (`/tdd`, `close-issue`) infer the driving issue from it.

### Step 4 — sync the issue to "In Progress" on the active project board

GitHub Projects rotate as milestones change. Never hard-code project numbers, IDs, or field IDs — resolve them fresh every time.

- Determine the project owner. Default to the repo's owner: `owner=$(gh repo view --json owner -q .owner.login)`. If projects live on a different user/org (e.g. a personal project tracking issues from an org repo), ask the user which owner to use.
- List open projects: `gh project list --owner "$owner" --format json` (filter to `closed: false` in the JSON).
- If **no open projects** exist, skip this step — the issue stays in the default backlog. Note it in the final report.
- If **exactly one** open project exists, use it.
- If **more than one** open project exists, ask the user via `AskUserQuestion` which is the active roadmap project for this repo before proceeding.
- Fetch the chosen project's field IDs fresh: `gh project field-list <number> --owner "$owner" --format json` — capture the **Status** field ID and the **"In Progress"** option ID.
- Add the issue to the project: `gh project item-add <number> --owner "$owner" --url <issue-url> --format json` — capture the returned item `id`.
- Set the status:
  ```
  gh project item-edit \
    --project-id <project-id> \
    --id <item-id> \
    --field-id <status-field-id> \
    --single-select-option-id <in-progress-option-id>
  ```

### Step 5 — verify the project sync (only when step 4 ran)

Re-fetch the issue: `gh issue view <number> --json projectItems` — confirm the project title matches and the status is **"In Progress"** before proceeding.

### Step 6 — plan-mode gate

You **MUST NOT** do any implementation work until the user has explicitly approved the implementation plan. Read relevant code, research the codebase, and create a thorough plan. How you surface it depends on how you were invoked:

- **Direct human invocation (top-level session)** — enter plan mode. Do **NOT** exit plan mode until the user has reviewed and approved the plan.
- **Subagent invocation (via the Agent tool, e.g. from the `/dev` orchestrator)** — there is no plan-mode UI in a subagent context; the only mid-run prompt that reaches the human is `AskUserQuestion`. Present the plan (or a clear summary of it) via `AskUserQuestion` with two options — **Approve plan** and **Request changes** — and block on the answer. On **Request changes**, revise the plan from the feedback and ask again. Do **NOT** write any code until the answer is **Approve plan**.

This is the single most load-bearing pause in the workflow. The orchestrator (or a human) decides next steps once the plan is approved.

### Step 7 — implement (after plan approval)

Exit plan mode (or, in a subagent context, proceed after the `AskUserQuestion` approval) and implement. When invoked via the `/dev` orchestrator, the agent then loops `/tdd` once per acceptance criterion. When invoked directly by a human, the human drives the implementation themselves.

Make atomic commits using Conventional Commits 1.0.0 — defer to the `commit` skill for the rules. Each commit should address a single concern.

---

## Jira workflow

### Step 1 — fetch the issue

Run `acli jira workitem view <KEY>` (e.g. `acli jira workitem view SH-42`). If `acli` is not installed or not authenticated, stop and surface the gap:

- Not installed: follow https://developer.atlassian.com/cloud/acli/guides/install-acli/
- Not authenticated: `acli jira auth login --web` (or `--site <site> --email <email> --token` with an API token)

### Step 2 — validate understanding and quality

Before any branch or code work:

- Summarise the issue back to the user in your own words to confirm you understand it correctly.
- Check the issue body for the sections this repo expects — typically Context, Scope (sketch), Acceptance criteria / out-of-scope, Manual verification, Dependencies / related. Flag any that are missing or weak.
- Ask any clarifying questions — do **not** proceed until the user confirms understanding is correct and all questions are resolved.
- If the issue is missing required sections, suggest improvements and ask the user whether to update the issue (via `/business-analyst <KEY>` review) before continuing.

### Step 3 — sync `main` and create the feature branch

- `git pull origin main` to ensure the base is current.
- `git checkout -b feature/<issue-key>-<short-description>` — the issue key prefix is load-bearing; downstream skills infer the driving issue from it. Example: `feature/SH-42-add-jira-skill`.

### Step 4 — assign the issue to yourself and move to "In Progress"

Assign to yourself:

```bash
acli jira workitem assign --key <KEY> --assignee "@me"
```

`@me` self-assigns using the authenticated account. To assign someone else, pass their email or account ID: `acli jira workitem assign --key <KEY> --assignee <email-or-account-id>`.

`acli` transitions by target status name directly — there is no separate "list transitions" subcommand:

```bash
acli jira workitem transition --key <KEY> --status "In Progress" --yes
```

Names vary by board (e.g. `"Start Progress"`, `"In Development"`, `"In Progress"`). If the transition fails with `No allowed transitions found for given status`, the name doesn't match this board's workflow — confirm the current status (`acli jira workitem view <KEY> --fields status`) and check the exact status name in the Jira web UI (`acli jira workitem view <KEY> --web`) rather than guessing repeatedly.

### Step 5 — verify the board sync

Re-fetch the issue: `acli jira workitem view <KEY> --fields "status,assignee"` — confirm **assignee** is you and **status** reflects "In Progress" before proceeding.

### Step 6 — plan-mode gate

You **MUST NOT** do any implementation work until the user has explicitly approved the implementation plan. Read relevant code, research the codebase, and create a thorough plan. How you surface it depends on how you were invoked:

- **Direct human invocation (top-level session)** — enter plan mode. Do **NOT** exit plan mode until the user has reviewed and approved the plan.
- **Subagent invocation (via the Agent tool, e.g. from the `/dev` orchestrator)** — there is no plan-mode UI in a subagent context; the only mid-run prompt that reaches the human is `AskUserQuestion`. Present the plan (or a clear summary of it) via `AskUserQuestion` with two options — **Approve plan** and **Request changes** — and block on the answer. On **Request changes**, revise the plan from the feedback and ask again. Do **NOT** write any code until the answer is **Approve plan**.

This is the single most load-bearing pause in the workflow. The orchestrator (or a human) decides next steps once the plan is approved.

### Step 7 — implement (after plan approval)

Exit plan mode (or, in a subagent context, proceed after the `AskUserQuestion` approval) and implement. When invoked via the `/dev` orchestrator, the agent then loops `/tdd` once per acceptance criterion. When invoked directly by a human, the human drives the implementation themselves.

Make atomic commits using Conventional Commits 1.0.0 — defer to the `commit` skill for the rules. Each commit should address a single concern.
