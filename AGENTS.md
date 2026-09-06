# Project Rules

## Shared Content

`src/_data/shared.json` is GENERATED from the private jazzjam-workbench repo — never
edit it by hand. See [SHARED_CONTENT_SPEC.md](SHARED_CONTENT_SPEC.md) before touching
the Pro Unlock section or other app-shared content. Never add pricing to the site —
a Playwright guardrail enforces this.

## Codex workflows

Repository skills live under `.agents/skills/`; custom agent definitions live under
`.codex/agents/`. Read a composed skill before following it. References such as
`$dev` mean the corresponding skill, with natural-language invocation also supported.
Preserve explicit human approval gates. Planning gates require a written plan and
user approval, without depending on a mode-switch tool. If a delegated agent cannot
ask the user directly, relay its exact question through the parent and wait for the answer.
