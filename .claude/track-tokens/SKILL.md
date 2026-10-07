---
name: track-tokens
description: Manual start/stop token accounting per task. Use when the user wants to track how much token/cost a specific task, ticket, or piece of work consumed — "track tokens", "how much did this task cost", "start tracking tokens", "end task tracking", "token report", "/track-tokens". Reads real usage numbers from the Claude Code session transcript, never estimates.
---

# track-tokens

Per-task token accounting, built on real numbers pulled from the active session transcript (same technique as caveman-stats) — never an LLM self-estimate.

Task boundaries are **manual**: the user explicitly starts and ends each task. There is no auto-detection of task boundaries — don't invent one.

## Commands

Run via Bash, using the bundled script (Node 14+, no deps):

```
node "$HOME/.claude/skills/track-tokens/scripts/token_tracker.js" start "<task name>"
node "$HOME/.claude/skills/track-tokens/scripts/token_tracker.js" status
node "$HOME/.claude/skills/track-tokens/scripts/token_tracker.js" end
node "$HOME/.claude/skills/track-tokens/scripts/token_tracker.js" report [--today|--all|--since Nd|Nh]
```

Map user intent to these:
- "start tracking / begin task X" → `start "<name>"`. Use the ticket/branch name or a short description the user gives; if they don't give one, ask (don't guess a name for billing records).
- "how much so far" → `status` (does not close the task).
- "done / end task / stop tracking" → `end`. Prints the delta for that task and appends it to the log.
- "show me usage / report / totals" → `report`. Default (no flag) shows all-time. Support `--today` and `--since 7d` / `--since 12h` when the user asks for a specific window.

Only one task can be active at a time. If `start` is called while another is active, the script refuses — tell the user to `end` the current one first (or ask if they meant to end it).

## How it works

- `start` snapshots cumulative input/output/cache-read/cache-creation tokens from the current session's transcript JSONL as a baseline, and records the git branch (cwd) + timestamp.
- `end` re-reads the same transcript, diffs against the baseline, appends one JSON line to `~/.claude/task-tracking/log.jsonl`, and clears the active marker.
- `report` aggregates `log.jsonl` by task name.
- State lives in `~/.claude/task-tracking/` (`active.json` for the in-progress task, `log.jsonl` for completed ones) — global across all projects, so it works the same in any repo.
- USD estimates use a small model-prefix pricing table in the script; update it there if pricing changes. If the model isn't recognized, `est=n/a`.

## Caveats to tell the user if relevant

- Granularity is per completed transcript turn — tokens spent mid-turn (e.g. the very turn where `end` is invoked) are still counted since the tool-call flushes prior turns, but tell the user report figures reflect turns *completed* by the time the command runs.
- This tracks one session's transcript. If the user switches sessions/machines mid-task, the baseline in `active.json` still points at the original transcript file, so numbers stay correct as long as that file keeps growing — but a brand-new session for the same task would need its own `start`.
