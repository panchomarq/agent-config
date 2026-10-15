# Inventario

Qué incluye esta configuración, en qué estado está y por qué. `tests/run.sh` falla si una
skill, comando o plugin del repo no aparece acá.

Estados: **activo** (se instala y se usa) · **desactivado** (declarado en `false`: no se
instala en máquinas nuevas, queda apagado donde ya estaba) · **retirado** (ya no está en el
repo; se deja registro del motivo).

## Agentes

| Agente | Qué recibe | Cómo |
|---|---|---|
| Claude Code | Todo: `CLAUDE.md`, skills, `settings.json`, statusline, comandos, plugins | `~/.claude/` |
| Codex | Instrucciones globales + skills | `~/.codex/AGENTS.md`, `~/.agents/skills/` |
| Gemini CLI | Instrucciones globales + skills | `~/.gemini/GEMINI.md`, `~/.agents/skills/` |
| OpenCode | Instrucciones globales + skills + `opencode.json` (Ollama local) | `~/.config/opencode/`, `~/.agents/skills/` |
| Pi | Instrucciones globales + skills | `~/.pi/agent/AGENTS.md`, `~/.pi/agent/skills/` |

Codex, Gemini, OpenCode y Pi solo se configuran si están instalados (CLI en el `PATH` o su
carpeta de config ya existe).

## Skills (estándar Agent Skills, `skills/`)

| Skill | Estado | Para qué |
|---|---|---|
| `obsidian-vault` | activo | Convenciones del vault (PARA, español, frontmatter), status desde el vault, registro de cambios con `vault-write`. Trae las plantillas `Proyecto.md` y `PRD - Agent Task.md` |
| `new-project` | activo | Estructura estándar de repo: `main`, README, `AGENTS.md` + `CLAUDE.md` → `@AGENTS.md`, `docs/{brainstorms,plans,design}`, nota en el vault |

Skills externas que **no** gestiona este repo: `omarchy` (la instala Omarchy en
`~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills` y `~/.pi/agent/skills`).

## Comandos de Claude Code (`agents/claude/commands/`)

| Comando | Estado | Notas |
|---|---|---|
| `review-pr` | activo | La pasada A usa agentes del plugin `pr-review-toolkit`, que hoy no está instalado |
| `fix-issue` | activo | Misma dependencia de `pr-review-toolkit` en su paso de revisión |

## Herramientas (`bin/`)

| Herramienta | Estado | Para qué |
|---|---|---|
| `vault-write` | activo | Agrega entradas al `## Changelog` del vault; las encola si el vault no está disponible |

## Plugins de Claude Code (`agents/claude/settings.json`)

| Plugin | Estado | Desde | Motivo |
|---|---|---|---|
| `playwright@claude-plugins-official` | activo | 2026-05-25 | Automatización de browser |
| `vercel@claude-plugins-official` | activo | 2026-05-25 | Deploys y guías de Vercel (el más usado) |
| `compound-engineering@compound-engineering-plugin` | activo | 2026-05-25 | Flujo brainstorm → plan → work → review |
| `task-progress@agent-config` | activo | 2026-10-07 | Mod propio (`agents/claude/mods/task-progress`): progreso de la tarea junto a la statusline; desde 2026-10-09 con tamaños S/M/L, tiempo restante, crecimiento del plan, `/progress` y aviso con `/goal` (ideas de Goal Meter) |
| `blast-radius@agent-config` | activo | 2026-10-09 | Mod de Anthropic (`claude-code-playground`), fijado por `sha`: frena comandos destructivos con `defaultMode: auto` |
| `collision-guard@agent-config` | activo | 2026-10-09 | Mod de Nate Herk, fijado por `sha`: evita que dos chats editen el mismo archivo |
| `github@claude-plugins-official` | desactivado | 2026-08-05 | Sin uso en 130 arranques; `gh` cubre lo mismo |
| `skill-creator@claude-plugins-official` | desactivado | 2026-08-05 | Sin uso |
| `context7@claude-plugins-official` | desactivado | 2026-08-05 | Sin uso |
| `frontend-design@claude-plugins-official` | desactivado | 2026-08-05 | Un solo uso |
| `chrome-devtools-mcp@claude-plugins-official` | desactivado | 2026-08-05 | Se superpone con `playwright` |

Evaluados y no adoptados (2026-10-09): `goal-meter` (choca con `task-progress`: otra herramienta
de plan y el mismo pie; se tomaron sus ideas), `token-weather` (repite la barra de contexto de la
statusline), `replay-theater` (se superpone con `/diff`), `cache-keeper`, `recording-mode` y
`next-steps`.

## Retirados

| Qué | Fecha | Motivo |
|---|---|---|
| Plugin `claude-mem@thedotmack` | 2026-07-25 | Dejaba cientos de procesos huérfanos (`chroma-mcp`, workers de `bun`) |
| Hook `rtk-rewrite.sh` + `RTK.md` | 2026-09-30 | `rtk` no estaba instalado: el hook no hacía nada y la doc describía una herramienta inexistente |
| MCP `headroom` | 2026-09-30 | El binario no estaba instalado |
| MCP `codebase-memory-mcp` | 2026-09-30 | Nunca llegó a conectar; estaba declarado en `settings.json`, que no es donde Claude Code registra MCP servers |
| `vault-write` con Gemma/Ollama | 2026-09-30 | Reemplazado por la versión determinista: la anterior apuntaba a un punto de montaje viejo y escribía el changelog en orden inverso |
