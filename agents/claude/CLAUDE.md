@~/.agents/AGENTS.md

# Claude Code specifics

Everything above is shared with every other agent. This section only covers Claude Code.

- **Model routing.** The main model thinks; cheaper models gather. Planning, architecture,
  data models, security, migrations, non-trivial debugging, PR review, synthesis and the final
  check of any claim a decision depends on stay with the main model. Gathering goes to
  subagents on a cheaper model: web and documentation research, surveying a codebase or a
  dataset, extracting facts from files, and mechanical well-scoped work (renames, routine
  tests for already-designed logic, applying a defined pattern across files, CRUD boilerplate)
  run with `model: "sonnet"`; a lookup whose target is already known runs with
  `model: "haiku"`. Delegated gathering runs at `high` effort unless I ask for more. This
  holds with Ultracode on and at max effort: those raise how deeply the main model plans,
  verifies and synthesises, not the model the gatherers run on. Move one task up to the main
  model only after a cheaper model has failed it. This is an explicit authorization to use
  subagents for that split. Skip delegation when handing over context costs more than doing
  the work inline.
- **Agent fleets fit the usage window.** Prepare the inputs before fanning out (digest large
  files with a script, list the sources, say what is already known), cap tool calls in each
  brief, and have every agent write its report as it goes and resume from an existing report
  file. Start with the smallest fleet that covers the work and add agents only after the first
  results land. After a usage-limit reset, check whether interrupted workflows restarted by
  themselves before launching anything.
- **A running session cannot switch its own model.** If a task needs a stronger model than the
  current session, say so and suggest `/model` or `/clear` instead of doing it silently.
- **Auto memory vs this repo.** Personal facts (paths on this machine, project state, people)
  go to auto memory. A workflow rule that applies to every project goes to
  `global/AGENTS.md` in the agent-config repo instead, so every agent and machine gets it.
- **Settings.** `~/.claude/settings.json` is merged from `agents/claude/settings.json` in the
  agent-config repo on every install: the repo's keys win, and the permission lists are
  united, so a rule only this machine has stays. Change shared settings there. A rule for one
  machine goes in `~/.claude/settings.json` itself, and a rule for one project in that
  project's `.claude/settings.local.json`. `~/.claude/settings.local.json` is read only in
  sessions started in the home directory, so a rule there reaches no other project.
- **Pushes.** The shared settings allow `git push` and refuse, before any other check, a push
  that names `main`, a forced push in any spelling, `--all`, `--mirror`, and a push that does
  not name its branch (`git push`, `git push origin`, `git push origin HEAD`): from `main`
  those would push `main` without the rule seeing it. Push with the branch named, from the
  repository's own directory: `git push origin <branch>`.
