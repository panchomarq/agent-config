---
name: new-project
description: Scaffold a new repository with the user's standard layout (git on main, README, AGENTS.md as the single agent-instructions file, CLAUDE.md importing it, docs/plans, docs/brainstorms, docs/design) and register it in the Obsidian vault. Use when starting any new project, or when an existing repo lacks AGENTS.md or this layout.
---

# New project

Run this at the start of every new project, before writing application code. Don't wait to
be asked.

## 1. Repository

```bash
git init -b main          # default branch is always main
```

For an existing repo, skip `git init` and only fill in what is missing — never overwrite
existing files.

## 2. Copy the template

`template/` (next to this file) holds the standard skeleton:

```
AGENTS.md              ← agent instructions, single source for every agent
CLAUDE.md              ← contains only "@AGENTS.md"
README.md              ← what / architecture / prerequisites / setup / run / usage
docs/brainstorms/      ← requirements explorations
docs/plans/            ← YYYY-MM-DD-NNN-<type>-<slug>-plan.md
docs/design/           ← UI mockups, one folder per section
```

Copy it without clobbering (`cp -rn <skill-dir>/template/. .`), then fill in every `{…}`
placeholder from what you know about the project. Delete a section rather than leave a
placeholder in it. If the project already has a `CLAUDE.md` with real content, move that
content into `AGENTS.md` and leave `@AGENTS.md` as the only line of `CLAUDE.md`.

## 3. Tooling guardrails

Set up the stack's toolchain from the global instructions as part of the first commit:
linter, formatter, type checker, test runner, and `prek install` with hooks that run them.
A `.gitignore` for the stack that also ignores `.claude/worktrees/`, and `.env.example` if the
project reads environment variables (`.env*` files other than the example stay ignored).

## 4. First commit and remote

```bash
git add -A && git commit -m "chore: initial project scaffold"
```

Ask before creating the GitHub repo (name and visibility are the user's call). Then
`gh repo create <name> --private --source . --push` — the initial push to an empty `main` is
the only direct push to `main` ever allowed.

## 5. Vault

Load the `obsidian-vault` skill and create the project's folder and main note,
`1. Projects/<Context>/<Project>/<Project>.md`, from its `templates/Proyecto.md`, with the repo
path in the `| Repo |` row, the stack and a first roadmap phase. Add the project's row to the
context's index note. Ask which context the project belongs to if it isn't clear.
