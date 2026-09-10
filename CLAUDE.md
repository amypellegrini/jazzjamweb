# Project Rules

## Shared Content

`src/_data/shared.json` is GENERATED from the private jazzjam-workbench repo — never
edit it by hand. See [SHARED_CONTENT_SPEC.md](SHARED_CONTENT_SPEC.md) before touching
the Pro Unlock section or other app-shared content. Never add pricing to the site —
a Playwright guardrail enforces this.

## Workflow entry points

These repository rules apply to Claude and Codex. Claude uses `.claude/skills/` and
`.claude/agents/`; Codex uses `.agents/skills/` and `.codex/agents/`.
The self-contained `.agents/skills/code-review/SKILL.md` is shared by both tools;
Claude reads it as a procedure, without requiring a Codex runtime.
Both use [the child handoff procedure](docs/workflow-lifecycle.md). Board columns
and next steps are owned by the workbench `docs/board-columns.md`; this repo does
not define a separate column set.
