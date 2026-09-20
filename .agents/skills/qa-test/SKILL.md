---
name: qa-test
description: "Use whenever the user asks to QA-test or verify a feature that's being worked, by issue number or feature reference — `qa-test #N`. Locates and checks out the feature branch (refusing to clobber uncommitted work, never testing main or a fabricated branch), fetches the issue, builds a test plan covering every acceptance criterion with happy-path, edge, and negative scenarios, posts the plan to the issue, runs the feature to execute the plan, and posts the final assessment to both the issue and the PR with a sign-off-or-address-gaps recommendation, and — on a clean pass only — moves the issue to \"Ready For Sign Off\" on the active project board (never closing or merging it). Dynamic verification, but strictly read-only on the code under test — failing scenarios are recorded as gaps, never fixed (that's $dev). Posts the test plan and assessment autonomously without per-action confirmation; they're the skill's deliverable."
---

# QA test a feature

Verify a feature that's being worked, end-to-end, against the acceptance criteria of its driving issue. Given an issue number (or a feature reference), locate and check out the feature branch, fetch the issue, build a test plan that covers every AC — including edge cases and negative scenarios — post the plan to the issue, execute it against the running feature, and post a final assessment to the PR with a clear recommendation for **human sign-off** or **address gaps**.

This is **dynamic verification**, not a static assessment. You will run the feature. But you remain QA, not DEV: **never modify the code under test to make a scenario pass.** A failing scenario is a recorded gap, not something you fix — recommending the fix is QA; applying it is `$dev`.

## Inputs

`qa-test [ISSUE NUMBER OR FEATURE]`:

- An **issue reference** — `#N`, a bare number (GitHub), or a Jira key (`PROJ-123`). The primary path.
- A **feature reference** — free text describing the feature. Resolve it to an issue and/or branch (search the tracker, scan branch names). If it maps to more than one candidate, **ask the user directly** — do not guess.

If you can't resolve the input to a concrete issue, stop and ask.

## Review prerequisite

Read and follow [the shared lifecycle contract](../../../docs/workflow-lifecycle.md),
including its review prerequisite, SHA-stamped QA assessment and promotion rules.
These rules apply equally to Claude and Codex.

## 1. Locate the feature branch

You can't test a feature that isn't on a branch yet. Find the branch for the issue, in order:

- The PR that closes the issue: `gh pr list --state open --search "<issue ref>"` (or look for `Closes #N` in PR bodies). Its head branch is the target.
- A local/remote branch whose name encodes the issue number (`git branch -a` / `git branch --list "*<N>*"`). `pickup-issue` names branches with the issue number, so match on it.

If you find more than one candidate branch, surface them and **ask** which to test.

**If no branch exists:** stop and surface it. There is nothing to verify — the feature isn't in progress. Recommend the user confirm the issue is actually being worked (or run `$dev #N` to start it). Do not fabricate a branch or test `main`.

## 2. Check out the branch safely

- **Refuse to clobber uncommitted work.** Run `git status --porcelain`; if the working tree is dirty, stop and surface it — let the user stash or commit first. Never discard their changes to switch branches.
- Record the current branch so you can offer to return to it at the end.
- `git fetch` the remote, then `git checkout <branch>` and bring it up to date (`git pull --ff-only` on the tracking branch). If the fast-forward fails (diverged), surface it rather than forcing.

This is a working-tree state change — note it in your report and offer to switch back when done.

## 3. Fetch the issue details

- GitHub: `gh issue view <N>` (title, body, labels). Jira: `acli` equivalent.
- Parse the structured sections the repo's checklist uses: **Context**, **Scope**, **Acceptance criteria**, **Out of scope**, **Manual verification**, **Dependencies**.

**Issue-quality gate.** If the issue has no acceptance criteria, or they're too thin to derive concrete scenarios, you can't build a meaningful test plan. Stop and surface it; offer to proceed by deriving *provisional* ACs from the Scope section (clearly marked as provisional in the plan), or to pause for a BA refinement pass (`$business-analyst #N`). Don't invent ACs silently.

## 4. Build the test plan

This is the QA value-add — do it well. For **each acceptance criterion**, derive concrete, executable scenarios across three categories:

- **Happy path** — the AC working as specified, with representative inputs.
- **Edge cases** — boundaries and corners: empty/zero/max inputs, missing optional data, first-run vs. repeat-run, concurrent or out-of-order operations, unusual-but-valid states.
- **Negative scenarios** — invalid input, missing prerequisites, permission/auth failures, conflicting state. Assert the feature *fails safely and informatively*, not just that the happy path works.

Also:

- **Classify every scenario up front** on two independent axes, and state both splits in the plan before anything is executed or handed to a human.
  - **Where it is shown — device or headless.** *Device* means the behaviour on the real surface is what the criterion is about — a real connected device for a device app, a browser for a website. *Headless* means a command, a rendered file, a report, or a test run shows it. "There is no point to fully demonstrate things in a device if it can be done headless."
  - **Who rules on it — agent-run or human-ruled.** This is the only place the human-ruled set is defined, and §6 executes that definition rather than re-deriving one. A scenario is **human-ruled** when, and only when, the verdict needs the product owner's own eyes or ears: a listening check, a feel or quality judgement, something the issue explicitly reserves for them, or something only they can supply. Everything else is **agent-run** — you execute it and record the verdict yourself.
- Fold in any **Manual verification** steps the issue lists, classified on both axes like every other scenario. **"Manual" means "not covered by an automated test", not "human-ruled":** a step you can carry out yourself is agent-run, however manual it is. Write every one of them as the steps a human performs (the exact command in a fenced code block, or the exact location to open) so the record is repeatable, and mark it device or headless.
- Treat **Out of scope** items as explicit non-goals — do not test them, and note them as deliberately excluded so the plan's coverage is honest.

Structure each scenario as: a short title, the steps to run it, and the expected result. Group scenarios under the AC they cover, and mark which category (happy / edge / negative) each is.

## 5. Post the test plan to the issue

Post the plan as a comment on the driving issue. Do **not** pause for approval — posting is the skill's deliverable; the user invoked you to produce these artifacts.

- GitHub: `gh issue comment <N> --body <plan>`. Jira: `acli` equivalent.
- Lead the comment with a clear marker (e.g. `## QA test plan — <date>`) so it's distinguishable from discussion.

Show the plan in the conversation as you post it so the user has it in the transcript, and capture the comment URL for your final report.

## 6. Execute the test plan

Now run the feature. Discover how this project is exercised — don't assume:

- Build if needed (`npm run build`, `cargo build`, etc.), then run the app/CLI/service as a user would.
- Execute each scenario from §4. For each, record a verdict: **pass** / **fail** / **blocked** (couldn't run — note why), with *observed* vs *expected*.
- For UI/visual features, drive the actual interface where possible; if you can't (no browser, headless limits), say so explicitly and mark those scenarios **blocked** rather than claiming a pass.

**When a human has to look, listen, or rule.** These are exactly the scenarios classified **human-ruled** in §4 — do not widen the set here, and do not narrow it. Every other scenario, manual verification steps included, you run and rule on yourself. The requirement, in the product owner's words: "The purpose of the desk check (same as sign off) is for me to validate with my own eyes. When asking the questions you should walk me through the steps and provide any references needed for the process. If you reference a file, you should provide the exact location in a way I can find it. If you reference the app, you should run the app in a connected device and show the behavior in the app." Read "run the app in a connected device" as this repo's equivalent — the page served at `http://localhost:8080/...` and opened in the human's own browser. Apply it as a fixed protocol:

1. **Setup first.** Before asking the human for a scenario verdict, everything they will run or open is ready. Only if a scenario needs a browser, have the site built and **already being served**: `npm start` (`eleventy --serve`, port 8080) running in the background from the checked-out feature branch (§2), plus the exact `http://localhost:8080/<page>/` URL of every page they are asked to look at, and any file a scenario needs already generated. This is a static Eleventy site — there is no device to connect and no app to install, so never ask the human for either. Your own run of the scenario is preparation — it is never the evidence they rule on.
2. **Steps, then what to observe, then the question.** Hand over the exact steps they perform (a command in a fenced code block, or the exact location to open), state what they should observe, and only then ask — directly in conversation, one scenario per question. The options never pre-state the verdict: **Pass / Fail / Blocked**, each described in terms of what the user observed. A summary or table of your own reading of an artefact is never what they rule on.
3. **Every reference is openable.** An absolute path, saying which environment it is for (Windows clone vs WSL); a line range for code; a URL for an issue comment or PR; for a page of the site, the `http://localhost:8080/<page>/` URL of the dev server started in step 1. When the human is not on the machine holding a file, a local path is not openable *for them* — publish it using the safe evidence procedure below and hand over the raw GitHub URL. Never a bare filename, and never a path only you can reach.

Record the human's answer as **pass (human-run)** / **fail (human-run)** / **blocked (human-run)**. Never record a human-ruled scenario as a pass on your own reading of it.

If the run is unattended and no human can rule, record the scenario as **blocked
(awaiting human observation)**, never as passed. List the exact remaining steps,
openable references and required setup in the assessment. Resume these scenarios
with the human during QA; until all pass, recommend **address gaps** and leave the
item in **In Testing**. Do not defer unrun QA to sign-off or change the board to
Blocked. Sign-off remains the later acceptance gate after a complete clean QA pass.

**Safe evidence publication.** Publish files on the dedicated `qa-evidence` branch under `<issue>/<date>/`
    from a fresh, task-owned temporary worktree. Check local and remote branch
    existence first. If the remote branch exists, fetch and reuse it; never replace
    its history. On first use, run `git worktree add --detach <tmpdir> HEAD`, then
    **inside that disposable worktree only**, `git switch --orphan qa-evidence`.
    Unlike `checkout --orphan`, `switch --orphan` removes tracked files and clears
    the index. Verify `git ls-files` returns nothing before copying evidence.
    Copy only the intended evidence files; stage only their `<issue>/<date>/` paths.
    Inspect `git diff --cached --name-only` and require every path to be one of those
    evidence files before committing. Push without force; if the remote advanced,
    reconcile that branch without overwriting its evidence. Remove only this task's
    clean temporary worktree when finished. Never run orphan/index cleanup in the
    feature checkout. A failed empty-index or path check stops publication.

Use `https://raw.githubusercontent.com/<owner>/<repo>/qa-evidence/<issue>/<date>/<file>` as the published reference. If publication fails and the user cannot open the local file, record the scenario as blocked; a private local path cannot substitute for observation.

**Hard constraint:** if a scenario fails, **do not edit the feature's source, tests, or config to make it pass.** Record the failure as a gap with enough detail for DEV to act (steps, observed behaviour, which AC it violates). Modifying the code under test is the line between QA and DEV; crossing it invalidates the verification.

## 7. Produce the assessment and recommendation

Summarise:

- **AC coverage** — each AC with an overall pass/fail, backed by its scenarios.
- **Scenario results** — counts by category (happy / edge / negative) and by verdict (pass / fail / blocked).
- **Remaining manual steps** — list each blocked human-ruled scenario with exact steps, openable references, device/headless classification and setup needed to resume QA.
- **Gaps** — every failing or blocked scenario, with observed vs expected and the AC it maps to.

Then a single, unambiguous **recommendation**:

- **Ready for human sign-off** — every AC passes, edge and negative coverage holds, no blocking gaps.
- **Address gaps** — one or more ACs fail or critical scenarios are blocked. List exactly what must be fixed, mapped to ACs, so DEV can act without re-deriving the plan.

## 8. Post the assessment to the issue and the PR

The assessment closes the loop on the test plan from §5. It goes to **both** surfaces: the issue (so the driving artifact carries the full QA verdict and history) and the PR (so the reviewer sees it in review context). Do not pause for approval.

- **Always post to the issue:** `gh issue comment <N> --body <assessment>`. Lead with a marker (e.g. `## QA verification — <date> — recommendation: <ready for sign-off | address gaps>`).
- **Find the PR for the branch:** `gh pr list --head <branch> --state open`. If a PR exists, post the same assessment there: `gh pr comment <PR> --body <assessment>`. If no PR exists yet, note it in your final report — the issue comment alone carries the assessment.

Show the assessment in the conversation as you post it, and capture both comment URLs for your report.

## 9. Promote a clean pass

Resolve the target project before the promotion checks:

- Discover the repository owner with `gh repo view --json owner` and list open
  projects with `gh project list --owner <owner> --format json`. Use a different
  project owner only when supplied or confirmed by the user.
- If no project is open, report the missing board prerequisite and skip promotion.
  If multiple projects are open and the issue's intended project is not already
  explicit, ask which project owns this QA run; never choose by list order.
- Discover the live project, item, Status field and exact In Testing / Ready For
  Sign Off option IDs for that project with `gh project field-list` and the issue's
  `projectItems`. Never hard-code project numbers, IDs or field IDs. Require the
  existing issue membership; never add an item to manufacture eligibility.

Follow the shared lifecycle contract's QA gate. Recheck review, tested SHA, open PR
head, green CI and In Testing immediately before mutation. On a clean pass use
`gh project item-edit` with those IDs and verify the resulting Ready For Sign Off.
Otherwise leave the board unchanged and report the missing prerequisite or gaps.
Human acceptance follows; QA never merges, closes, or moves an item to Done.

## 10. Clean up and report

- Return to the branch you started on (from §2) — don't leave the user on a checked-out feature branch they didn't ask to be on.
- Report back: the issue, branch and commit tested, the test-plan comment URL, the assessment comment URLs (issue + PR if it exists), the headline verdict (ready for sign-off vs. address gaps), the board transition (moved to **Ready For Sign Off**, or skipped and why), and the gap list. Be honest about any scenarios marked **blocked** and why — a verification that quietly skipped half its scenarios is worse than none.

## Out of scope (do not do these)

- **Don't fix the feature.** No edits to source, tests, or config to make scenarios pass — record gaps and recommend.
- **Don't test `main` or a fabricated branch.** No branch ⇒ stop and surface.
- **Don't clobber uncommitted work** to switch branches.
- **Don't test out-of-scope items**, and don't invent ACs the issue doesn't state (mark provisional ACs as such if the user opts in).
- **Don't merge or close the issue/PR, and don't move it to "Done".** The one board transition QA owns is → **"Ready For Sign Off"** on a clean pass (§9). Recommending sign-off is QA; merge/close follows human acceptance via `close-issue`.

## Next step

Read the applicable outcome from the workbench `docs/board-columns.md` and say it last.
A verified promotion means **Ready For Sign Off**, next run `$sign-off jazzjamweb#<N>`
from the workbench after its migration lands, or collect per-criterion human acceptance
using `docs/workflow-lifecycle.md` in a child-only checkout. Gaps or blocks remain
**In Testing**: clear the environment or pick up development rework, then repeat CI,
review, and QA. For exploratory runs, stale reviews, or skipped transitions, report the
actual board state and missing prerequisite.
