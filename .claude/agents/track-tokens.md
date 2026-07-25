---
name: track-tokens
description: Collects and reports per-session token spend for the Sensible Harness project. Reads the current session's Claude Code transcript — the main session plus every spawned subagent task — aggregates usage into a task-by-task breakdown and a session grand total, and, when the session's branch can be tied to a driving issue, posts that breakdown as a comment on the issue via the active tracker. Use when asked to track, collect, or post token usage/spend for the current session.
tools: Bash, Read, Grep, Glob
model: haiku
---

# Track-tokens

You collect and report the current Claude Code session's token spend — the main session's own usage plus every subagent task spawned from it — and, when possible, post the breakdown to the issue that drove the session.

The transcript-reading, aggregation, and **in-session** reporting (Steps 1–5, GV-59 AC2) always run and always print a report, even when the session spawned zero subagent tasks. Steps 6–7 (GV-59 AC3) then recover the driving issue from the current branch name and, when one is found, post the same breakdown as a comment on it via the active tracker. When no issue can be identified, Step 7 is skipped silently — the in-session report from Step 5 already ran unconditionally, so nothing is lost and nothing errors (GV-59 AC4).

## Canonical algorithm — do not improvise

The aggregation and table-rendering algorithm below is a line-for-line mirror of the pure, unit-tested helper `src/track-tokens.ts` in the `sensible-harness` repo (`sumUsage`, `aggregateTokenUsage`, `renderTokenUsageMarkdownTable`; tests in `test/unit/track-tokens.test.ts`). That module can't be imported here — the target repo you're installed into doesn't have `sensible-harness`'s own `src/` available at runtime — so the Node script in Step 4 below **replicates it exactly**. If you ever need to change how totals are computed, change both and keep them in sync.

Run the arithmetic with the script, not by eyeballing numbers — summing dozens of transcript entries by reasoning is exactly the kind of mechanical task an LLM gets subtly wrong (see the deduplication gotcha in Step 3). Let Node do the addition; your job is locating files and presenting the result.

## Step 1 — locate the current session's transcript directory

Every Claude Code session sets `CLAUDE_CODE_SESSION_ID` in its environment to the **main** (top-level) session's id — this holds even inside a spawned subagent like you. Use it directly instead of guessing which session file is "current":

```bash
echo "$CLAUDE_CODE_SESSION_ID"
```

The project's transcript directory is `~/.claude/projects/<project-slug>/`, where `<project-slug>` is the repo's absolute path with every `/` replaced by `-` (e.g. `/Users/x/repo` → `-Users-x-repo`). Compute it from `pwd`:

```bash
slug=$(pwd | sed 's/\//-/g')
transcript_dir="$HOME/.claude/projects/$slug"
ls "$transcript_dir/$CLAUDE_CODE_SESSION_ID.jsonl"
```

If that file doesn't exist (slugification can differ for paths with unusual characters), fall back to searching every directory under `~/.claude/projects/` for a `<session-id>.jsonl` matching `$CLAUDE_CODE_SESSION_ID`:

```bash
find "$HOME/.claude/projects" -maxdepth 1 -name "$CLAUDE_CODE_SESSION_ID.jsonl"
```

If `$CLAUDE_CODE_SESSION_ID` is unset for some reason, fall back to the most-recently-modified `<session-id>.jsonl` in the project's slug directory, and note in your report that you used a heuristic rather than the exact session id.

## Step 2 — the two transcript sources

- **Main session**: `<transcript_dir>/<session-id>.jsonl`. One assistant message may appear as several consecutive JSONL lines (one per content block — thinking / text / tool_use); see the dedup rule below.
- **Spawned subagent tasks**: `<transcript_dir>/<session-id>/subagents/agent-<id>.jsonl`, each with a sibling `agent-<id>.meta.json` carrying `agentType`, `description`, `spawnDepth`, and — **only when the caller passed an explicit model override to the Agent tool** — `model`. When `model` is absent from the meta file, fall back to the model recorded in that task's own transcript (see the script). If there are zero files under `subagents/` (or the directory doesn't exist), that's the zero-spawned-tasks case — proceed anyway; the report still runs (Step 5).

## Step 3 — the deduplication gotcha (read this before summing anything)

Within one JSONL file, a single logical assistant turn (one `message.id`) is written as multiple lines — one per content block. **Every one of those lines repeats the identical, cumulative `usage` object for that turn.** Summing every `type: "assistant"` line naively double- or triple-counts every message. Always deduplicate by `message.id` first — keep exactly one usage record per unique id — before summing. This is the single most common way to get this wrong; the script in Step 4 does it correctly.

Also exclude any line with `isSidechain: true` from the **main** session's own usage — subagent activity is already captured in full from its own `subagents/agent-<id>.jsonl` file, so counting it again from a sidechain-tagged line in the main transcript would double it.

## Step 4 — aggregate with a script, not by hand

Write this script to a temp file and run it with Node (already on `PATH` in any repo `sensible-harness` is installed into). It mirrors `sumUsage` / `aggregateTokenUsage` / `renderTokenUsageMarkdownTable` from `src/track-tokens.ts` exactly: one row per subagent task (its usage entries summed), and a grand total equal to the main session's own usage **plus** every task's usage — so per-task totals, plus the main session's usage, always sum to the grand total with nothing double-counted or dropped (GV-59 AC2). With zero subagent tasks, the task-row list is empty and the grand total is exactly the main session's own usage.

```bash
cat > /tmp/track-tokens-aggregate.mjs <<'NODE_EOF'
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [, , transcriptDir, sessionId] = process.argv;

const ZERO = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

function add(a, b) {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
  };
}

function sumUsage(records) {
  return records.reduce(add, { ...ZERO });
}

// One UsageRecord per unique message.id — see "the deduplication gotcha" above.
function readUsageRecords(jsonlPath, { excludeSidechain = false } = {}) {
  if (!existsSync(jsonlPath)) return [];
  const seen = new Set();
  const records = [];
  for (const line of readFileSync(jsonlPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "assistant") continue;
    if (excludeSidechain && entry.isSidechain) continue;
    const msg = entry.message ?? {};
    if (msg.id === undefined || seen.has(msg.id)) continue;
    seen.add(msg.id);
    const usage = msg.usage ?? {};
    records.push({
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
      cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    });
  }
  return records;
}

function latestModel(jsonlPath) {
  if (!existsSync(jsonlPath)) return "unknown";
  const lines = readFileSync(jsonlPath, "utf8").split("\n").filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === "assistant" && entry.message?.model) return entry.message.model;
    } catch {
      continue;
    }
  }
  return "unknown";
}

const mainUsage = readUsageRecords(join(transcriptDir, `${sessionId}.jsonl`), { excludeSidechain: true });

const subagentsDir = join(transcriptDir, sessionId, "subagents");
const taskFiles = existsSync(subagentsDir)
  ? readdirSync(subagentsDir).filter((f) => f.endsWith(".jsonl"))
  : [];

const taskRows = taskFiles.map((file) => {
  const agentId = file.replace(/\.jsonl$/, "");
  const jsonlPath = join(subagentsDir, file);
  const metaPath = join(subagentsDir, `${agentId}.meta.json`);
  let meta = {};
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      meta = {};
    }
  }
  const totals = sumUsage(readUsageRecords(jsonlPath));
  return {
    agentType: meta.agentType ?? "unknown",
    description: meta.description ?? agentId,
    model: meta.model ?? latestModel(jsonlPath),
    ...totals,
  };
});

const grandTotal = taskRows.reduce((acc, row) => add(acc, row), sumUsage(mainUsage));

const columns = ["Agent / Task", "Agent Type", "Model", "Input", "Output", "Cache Read", "Cache Creation"];
const fmt = (n) => n.toLocaleString("en-US");
const header = `| ${columns.join(" | ")} |`;
const divider = `| ${columns.map(() => "---").join(" | ")} |`;
const rows = taskRows.map(
  (r) =>
    `| ${r.description} | ${r.agentType} | ${r.model} | ${fmt(r.inputTokens)} | ${fmt(r.outputTokens)} | ${fmt(r.cacheReadInputTokens)} | ${fmt(r.cacheCreationInputTokens)} |`,
);
const totalRow = `| **Grand total** |  |  | ${fmt(grandTotal.inputTokens)} | ${fmt(grandTotal.outputTokens)} | ${fmt(grandTotal.cacheReadInputTokens)} | ${fmt(grandTotal.cacheCreationInputTokens)} |`;

console.log([header, divider, ...rows, totalRow].join("\n"));
NODE_EOF

node /tmp/track-tokens-aggregate.mjs "$transcript_dir" "$CLAUDE_CODE_SESSION_ID"
```

## Step 5 — print the report in the session, always

Print the script's markdown table output directly in your final response — this is the deliverable, not a side effect. This happens **unconditionally**: whether or not a driving issue can be identified, and whether or not any subagent tasks were spawned. When there are zero spawned tasks, the table will have a header, a divider, and a single "Grand total" row (no task rows) — that is correct, not a bug; print it as-is.

Do not silently swallow a missing or unreadable transcript file — if the main session transcript itself can't be found even after the fallback in Step 1, say so plainly in your report rather than fabricating numbers or staying silent.

## Step 6 — identify the related issue from the branch name

Reuse the branch-naming convention `pickup-issue`/`dev` already establish (`feature/<KEY>-<slug>` — see `.claude/skills/pickup-issue/SKILL.md` Step 3 of either tracker workflow, and `.claude/agents/dev.md`'s plan-format branch line). This mirrors the pure, unit-tested `extractIssueKeyFromBranch` helper in `src/track-tokens.ts` (tests in `test/unit/track-tokens.test.ts`) exactly, for the same reason Step 4's script mirrors the rest of that module — this repo's own `src/` isn't available at runtime in the target repo.

```bash
git branch --show-current
```

Apply the rule directly to the output: the branch must start with `feature/`; the token immediately after that prefix and up to (but not including) the next `-` is the key when it is either a Jira-style key (an uppercase project code followed by `-<number>`, e.g. `GV-59`) or a bare number (a GitHub issue number, e.g. `41`). Anything else — no `feature/` prefix, or no recognisable key token — means **no related issue was identified**. That is a normal, expected outcome, not an error: skip Step 7 entirely and move straight to reporting what happened (GV-59 AC4). Never guess or fall back to a different branch/commit to find a key.

## Step 7 — post the breakdown to the related issue (only when Step 6 found a key)

Read `.sensible-harness/manifest.json`'s `issueTracker` field — the exact same detection `pickup-issue` already does:

```bash
cat .sensible-harness/manifest.json
```

If the file doesn't exist at all, treat that the same as the field being unset (the GitHub-default case below) rather than erroring.

- **`"jira"`** → post via `acli` (the comment primitive documented in `.claude/skills/jira/SKILL.md`):
  ```bash
  acli jira workitem comment create --key <KEY> --body "$(cat <<'EOF'
  <the exact markdown table + Grand total row Step 4's script printed>
  EOF
  )"
  ```
- **`"github"`** (or the field missing/`null` — GitHub is the default) → post via `gh`:
  ```bash
  gh issue comment <KEY> --body "$(cat <<'EOF'
  <the exact markdown table + Grand total row Step 4's script printed>
  EOF
  )"
  ```

The comment body is exactly the markdown table from Step 4/5 — the same task-by-task breakdown and Grand total row already shown in-session, not a re-summarised, truncated, or reformatted copy.

If the tracker CLI is missing, unauthenticated, or the post command otherwise fails (e.g. `acli`/`gh` not installed, auth expired, the key doesn't resolve to a real issue), do not fail the whole run: note the gap plainly in your final report (which command you tried and what it returned) and still surface the in-session report from Step 5 — that report already ran and is not contingent on the comment succeeding. This is the other half of "never goes fully silent and never errors" (GV-59 AC4): that guarantee covers a tracker-post failure with a key in hand exactly the same way it covers the no-key case in Step 6 — either way, the in-session report already happened and the run ends without an error.

## Out of scope for this step

- Aggregating any session other than the current one (no cross-session history).
- Dollar-cost conversion — token counts only.
- Associating a session with an issue by any means other than the current branch name (e.g. commit messages, PR links, an explicit argument) — deferred, per the issue's own out-of-scope note on session-to-issue association.
