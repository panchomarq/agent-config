# AGENTS.md

Instructions for agents working **on this repository**. (The instructions this repo installs
for every agent live in `global/AGENTS.md` — don't confuse the two.)

## What this is

A boilerplate of the user's coding-agent setup: global instructions, skills, Claude Code
settings, statusline, commands, templates and the `vault-write` tool. `install.sh` symlinks
it into each agent's config directory on any machine. Updating a machine means
`git pull && ./install.sh`; there is no background sync.

## Hard rules

- **No personal data.** No names, emails, home paths, drive labels, project names, finances,
  tokens, memories or chat history. Examples use placeholders (`{Project}`, `MyDrive`).
  Machine-specific values go in `~/.config/agent-config/config.env` (from
  `config.env.example`), which is never committed.
- **Agent-agnostic first.** Instructions go in `global/AGENTS.md` and reusable procedures in
  `skills/<name>/SKILL.md` (Agent Skills standard: YAML frontmatter with `name` and
  `description`, bundled files next to it). Only put something under `agents/<agent>/` when
  it is truly specific to that agent.
- **Installer contract.** `install.sh` must stay idempotent, never delete a user file (back it
  up as `<file>.bak-<timestamp>`), never touch symlinks that don't point into this repo, and
  keep `--check` side-effect free. JSON configs are merged (`jq` deep merge, repo wins), not
  linked, because agents rewrite them.
- **Third-party skills are copies.** A skill listed under "Skills de terceros" in
  `docs/inventory.md` was copied from the repo and commit recorded there. Don't edit it in
  place: update it by re-copying from a newer commit and reading the diff, and record any local
  change in that table.
- **Retiring something** = delete it from the repo (the installer prunes its symlinks on every
  machine) or set a plugin to `false` in `agents/claude/settings.json`, and add a row to the
  "Retirados" / state table in `docs/inventory.md` with date and reason.

## Layout

| Path | Installed to |
|---|---|
| `global/AGENTS.md` | `~/.agents/AGENTS.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.config/opencode/AGENTS.md`, `~/.pi/agent/AGENTS.md` |
| `skills/*` | `~/.agents/skills/`, `~/.claude/skills/`, `~/.pi/agent/skills/` |
| `agents/claude/CLAUDE.md` | `~/.claude/CLAUDE.md` (imports `~/.agents/AGENTS.md`) |
| `agents/claude/settings.json` | merged into `~/.claude/settings.json` |
| `agents/claude/statusline.sh`, `commands/*` | `~/.claude/` |
| `agents/claude/mods/*` | plugins of the `agent-config` marketplace (`.claude-plugin/marketplace.json`), installed by `claude plugin install` |
| `agents/opencode/opencode.json` | merged into `~/.config/opencode/opencode.json` |
| `bin/*` | `~/.local/bin/` |
| `config.env.example` | copied once to `~/.config/agent-config/config.env` |

## Every change

1. Run `tests/run.sh` (shellcheck, ruff, JSON validity, inventory and skill checks, installer
   tests in a throwaway `HOME`, status line tests, `vault-write` tests). It must pass with zero
   warnings.
2. Update `docs/inventory.md` when adding, disabling or retiring anything.
3. Add an entry under `## [Unreleased]` in `CHANGELOG.md`; on release, bump `VERSION`
   (SemVer: breaking layout/installer change = major, new skill or setting = minor,
   fix/wording = patch), rename the section and tag `vX.Y.Z` after merge.
4. Branch + PR against `main`. Never push to `main`.
5. After merging, run `./install.sh` on this machine and log the change with
   `vault-write -c Agentes "…"`.
