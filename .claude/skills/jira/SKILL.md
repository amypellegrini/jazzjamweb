---
name: jira
description: Use whenever you need to interact with Jira issues via the CLI — pick up an issue (assign to yourself, transition to In Progress), add comments, change board status, or look up transitions. Reference for ACLI (jira CLI) developer workflow commands. Active when .sensible-harness/manifest.json has issueTracker=jira.
model: haiku
---

# Jira

Developer workflow reference for interacting with Jira issues via the `jira` CLI (ACLI). Use these commands when `.sensible-harness/manifest.json` has `"issueTracker": "jira"`.

## Prerequisites

```bash
jira version          # confirm ACLI is installed
jira me               # prints your account info; failure = not authenticated
```

If not installed: follow https://github.com/ankitpokhrel/jira-cli#installation
If not authenticated: `jira init` (you will need your Jira site URL and an API token)

## Pick up an issue

Picking up means: fetch the issue, confirm understanding, assign to yourself, and transition to "In Progress".

### Fetch

```bash
jira issue view <KEY>
```

Output includes summary, description, status, assignee, reporter, and comments. Use this to validate quality — check for Context, Scope, Acceptance criteria, Out of scope, Dependencies sections.

### Assign to yourself

```bash
jira issue assign <KEY> $(jira me --plain | awk '/AccountID/{print $2}')
```

If the above fails to parse, pass your account ID or email directly:

```bash
jira issue assign <KEY> <account-id-or-email>
```

### Transition to "In Progress"

First list available transitions for the issue's current status to find the exact name used by this board:

```bash
jira issue transition list <KEY>
```

Then transition:

```bash
jira issue transition <KEY> "In Progress"
```

Use the name exactly as shown in the transition list — boards vary (`"Start Progress"`, `"In Development"`, `"In Progress"`).

### Verify

```bash
jira issue view <KEY>
```

Confirm **Assignee** is you and **Status** reflects "In Progress" before proceeding.

## Add a comment

```bash
jira issue comment add <KEY> --body "$(cat <<'EOF'
Your comment here. Supports multiple lines.
EOF
)"
```

For short one-line comments:

```bash
jira issue comment add <KEY> --body "Starting implementation — branch: feature/<KEY>-<slug>"
```

## Change status (board transition)

```bash
# List valid transitions from the current status
jira issue transition list <KEY>

# Apply a transition
jira issue transition <KEY> "<target-status>"
```

Common statuses (names vary by board): `"To Do"`, `"In Progress"`, `"In Review"`, `"Done"`, `"Closed"`.

Always list first — never guess the status name.

## Close / mark Done

When a PR that resolves the issue is merged:

```bash
jira issue transition list <KEY>           # find the final status name
jira issue transition <KEY> "Done"
```

## List issues

```bash
# All open issues in a project
jira issue list --project <PROJECT_KEY>

# Filter by status
jira issue list --project <PROJECT_KEY> --status "In Progress"

# Issues assigned to you
jira issue list --project <PROJECT_KEY> --assignee $(jira me --plain | awk '/AccountID/{print $2}')
```

## Reference: useful commands

| Action | Command |
|--------|---------|
| View issue | `jira issue view <KEY>` |
| List transitions | `jira issue transition list <KEY>` |
| Transition | `jira issue transition <KEY> "<status>"` |
| Assign | `jira issue assign <KEY> <user>` |
| Comment | `jira issue comment add <KEY> --body "..."` |
| List issues | `jira issue list --project <KEY>` |
| Current user | `jira me` |
| List projects | `jira project list` |
| List sprints | `jira sprint list --project <KEY>` |
| Add to sprint | `jira sprint add <SPRINT_ID> <ISSUE-KEY>` |

## Troubleshooting

- **Not authenticated** — run `jira init` and provide your Jira URL and API token.
- **Transition not found** — run `jira issue transition list <KEY>` and copy the name exactly.
- **Forbidden / permission denied** — your Jira role may not permit the operation; check with your Jira admin.
- **Wrong project** — run `jira project list` to confirm the project key; it is case-sensitive.
