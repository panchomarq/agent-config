---
name: obsidian-vault
description: Read and write the user's Obsidian vault, the source of truth for project status, roadmaps, findings and system changelogs. Use before answering any project status question, when recording a finding or decision, when closing a roadmap item, and after any change to the OS, agent configuration, installed software or hardware.
---

# Obsidian vault

The vault is where the user plans and tracks everything. Whatever only lives in chat, commits
or agent memory is lost to them. Write there as you go, not only when asked.

## 1. Locate the vault

```bash
vault-write --where
```

Prints the vault root and the system changelog note, or explains why the vault is unreachable
(e.g. the external drive is not mounted). The location comes from
`~/.config/agent-config/config.env` — never hardcode or guess a path.

If the vault is unreachable: say so. Don't answer status questions from memory or from code
alone. Changelog entries still work (they are queued, see §4).

## 2. Structure (PARA)

| Folder | Holds |
|---|---|
| `1. Projects/` | Active projects: one note per project, or a folder with `<Project>.md` plus `<Project> - <Topic> Roadmap.md` notes |
| `2. Areas/` | Ongoing responsibilities without an end date. `Sistema - <OS>.md` documents the machine and holds its `## Changelog` |
| `3. Resources/` | Reference material |
| `4. Archive/` | Finished or inactive items |
| `Daily/` | Daily notes |
| `Templates/` | The vault's own note templates |

Before creating a note, look for an existing one for that project or topic and extend it.

## 3. Style (always)

- Spanish.
- File names with spaces and Title Case words (`Mi Proyecto - Roadmap.md`), not snake_case.
- YAML frontmatter with at least `tags` and `date`:
  ```yaml
  ---
  tags: [proyecto, <tema>]
  date: YYYY-MM-DD
  ---
  ```
- Wikilinks between notes: `[[Nombre de la nota]]`, `[[Nota#Sección]]`.
- Markdown tables for structured data, code fences for directory trees and commands.
- Roadmaps: phases as headings, items as `- [ ]` / `- [x]` checkboxes, a changelog at the end.
- Absolute dates (`2026-07-25`), never "ayer" or "la semana pasada".

## 4. System changelog → `vault-write`

For changes to the machine, the agents, installed software or hardware, don't edit the
changelog by hand. Use:

```bash
vault-write -c "Claude Code" "Desinstalado el plugin X — no se usaba desde junio"
```

Categories: `Claude Code`, `Agentes`, `Sistema`, `Software`, `Hardware`, `Repositorios`,
`Configuración`, `Vault`.

It appends `- **Categoría**: descripción` under `### YYYY-MM-DD` in the `## Changelog`
section, keeping dates in ascending order. If the vault is unreachable the entry goes to a
local queue; `vault-write --flush` writes queued entries with their original dates once the
vault is back. Run `vault-write --flush` whenever you find the vault reachable and
`vault-write --where` reports pending entries.

One line per change, written so the user can understand it months later: what changed, where,
and why.

## 5. Project notes

- **Status questions:** read every note of the project (not only the roadmap), then the repo's
  `AGENTS.md`/docs, reconcile, and report. Mark what disagrees.
- **Findings:** bugs found, design decisions, verified facts about the data — add them to the
  project note when you find them, under the section that fits, with the date.
- **Closing work:** when a PR is opened or a phase closes, tick the roadmap checkboxes and add a
  line to the note's changelog table.
- **New project note:** start from `templates/Proyecto.md` (next to this file).
- **Handing a task to another agent:** write it from `templates/PRD - Agent Task.md` (next to
  this file) and save it under the project's folder in `1. Projects/`.
