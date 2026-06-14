# AGENTS.md

> Scaffolded by Sensible Harness. Run `/assess-repo` to replace these placeholders with findings from a live assessment.

## Project overview

<!-- Describe what this project does and who it is for. -->

## Tech stack

<!-- Language, runtime version, package manager, primary framework/library. -->

## Directory layout

<!-- Top-level directory structure and what each directory contains. -->

## Conventions

- **Commits**: Conventional Commits format (`feat:`, `fix:`, `chore:`, etc.). Use the `/commit` skill — it enforces atomicity and the right format automatically.
- **Branches**: Feature branches off `main`. One branch per issue. Never commit directly to `main`.
- **PRs**: One concern per PR. If "and" appears in the PR title, split it. Use `/open-pr` to open and `/close-issue` to merge.
- **Code style**: Follow existing patterns in the file you are editing. Do not reformat unrelated code.

## Installed Sensible Harness skills

These skills are installed by Sensible Harness. Invoke them to drive development workflows:

| Skill | When to use |
|-------|-------------|
| `/pickup-issue` | Start work on a Jira issue — creates branch, syncs board |
| `/tdd` | One red → green → refactor → commit cycle per acceptance criterion |
| `/commit` | Create an atomic commit with a Conventional Commits message |
| `/open-pr` | Push branch and open a PR against `main` |
| `/address-pr-comments` | Triage and implement review feedback |
| `/check-ci` | Verify CI status before merging |
| `/close-issue` | Squash-merge PR, clean up branch, transition Jira issue to Done |
| `/dev` | Full issue-to-merge orchestration (composes the skills above) |
| `/assess-repo` | Score the repo across 9 dimensions; regenerates this file |

If a tool fails, run `sensible-harness doctor` before escalating to the user.

## Agent behaviour rules

**Security**
- Never read `.env*`, `*.key`, `*.pem`, or files inside `~/.ssh/`, `~/.aws/` unless explicitly instructed
- Never commit secrets or credentials; if a file is gitignored, treat that as intentional
- Never use `--no-verify` or force-push without explicit human approval

**Evidence**
- Cite file path and line number when referencing code: `src/foo.ts:42`
- Verify before asserting — read the file or run the command; never state as fact what you haven't checked
- Label inferences explicitly: "the naming suggests…" not "this does…"

**Scope**
- Ask before adding dependencies, restructuring directories, or implementing unrequested features
- Ask before modifying CI/CD pipelines or authentication configuration
- Confirm before any irreversible operation: deleting files, dropping data, force-pushing

**Quality**
- Run the test suite before committing; failing tests block the commit
- Never skip or comment out tests to make the suite green
- One concern per commit — if "and" appears in the commit message, split it

**Communication**
- Report what you did, not what you intended to do
- Surface blockers immediately; don't work around them silently
- When uncertain about the right approach, ask rather than guess

---

Run `/assess-repo` to replace these placeholders with findings from a live assessment.
