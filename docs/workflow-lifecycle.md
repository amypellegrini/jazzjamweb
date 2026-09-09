# Review, QA and acceptance lifecycle

Both Claude and Codex workflows use this contract. In the workbench,
`docs/board-columns.md` remains the authority for board columns. This document
supplies the child-only handoff procedure when that checkout is unavailable.

For column definitions and their ordering, read the workbench's
[canonical board document](https://github.com/amypellegrini/jazzjam-workbench/blob/main/docs/board-columns.md),
or `docs/board-columns.md` in its local checkout. The procedures below implement
its handoffs; they do not define another column set. When that contract changes,
update this procedure in both children in the same coordinated change.

## Review handoff (the caller coordinates)

1. Run `.agents/skills/code-review/SKILL.md` against the captured full PR head SHA.
   This procedure is self-contained and can be read by either tool. The review
   worker stays read-only; its caller owns the following handoff.
2. Require verdict `approve`, no blockers or unresolved questions, an unambiguous
   linked issue, unchanged PR head, and green CI for that head. Otherwise report
   the missing gate and leave the board unchanged. A formal GitHub approval alone
   is neither this complete handoff nor product acceptance.
3. Discover the issue's existing project item and live project/Status/option IDs.
   Require exact In Review and In Testing options. Missing membership or columns
   is a reported prerequisite gap; do not add items or guess substitute columns.
4. Post an issue record: `Code review — <date> — <full SHA> — passed`, the PR link,
   verdict, non-blocking findings and next step `qa-test`. If a matching record
   exists, reuse it. A failed record write prevents the transition.
5. Re-fetch head, CI and status immediately before `gh project item-edit`. Require
   the reviewed head, green CI and status In Review; set In Testing using the
   discovered IDs. Re-fetch to verify before reporting success. Already In Testing
   with a matching record is an idempotent success. Other states stay unchanged.

## QA gate (both qa-test entry points)

Normal QA requires In Testing and a passing review record for the tested PR SHA.
Exploratory testing without this gate may report findings but cannot promote.
Record the full tested SHA, review-record link, per-scenario pass/fail/blocked,
evidence and next action in the issue assessment (and PR copy).

Only a complete clean pass may move In Testing → Ready For Sign Off. Immediately
before promotion, re-fetch the open PR head, green CI and current status and verify
all evidence refers to the same SHA. Missing/stale review, a changed head, failed
or blocked scenarios, absent membership or columns prevent promotion. Re-fetch
after the move. Failed QA stays In Testing; QA never starts rework or merges.

## Human acceptance and merge

For board-tracked work, close-issue requires Ready For Sign Off, passing review and
QA for the current head, and explicit human approval of every acceptance criterion
on that build. The workbench sign-off skill collects and records those decisions;
without the workbench, demonstrate each criterion and record each human decision
on the issue with the full SHA. Preserve valid approvals already given in this
session. Never replace missing product acceptance with a code-review approval.

A direct merge request does not by itself assert QA or per-criterion acceptance
happened. Report missing gates and route to review, QA or sign-off; this procedure
does not define a shortcut around the workbench acceptance process.
For untracked work, require explicit human merge authorization and report board
stages as not applicable rather than manufacturing membership or evidence.

Re-fetch status, head and CI before merging; a changed head invalidates stale
records. Blocked always stays human-owned. Use `--match-head-commit <verified-SHA>`
when squash-merging. After confirmed merge, move only Ready For Sign Off → Done;
Done is an idempotent success. Any other live status is reported unchanged, even
if the issue auto-closed. Never sweep In Review, In Progress or Blocked into Done.
