@~/.agents/AGENTS.md

# Claude Code specifics

Everything above is shared with every other agent. This section only covers Claude Code.

- **Model routing.** Planning, architecture, data models, security, migrations, non-trivial
  debugging and PR review stay with the main model. Mechanical, well-scoped work (renames,
  routine tests for already-designed logic, broad repo searches, applying a defined pattern
  across files, CRUD boilerplate) may be delegated to an `Agent` subagent with
  `model: "sonnet"`. This is an explicit authorization to use subagents for that split. Skip
  delegation when handing over context costs more than doing the work inline.
- **A running session cannot switch its own model.** If a task needs a stronger model than the
  current session, say so and suggest `/model` or `/clear` instead of doing it silently.
- **Auto memory vs this repo.** Personal facts (paths on this machine, project state, people)
  go to auto memory. A workflow rule that applies to every project goes to
  `global/AGENTS.md` in the agent-config repo instead, so every agent and machine gets it.
- **Settings.** `~/.claude/settings.json` is merged from `agents/claude/settings.json` in the
  agent-config repo on every install. Change shared settings there; machine-only settings
  (permission allowlists) go in `~/.claude/settings.local.json`.
