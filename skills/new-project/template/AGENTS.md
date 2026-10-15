# AGENTS.md

Instructions for coding agents working in this repository. `CLAUDE.md` imports this file.
Keep it to what an agent cannot derive from the code in two tool calls.

## What this is

{One paragraph: what the project does, for whom, where it runs.}

## Architecture

{The shape of the system: main modules, data flow, where state lives. Point to docs instead
of duplicating them.}

## Invariants and traps

{Rules the code or database does not enforce by itself, and things that look wrong but are
intentional. Example: "Money is stored as integer cents", "Migrations are applied by hand".}

## Conventions

{Naming, language of user-facing text, formatting helpers to reuse, shared UI primitives.}

## Docs

- `docs/brainstorms/` — requirements explorations
- `docs/plans/` — implementation plans (`YYYY-MM-DD-NNN-<type>-<slug>-plan.md`)
- `docs/design/<section>/` — UI mockups
- Vault note: `1. Projects/{Context}/{Project}/{Project}.md` (status, decisions and roadmap
  live there — see the `obsidian-vault` skill)
