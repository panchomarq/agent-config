---
name: obsidian-vault
description: Read and write the user's Obsidian vault, the agents' long-term memory and the source of truth for project status, roadmaps, decisions, findings and system changelogs. Use before working on or answering about any project, when recording a decision or finding, when creating, moving or archiving a note, when closing a roadmap item, and after any change to the OS, agent configuration, installed software or hardware.
---

# Obsidian vault

The vault is where the user plans and tracks everything, and it is the agents' long-term
memory: every decision, finding and status change of every project lives there, so any later
session — this agent or another — can pick up with full context. Whatever only lives in chat,
commits or agent memory is lost to the user and to the next agent. Write there as you go, not
only when asked.

## 1. Locate the vault

```bash
vault-write --where
```

Prints the vault root and the system changelog note, or explains why the vault is unreachable
(e.g. the external drive is not mounted). The location comes from
`~/.config/agent-config/config.env` — never hardcode or guess a path.

If the vault is unreachable: say so. Don't answer status questions from memory or from code
alone. Changelog entries still work (they are queued, see §7).

## 2. Read before you write

Before working on a project or answering anything about it:

1. Open the context's index note (§3) and find the project's row.
2. Read the project's main note, then every note of its folder that bears on the task.
3. Search the whole vault for the topic (`rg -i '<term>' "<vault root>"`): related decisions
   often live in another project's note, in an area or in a context-wide note.

Before creating a note, look for an existing one for that project or topic and extend it.

## 3. Where a note goes

PARA, with a context level inside Projects and Archive. A context is a sphere the user works
in: their employer, `Personal`, a business of their own.

```
Home.md                               map of the vault; the only note at the root
1. Projects/
  <Context>/
    Proyectos <Context>.md            the context's index (tag `indice`), one row per project
    Proyectos <Context> - <Topic>.md  a note that spans several projects of the context
    <Project>/
      <Project>.md                    main note: what it is, repo, status, decisions, changelog
      <Project> - <Topic>.md          roadmap, research, runbook, audit, agent task…
2. Areas/<Area>.md                    ongoing responsibility with no end date (health, a job)
3. Resources/<Topic>.md               reference material not tied to one project
4. Archive/
  Proyectos Archivados.md             index of archived projects
  <Context>/<Project>/                a finished or abandoned project, with its whole folder
  <Area>.md                           an area that no longer applies (a former job)
Daily/<Trabajo|Personal>/YYYY-MM-DD.md
Templates/                            the vault's own Obsidian templates
```

| What you are writing | Where it goes |
|---|---|
| Status, decision, finding or changelog line of a project | The project's main note, in its section (§5) |
| A roadmap or a topic too large for the main note | `<Project> - <Topic>.md` in the project's folder, linked from the main note |
| A task handed to another agent | `<Project> - <Task>.md` in the project's folder, from `templates/PRD - Agent Task.md` |
| A new project | New folder `1. Projects/<Context>/<Project>/` with `<Project>.md` from `templates/Proyecto.md`, plus a row in the context's index |
| Something that spans several projects of one context | A note at the context's root, linked from its index |
| A change to the machine, agents, software or hardware | `vault-write` (§7), never by hand |
| Knowledge not tied to one project | `3. Resources/` |
| A project that ended or was abandoned | Move its folder to `4. Archive/<Context>/`, set its `Estado`, move its row from the context's index to `Proyectos Archivados` |

Rules:

- **Every project has its own folder**, even with a single note, and the folder is named
  exactly like its main note. Nothing goes loose in `1. Projects/` or in a context's root
  except the index and context-wide notes.
- **A project's main note names its repo** in a `| Repo |` row with the local path. Tools find
  the note of the repository a session runs in by that row, then by the folder's name.
- **Note names are unique in the whole vault**, because wikilinks resolve by name. Start every
  note of a project folder with the project's name.
- **Moving a note is safe; renaming it is not.** Links don't carry folders, so a move keeps them.
  If a rename is needed, update every `[[link]]` to it in the same change.
- **Unclear context?** Ask the user once. Don't guess between work and personal.

## 4. Style (always)

- Spanish.
- File names with spaces and Title Case words (`Mi Proyecto - Roadmap.md`), not snake_case.
- YAML frontmatter with `tags` and `date` (the note's creation date):
  ```yaml
  ---
  tags: [<tipo>, <contexto>, <tema>]
  date: YYYY-MM-DD
  ---
  ```
  The first tag is the note's type: `proyecto`, `indice`, `area`, `recurso`, `archivo`, `prd`
  or `daily`. Notes under `1. Projects/` and `4. Archive/<Context>/` carry their context in
  lower case as the second tag. Then free topic tags. No status tags (`activo`, `archivado`):
  status lives in the `Estado` row and in the folder.
- Wikilinks between notes: `[[Nombre de la nota]]`, `[[Nota#Sección]]`.
- Markdown tables for structured data, code fences for directory trees and commands.
- Roadmaps: phases as headings, items as `- [ ]` / `- [x]` checkboxes, a changelog at the end.
- Absolute dates (`2026-07-25`), never "ayer" or "la semana pasada".

## 5. Project notes

- **Status questions:** read every note of the project (not only the roadmap), then the repo's
  `AGENTS.md`/docs, reconcile, and report. Mark what disagrees.
- **Decisions and findings:** bugs found, design decisions, verified facts about the data — add
  them to `## Decisiones y hallazgos` of the main note when they happen, dated, with the reason
  and what was ruled out, so a later agent does not reopen a settled question.
- **Closing work:** when a PR is opened or a phase closes, tick the roadmap checkboxes and add a
  line to the note's changelog table.
- **Leaving a session:** if the project's state changed, leave in the main note what is done,
  what is pending and where to resume (branch, PR, worktree).
- **The repo wins for what it versions.** For a schema, an API or code docs, summarize in the
  note and point to the file in the repo instead of copying it.

## 6. Templates

`templates/` next to this file holds `Proyecto.md` (a project's main note) and
`PRD - Agent Task.md` (a task for another agent).

## 7. System changelog → `vault-write`

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
