---
name: jira
description: Use whenever you need to interact with Jira issues via the CLI — pick up an issue (assign to yourself, transition to In Progress), add comments, change board status, or search issues. Reference for acli (Atlassian's official CLI) developer workflow commands. Active when .sensible-harness/manifest.json has issueTracker=jira.
model: haiku
---

# Jira

Developer workflow reference for interacting with Jira issues via `acli` — Atlassian's official CLI. Use these commands when `.sensible-harness/manifest.json` has `"issueTracker": "jira"`.

## Prerequisites

```bash
acli --version           # confirm ACLI is installed
acli jira auth status     # prints the authenticated site + account; failure = not authenticated
```

If not installed: follow https://developer.atlassian.com/cloud/acli/guides/install-acli/
If not authenticated: `acli jira auth login --web` (or `--site <site> --email <email> --token` with an API token piped via stdin)

## Pick up an issue

Picking up means: fetch the issue, confirm understanding, assign to yourself, and transition to "In Progress".

### Fetch

```bash
acli jira workitem view <KEY>
```

Output includes summary, description, status, and assignee. Use this to validate quality — check for Context, Scope, Acceptance criteria, Out of scope, Dependencies sections. Add `--json` for machine-readable output, or `-f "summary,description,status,assignee,comment"` to control which fields come back.

### Assign to yourself

```bash
acli jira workitem assign --key <KEY> --assignee "@me"
```

`@me` self-assigns using the authenticated account — no need to look up an account ID. To assign to someone else, pass their email or account ID: `acli jira workitem assign --key <KEY> --assignee <email-or-account-id>`.

### Transition to "In Progress"

`acli` transitions by target status name directly — there is no separate "list transitions" step:

```bash
acli jira workitem transition --key <KEY> --status "In Progress" --yes
```

If this fails with `No allowed transitions found for given status`, the name doesn't match this board's workflow (boards vary — `"Start Progress"`, `"In Development"`, `"In Progress"` are all seen in practice). Confirm the current status first (`acli jira workitem view <KEY> --fields status`), then check the board's workflow in the Jira web UI (`acli jira workitem view <KEY> --web`) or ask the project's Jira admin for the exact name — do not guess repeatedly.

### Verify

```bash
acli jira workitem view <KEY> --fields "status,assignee"
```

Confirm **assignee** is you and **status** reflects "In Progress" before proceeding.

## Add a comment

```bash
acli jira workitem comment create --key <KEY> --body "$(cat <<'EOF'
Your comment here. Supports multiple lines.
EOF
)"
```

For short one-line comments:

```bash
acli jira workitem comment create --key <KEY> --body "Starting implementation — branch: feature/<KEY>-<slug>"
```

List existing comments: `acli jira workitem comment list --key <KEY>`

## Change status (board transition)

```bash
# Confirm the current status before attempting a transition
acli jira workitem view <KEY> --fields status

# Apply a transition by target status name
acli jira workitem transition --key <KEY> --status "<target-status>" --yes
```

Common statuses (names vary by board): `"To Do"`, `"In Progress"`, `"In Review"`, `"Done"`, `"Closed"`.

If the target name is wrong, `acli` reports `No allowed transitions found for given status` rather than listing valid options — check the web UI (`--web`) rather than guessing repeatedly.

## Close / mark Done

When a PR that resolves the issue is merged:

```bash
acli jira workitem transition --key <KEY> --status "Done" --yes
```

## List issues

`acli` uses JQL for searching rather than a `--project`/`--status` flag pair:

```bash
# All issues in a project
acli jira workitem search --jql "project = <PROJECT_KEY>"

# Filter by status
acli jira workitem search --jql "project = <PROJECT_KEY> AND status = \"In Progress\""

# Issues assigned to you
acli jira workitem search --jql "project = <PROJECT_KEY> AND assignee = currentUser()"
```

## Reference: useful commands

| Action | Command |
|--------|---------|
| View issue | `acli jira workitem view <KEY>` |
| Transition (by target status name) | `acli jira workitem transition --key <KEY> --status "<status>" --yes` |
| Assign | `acli jira workitem assign --key <KEY> --assignee <user-or-@me>` |
| Comment | `acli jira workitem comment create --key <KEY> --body "..."` |
| Search / list issues | `acli jira workitem search --jql "<JQL>"` |
| Current account | `acli jira auth status` |
| List projects | `acli jira project list --recent` (or `--paginate` for all) |
| List boards | `acli jira board search --project <PROJECT_KEY>` |
| List sprints (needs a board ID) | `acli jira board list-sprints --id <BOARD_ID>` |

Note: `acli` has no direct "add issue to sprint" command (unlike some third-party Jira CLIs). Assign an issue to a sprint via the Jira web UI, or ask the user to do so, until `acli` exposes that operation.

## Troubleshooting

- **Not authenticated** — run `acli jira auth login --web` (or with `--site`/`--email`/`--token`).
- **Transition not found** — `acli` doesn't expose a "list transitions" command; confirm current status (`acli jira workitem view <KEY> --fields status`) and check the web UI (`--web`) for the exact target status name rather than guessing.
- **Forbidden / permission denied** — your Jira role may not permit the operation; check with your Jira admin.
- **Wrong project** — run `acli jira project list --recent` to confirm the project key; it is case-sensitive.
