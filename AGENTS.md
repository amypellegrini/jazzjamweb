# Project instructions

Read [CLAUDE.md](CLAUDE.md) for the repository rules before working. Those rules
apply to both tools; this file adds only Codex routing.

## Codex workflows

Repository skills live under `.agents/skills/`; custom agent definitions live under
`.codex/agents/`. Read a composed skill before following it. References such as
`$dev` mean the corresponding skill, with natural-language invocation also supported.
Preserve explicit human approval gates. Planning gates require a written plan and
user approval, without depending on a mode-switch tool. If a delegated agent cannot
ask the user directly, relay its exact question through the parent and wait for the answer.
