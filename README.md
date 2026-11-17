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
├── global/gitignore          líneas que se suman al ignore global de git (p. ej. graphify-out/)
├── skills/                   skills en formato estándar (SKILL.md)
│   ├── obsidian-vault/       cómo leer/escribir el vault + plantillas de notas
│   ├── new-project/          estructura estándar de repos + plantilla
│   └── …                     skills de terceros (Google Cloud, Tag Manager): ver el inventario
├── agents/
│   ├── claude/               CLAUDE.md, settings.json, statusline.sh, comandos, mods/
│   └── opencode/             opencode.json (modelos locales vía Ollama)
├── bin/vault-write           registra cambios en el changelog del vault
├── config.env.example        plantilla de la config local de cada máquina
├── docs/inventory.md         qué está activo, desactivado o retirado, y por qué
├── docs/third-party-licenses/  licencias de las skills copiadas de terceros
├── install.sh                instalador / actualizador
└── tests/                    tests del instalador, de la statusline y de vault-write
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
existen en la máquina se conservan. Las listas de permisos (`permissions.allow`, `ask` y
`deny`) se unen: quedan las reglas de la máquina y se suman las del repo.

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

El instalador agrega los plugins activados que falten y actualiza los mods del marketplace
`agent-config` que ya estén instalados (`--check` no los actualiza: para saber si hay una
versión nueva tendría que traerla). Si un plugin no se puede instalar o actualizar, sigue con
los demás y al final sale con código 1 nombrando los que fallaron. Las sesiones abiertas toman
los cambios al reiniciarse o con `/reload-plugins`.

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
| Un permiso para todos los proyectos y máquinas | `permissions` en `agents/claude/settings.json` |
| Un permiso o ajuste de una sola máquina | `~/.claude/settings.json` (fuera del repo; el instalador conserva lo que el repo no define) |
| Un permiso de un solo proyecto | `.claude/settings.local.json` en ese proyecto |
| Datos, estado de proyectos, hechos personales | Vault de Obsidian o la memoria del agente (fuera del repo) |

Para **dejar de usar** algo: bórralo del repo (el instalador elimina sus symlinks en cada
máquina) o, si es un plugin, ponlo en `false` en `agents/claude/settings.json`. En ambos
casos, deja una fila en `docs/inventory.md` con la fecha y el motivo.

## Statusline de Claude Code

`agents/claude/statusline.sh` muestra hasta tres filas:

```
[Opus 5.5 · xhigh] mi-repo │ mi-rama
▉⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ 8% │ $0.62 │ 2m 5s ↻95%
5h ████████⣿⣿⣿⣿ 67% ↺ 4h 3m │ 7d ███████████⣿ 92% ↺ 1d 6h
```

1. Modelo, nivel de esfuerzo, carpeta y rama.
2. Contexto **usado**, costo de la sesión, duración y porcentaje de tokens leídos de caché.
3. Límites de la suscripción (ventana de 5 horas y semanal): porcentaje que **queda** y tiempo
   hasta que se reinicia. Solo aparece en cuentas Pro/Max, después de la primera respuesta de
   la sesión.

Los límites son de la cuenta, pero cada sesión solo recibe la lectura de su última respuesta,
así que varias sesiones abiertas verían valores distintos. Por eso cada sesión publica la
lectura más reciente en `~/.cache/agent-config/claude-rate-limits.json` (bajo
`$XDG_CACHE_HOME` si está definido) y todas muestran esa; con el `refreshInterval` de 60 s,
una sesión inactiva se pone al día en un minuto. Dos cosas a tener en cuenta: el uso hecho
fuera de Claude Code en esta máquina (claude.ai, otra PC) aparece recién cuando una sesión
local recibe su siguiente respuesta, y el archivo supone una sola cuenta por máquina.

Las barras y sus porcentajes van en verde con la mitad o más disponible, en ámbar por debajo
de la mitad y en rojo por debajo de un quinto. Son colores de 24 bits, así que no dependen de
la paleta del tema del terminal.

## Columna de sesión de Claude Code

`agents/claude/mods/task-progress` muestra, al costado de la conversación de cada pestaña, lo
que está pasando en esa sesión. Mientras corren subagentes o agentes de un workflow, la columna
los lista: cuánto llevan, cuántas herramientas usaron y su última acción. Diez segundos después
de que termina el último, vuelve al tablero del proyecto:

```
mi-proyecto                 Mi Proyecto - Roadmap

AHORA
◆ Migrar auth a JWT                          4/6
  ████████⣿⣿⣿⣿ 67%
  Corriendo tests · 2m 14s · ~1m

SIGUE                               12/30 hechas
○ Confirmar el formato de fechas
○ Revisar el PR de pagos

LO ÚLTIMO
✔ #41 group the menu
```

- **Ahora** sale de los pasos que Claude declara con la herramienta `mcp__task-progress__plan`,
  que el mod registra y explica en el system prompt. Cada paso lleva un tamaño S, M o L que
  pesa 1, 2 o 3 en el porcentaje. Con dos pasos terminados aparece el tiempo que queda (`~1m`),
  y si el plan crece el conteo lo dice (`4/8 (+2)`). Si el turno termina con pasos pendientes
  queda en ámbar (`te necesita`). `/progress` imprime el plan completo y `/goal` le pide a
  Claude que lo declare antes de empezar.
- **Sigue** sale de la nota del proyecto en el vault (`vault-write --where` dice dónde está):
  las primeras casillas sin marcar de la primera sección `## ` que todavía tiene alguna. La nota
  se busca en `1. Projects/` y sus carpetas de contexto (`1. Projects/<Contexto>/<Proyecto>/`):
  primero la nota principal cuya fila `| Repo |` nombre la ruta del repo, y si ninguna la
  nombra, la del proyecto que se llama como la carpeta del repo.
- **Lo último** son los últimos tres merges de la rama principal del repo.

La columna solo puede ir al costado en el modo de pantalla completa de la terminal, que es el
de por defecto fuera de tmux. Se abre sola desde 144 columnas. En una pestaña más angosta, la
misma información va en un header de dos filas arriba del cuadro de texto, y `/columna` acopla
la columna desde 110 columnas. `/columna` también la cierra, y queda cerrada hasta que se vuelva
a pedir.

Se instala con `./install.sh` (el repo es el marketplace `agent-config`). Para desarrollarlo:
`claude --plugin-dir agents/claude/mods/task-progress`; las pruebas corren con
`claude plugin test agents/claude/mods/task-progress`.

## Mods de terceros

El marketplace `agent-config` también sirve mods ajenos, cada uno fijado con `sha` al commit
que se revisó, así que nada cambia en las máquinas hasta que se sube ese `sha` a mano (después
de leer el diff y pasar `claude plugin validate`):

| Mod | Origen | Qué hace |
|---|---|---|
| `blast-radius` | [anthropics/claude-code-playground](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods/blast-radius) | Frena `rm -rf`, `git reset --hard`, `git clean`, force push y migraciones, muestra qué cambiarían y espera Proceed / Cancel |
| `collision-guard` | [nateherkai/claude-code-mods](https://github.com/nateherkai/claude-code-mods/tree/main/collision-guard) | Pregunta antes de editar un archivo que otro chat abierto cambió en los últimos 30 min y ofrece pasar el trabajo a un worktree (`/guard` para ver estado o apagarlo) |

## Grafo de código (graphify)

[graphify](https://github.com/Graphify-Labs/graphify) arma un grafo de cada repo (archivos,
símbolos, imports y llamadas) con tree-sitter, en local y sin LLM, para que los agentes
consulten la estructura en lugar de releer el código. `install.sh` no lo instala; se instala
una vez por máquina, fijado a la versión revisada:

```bash
uv tool install --python 3.13 "graphifyy[sql]==0.9.111"
```

En un repo:

```bash
GRAPHIFY_BACKEND=none graphify extract . --code-only   # primer grafo (segundos)
GRAPHIFY_BACKEND=none graphify cluster-only .          # GRAPH_REPORT.md y graph.html
graphify query "¿cómo se calculan los pagos?"          # subgrafo para una pregunta
graphify update .                                      # después de cambiar código
```

Qué agrega el repo: la regla de uso en `global/AGENTS.md`, que leen todos los agentes. En
Claude Code, además, hooks que recuerdan el grafo antes de buscar o leer código en un repo que
lo tiene, y `GRAPHIFY_BACKEND=none` para que graphify nunca llame a un modelo. Por último,
`graphify-out/` en el ignore global de git. Detalle y lo que se descartó, en
`docs/inventory.md`.

## Navegador de Playwright

El plugin `playwright` corre el navegador oculto (`PLAYWRIGHT_MCP_HEADLESS`) y con un perfil
temporal por sesión (`PLAYWRIGHT_MCP_ISOLATED`), así varias sesiones abiertas no abren ventanas
en el escritorio ni compiten por el mismo perfil. Los dos valores están en `env` de
`agents/claude/settings.json`.

Playwright busca Google Chrome. En una máquina que no lo tiene, indica el navegador instalado
en `~/.claude/settings.json`:

```json
"env": { "PLAYWRIGHT_MCP_EXECUTABLE_PATH": "/ruta/al/navegador" }
```

El instalador conserva ese valor al mezclar la configuración del repo. Va en
`~/.claude/settings.json` y no en `~/.claude/settings.local.json`, porque ese archivo solo se
aplica a las sesiones abiertas en `~`. El cambio vale para las sesiones nuevas.

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
tests/run.sh    # shellcheck, ruff, JSON, inventario, mods y tests (instalador, statusline, vault-write)
```

El CI corre lo mismo en cada PR.
