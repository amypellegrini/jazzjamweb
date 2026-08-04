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

## What reads the shared data

`src/index.html` renders the Pro Unlock section from it via Nunjucks
(`{{ shared.paywall.title }}`, `{{ shared.paywall.subtitle }}`, a `{% for %}` loop over
`shared.paywall.benefits` using `benefit.name` + `benefit.description`, and the CTA
label). The app renders the same benefits in its paywall via a generated
`components/paywall-sheet/benefits.ts`.

## How to change the Pro Unlock content

1. In the workbench checkout (this repo's parent directory when checked out as a
   submodule): edit `content/shared.json`.
2. Run `npm run sync` from the workbench root. It regenerates `src/_data/shared.json`
   here and `benefits.ts` in the app.
3. Commit the regenerated file(s) in each affected repo following its conventions
   (this repo: branch + PR; pre-commit runs the Playwright suite).
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
