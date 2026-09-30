# agent-config

Mi configuración de trabajo con agentes de código (Claude Code, Codex, Gemini CLI, OpenCode,
Pi), empaquetada para instalarse igual en cualquier PC.

No contiene datos personales: ni memorias, ni historial, ni credenciales, ni rutas de una
máquina en particular. Contiene **cómo trabajo**: instrucciones globales, skills, plantillas
de proyecto, convenciones del vault de Obsidian, settings y statusline de Claude Code.

## Qué instala

```
agent-config/
├── global/AGENTS.md          instrucciones para TODOS los agentes (fuente única)
├── skills/                   skills en formato estándar (SKILL.md)
│   ├── obsidian-vault/       cómo leer/escribir el vault + plantillas de notas
│   └── new-project/          estructura estándar de repos + plantilla
├── agents/
│   ├── claude/               CLAUDE.md, settings.json, statusline.sh, comandos
│   └── opencode/             opencode.json (modelos locales vía Ollama)
├── bin/vault-write           registra cambios en el changelog del vault
├── config.env.example        plantilla de la config local de cada máquina
├── docs/inventory.md         qué está activo, desactivado o retirado, y por qué
├── install.sh                instalador / actualizador
└── tests/                    tests del instalador y de vault-write
```

Cómo lo consume cada agente:

| Agente | Instrucciones | Skills | Extra |
|---|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` → importa `~/.agents/AGENTS.md` | `~/.claude/skills/` | settings, statusline, comandos, plugins |
| Codex | `~/.codex/AGENTS.md` | `~/.agents/skills/` | — |
| Gemini CLI | `~/.gemini/GEMINI.md` | `~/.agents/skills/` | — |
| OpenCode | `~/.config/opencode/AGENTS.md` | `~/.agents/skills/` | `opencode.json` |
| Pi | `~/.pi/agent/AGENTS.md` | `~/.pi/agent/skills/` | — |

Todo son **symlinks al repo**, salvo los JSON (`settings.json`, `opencode.json`), que se
**fusionan** porque los agentes los reescriben: las claves del repo ganan y las que solo
existen en la máquina (por ejemplo, permisos locales) se conservan.

## Instalación en una máquina nueva

Requisitos: `git`, `jq`, `gh` (autenticado) y los agentes que quieras usar. Para los tests
hace falta además `uv`.

```bash
gh repo clone panchomarq/agent-config ~/Documents/projects/agent-config
cd ~/Documents/projects/agent-config
./install.sh
```

Después, completa la config local que crea el instalador en
`~/.config/agent-config/config.env`:

```bash
# Vault en una ruta fija…
VAULT_PATH=~/Obsidian/main-vault
# …o en un disco cuyo punto de montaje cambia (se busca por etiqueta)
VAULT_DRIVE_LABEL=MiDisco
VAULT_SUBDIR=main-vault/main-vault
# Nota con el changelog de ESTA máquina
VAULT_CHANGELOG_NOTE=2. Areas/Sistema - MiMaquina.md
```

Verifica con `vault-write --where`. Si la máquina no tiene el vault, déjalo vacío: las
entradas se encolan localmente (`~/.local/state/agent-config/vault-queue.jsonl`).

Alternativa: abre Claude Code (o cualquier agente) en una máquina nueva y pídele
*"clona panchomarq/agent-config e instálalo siguiendo su README"*.

## Actualizar

No hay sincronización automática. Una versión nueva del repo se aplica así:

```bash
cd "$(sed -n 's/^AGENT_CONFIG_DIR=//p' ~/.config/agent-config/config.env)"
git pull
./install.sh
```

`./install.sh --check` muestra qué está desactualizado sin tocar nada (sale con código 1 si
hay diferencias). Los archivos que el instalador reemplaza se guardan como
`<archivo>.bak-<fecha>`.

## Cambiar la configuración

Como `~/.claude/CLAUDE.md`, las skills, etc. son symlinks, **editarlos es editar el repo**.
El flujo, que cualquier agente conoce porque está en `global/AGENTS.md`:

1. Pedirle el cambio al agente ("de ahora en más, siempre…", "agrega una skill para…",
   "desactiva el plugin X").
2. El agente edita el repo, actualiza `docs/inventory.md` y `CHANGELOG.md`, sube `VERSION`,
   corre `tests/run.sh` y abre un PR.
3. Revisas y mergeas el PR; en cada máquina, `git pull && ./install.sh`.

Dónde va cada cosa:

| Quiero… | Archivo |
|---|---|
| Una regla para todos los agentes y proyectos | `global/AGENTS.md` |
| Un procedimiento reutilizable (con archivos de apoyo) | `skills/<nombre>/SKILL.md` |
| Algo solo de Claude Code | `agents/claude/CLAUDE.md` o `settings.json` |
| Un permiso o ajuste de una sola máquina | `~/.claude/settings.local.json` (fuera del repo) |
| Datos, estado de proyectos, hechos personales | Vault de Obsidian o la memoria del agente (fuera del repo) |

Para **dejar de usar** algo: bórralo del repo (el instalador elimina sus symlinks en cada
máquina) o, si es un plugin, ponlo en `false` en `agents/claude/settings.json`. En ambos
casos, deja una fila en `docs/inventory.md` con la fecha y el motivo.

## Estándares que sigue

- [AGENTS.md](https://agents.md): un único archivo de instrucciones que leen Codex, Gemini
  CLI, OpenCode, Pi, Cursor, Copilot y otros. Claude Code lo importa desde `CLAUDE.md`.
- [Agent Skills](https://agentskills.io): `SKILL.md` con frontmatter `name` / `description`
  y archivos adjuntos; las mismas skills funcionan en todos los agentes.
- Estructura de proyecto: `AGENTS.md` + `CLAUDE.md` con `@AGENTS.md`, planes en `docs/plans/`
  (ver skill `new-project`).
- [SemVer](https://semver.org/lang/es/) + [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## Desarrollo

```bash
tests/run.sh    # shellcheck, ruff, JSON, inventario, tests del instalador y de vault-write
```

El CI corre lo mismo en cada PR.
