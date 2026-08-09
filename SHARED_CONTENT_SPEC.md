# Shared Content Spec

This site consumes content that is shared with the mobile app
([musicpracticepro](https://github.com/amypellegrini/musicpracticepro)). The canonical
source lives in the **private `jazzjam-workbench` repo**
(github.com/amypellegrini/jazzjam-workbench), which contains both projects as git
submodules plus `content/shared.json` and a sync harness.

## Generated files in this repo

| File | Generated from |
| --- | --- |
| `src/_data/shared.json` | `content/shared.json` (workbench) |

**Never edit `src/_data/shared.json` by hand** — it carries a `__generated` banner key.
It is deliberately committed (not gitignored) because CI and the Pages deploy check this
repo out standalone. The workbench's `sync --check` gate will flag any manual edit as
drift the next time it runs.

### CI enforcement

The `Shared Content` workflow (`.github/workflows/shared-content.yml`) runs
`scripts/check-shared-content.js` — tested in `tests/check-shared-content.spec.ts` — on
every PR and on pushes to main. It fails any commit in the PR range that touches the
file above unless that commit's subject starts with `chore(sync):` (the breaking form
`chore(sync)!:` is also accepted). Use that prefix when committing regenerated output.

Design points, shared with musicpracticepro's gate (a change to one belongs in both):

- Judged per commit against the **live** base branch (merge-base semantics), so a
  branch that merges main in is not blamed for mainline commits, and a hand edit
  cannot be laundered by a later sync commit or revert.
- Merge commits are inspected with a combined diff (`git log -c`), so a hand edit
  written into a merge-conflict resolution is caught.
- Fails closed on unresolvable revisions and untracked guarded paths.
- Catches hand edits only; it does not verify content against the workbench (this
  repo has no access to the private workbench) — the workbench's own `sync:check`
  hook does that.

⚠️ `main` has no branch protection, so the check is advisory until it is made required
in the repo settings.

## What reads the shared data

`src/index.html` renders the Pro Unlock section from it via Nunjucks: an `<h2>` from
`{{ shared.paywall.title }}` with the bundle-level `{{ shared.paywall.subtitle }}`
beneath it, then one full-width band per entry in `shared.paywall.groups` — each with
its own `<h3>` subtitle and the benefits belonging to that group as plain text blocks
(a lone benefit spans its whole band) — and the CTA label. The app renders the same
benefits, in the same groups, via a generated `components/paywall-sheet/benefits.ts`.

### Group membership is derived, not listed

The data declares the groups but never says which benefit belongs where. A benefit id
names its group (`export-midi` belongs to `export`), and the group flagged
`"catchAll": true` takes every benefit no namespace claims — which is how
`all-keys-cycle` reaches the practice group. `scripts/pro-benefit-groups.js` applies
that rule at build time and `src/_data/proUnlock.js` exposes the result to the
template, so a benefit added in the workbench lands in the right group here with no
template edit.

The rule is re-derived rather than read off the data because this repo is checked out
standalone by CI and the Pages deploy. Anything it cannot place — a benefit matching no
group, a benefit two group namespaces both claim, two `catchAll` groups, a group left
with no benefits — throws and fails the Eleventy build. A benefit is never dropped from
the page or appended to an arbitrary group. `tests/pro-benefit-groups.spec.ts` covers
each of those failures; `tests/index.spec.ts` asserts the rendered grouping against the
same rule rather than against a literal benefit list.

## How to change the Pro Unlock content

1. In the workbench checkout (this repo's parent directory when checked out as a
   submodule): edit `content/shared.json`.
2. Run `npm run sync` from the workbench root. It regenerates `src/_data/shared.json`
   here and `benefits.ts` in the app.
3. Commit the regenerated file(s) in each affected repo following its conventions
   (this repo: branch + PR; pre-commit runs the Playwright suite). Give the commit that
   carries regenerated output a `chore(sync):` subject — CI requires it.
4. Bump the submodule pointers in the workbench.

If you only have this repo checked out (no workbench), do not change the Pro Unlock
copy here — make the change via the workbench so the app stays in sync.

## Guardrails

- **Never add pricing** to the shared data or the Pro Unlock section.
  `tests/index.spec.ts` fails on any `$` or "founder" wording there — prices come from
  RevenueCat inside the app at runtime.
- `tests/index.spec.ts` asserts the rendered copy (format names, subtitle, CTA text), so
  content changes made in the workbench will surface here as test expectations to update
  in the same PR as the regenerated data file.

## Not yet shared (still hardcoded in this repo)

The Play Store URL (3×), the three marketing feature cards, and `src/llms.txt` are
planned candidates for the same treatment — see the workbench README before
centralising them.
