# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) ·
Versionado: [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [1.8.0] - 2026-10-15

### Changed

- `task-progress` 0.3.0: el bloque del pie pasa a ser una columna al costado de la conversación.
  Mientras corren subagentes o agentes de un workflow, la columna los lista con su tiempo, sus
  herramientas y su última acción. Sin agentes muestra la tarea, lo que sigue en el roadmap del
  proyecto (la nota del vault que corresponde al repo) y los últimos tres merges. La columna
  se abre sola en pantalla completa desde 144 columnas. En pestañas más angostas la misma
  información va en un header de dos filas arriba del cuadro de texto. `/columna` la abre o la
  cierra.

### Fixed

- `task-progress`: el `turn.start` de un subagente reiniciaba el reloj y el conteo de
  herramientas del turno principal.
- `task-progress`: si `/progress` no se podía registrar, el error se descartaba sin aviso. Ahora
  queda en el log de la sesión.

## [1.6.0] - 2026-10-15

### Added

- Mods `blast-radius` (Anthropic) y `collision-guard` (Nate Herk) en el marketplace
  `agent-config`, como fuentes `git-subdir` fijadas al commit revisado, y activados en
  `agents/claude/settings.json`. `blast-radius` frena `rm -rf`, `git reset --hard`, `git clean`,
  force push y migraciones mostrando qué cambiarían; `collision-guard` pregunta antes de editar
  un archivo que otro chat cambió hace menos de 30 minutos.
- `task-progress` 0.2.0, con ideas de Goal Meter: pasos de tamaño S, M o L que pesan 1, 2 y 3
  en el porcentaje; tiempo restante al ritmo de la tarea desde el segundo paso terminado;
  conteo que marca cuánto creció el plan (`4/8 (+2)`); comando `/progress` con el plan
  completo; y `/goal` pide declarar el plan antes de empezar.

### Changed

- `tests/check_inventory.sh` acepta plugins del marketplace que vienen de otro repositorio
  siempre que estén fijados a un `sha` completo.

## [1.5.0] - 2026-10-15

### Added

- `agents/claude/CLAUDE.md`: regla nueva, las flotas de agentes tienen que caber en la ventana
  de uso. Preparar los insumos antes de repartir el trabajo, poner tope de consultas en cada
  consigna, hacer que cada agente escriba su informe a medida que avanza y pueda retomarlo, y
  revisar si los workflows interrumpidos se relanzaron solos después de un reinicio del límite.

### Changed

- Ruteo de modelos en Claude Code (`agents/claude/CLAUDE.md`): el modelo principal piensa y los
  modelos más baratos juntan información. La investigación web y de documentación, el
  relevamiento de un repo o de datos y la extracción de hechos de archivos pasan a subagentes
  en Sonnet, y las búsquedas puntuales a Haiku, con esfuerzo `high`. Vale también con Ultracode
  activo o con esfuerzo máximo. Planificación, diseño, síntesis y la verificación de lo que
  sostiene una decisión siguen en el modelo principal.

## [1.4.0] - 2026-10-15

### Added

- Reglas de permisos compartidas para `git push` en `agents/claude/settings.json`: Claude Code
  puede empujar una rama nombrada sin pasar por el clasificador del modo automático, y se
  niega antes de cualquier otra revisión un push que nombre `main` (también `HEAD:main`,
  `x:main` y `refs/heads/main`), un push forzado en cualquier forma (`--force`,
  `--force-with-lease`, `-f`, `+rama`), `--all`, `--mirror` y un push que no nombre su rama
  (`git push`, `git push origin`, `git push origin HEAD`), que desde `main` empujaría `main`
  sin que la regla lo vea. Valen en todos los proyectos después de `./install.sh`.
- `global/AGENTS.md`: nunca forzar un push, y empujar siempre con la rama nombrada.

### Changed

- `install.sh` une las listas `permissions.allow`, `ask` y `deny` de la máquina con las del
  repo en vez de dejar que las del repo las reemplacen. Una regla que se quite del repo hay
  que quitarla a mano de `~/.claude/settings.json`.

### Fixed

- `agents/claude/CLAUDE.md` y el README decían que los permisos de una sola máquina van en
  `~/.claude/settings.local.json`. Claude Code solo lee ese archivo en sesiones abiertas en el
  home, así que una regla ahí no llega a ningún otro proyecto. Ahora dicen dónde va cada una.

## [1.3.0] - 2026-10-15

### Added

- Playwright (plugin de Claude Code): el navegador corre oculto y con un perfil temporal por
  sesión, con `PLAYWRIGHT_MCP_HEADLESS` y `PLAYWRIGHT_MCP_ISOLATED` en `env` de
  `agents/claude/settings.json`. Varias sesiones abiertas ya no abren ventanas en el escritorio
  ni fallan con "Browser is already in use" por compartir perfil.
- README: cómo indicar el navegador instalado en una máquina sin Google Chrome
  (`env.PLAYWRIGHT_MCP_EXECUTABLE_PATH` en `~/.claude/settings.json`). Sin eso Playwright
  falla con "Chromium distribution 'chrome' is not found".
- `tests/install_test.sh`: el instalador conserva la ruta del navegador de la máquina dentro
  de `env` y aplica los valores del repo.

## [1.2.0] - 2026-10-07

### Added

- Mod `task-progress` (`agents/claude/mods/task-progress`): bloque a la derecha del pie de
  Claude Code, junto a la statusline, con el título de la tarea, una barra de 12 celdas, el
  porcentaje y el paso activo con el tiempo. El porcentaje sale de los pasos que Claude declara
  con la herramienta `mcp__task-progress__plan`; sin plan muestra las herramientas usadas y el
  tiempo del turno, y si el turno termina con pasos pendientes se pone en ámbar.
- `.claude-plugin/marketplace.json`: el repo es el marketplace `agent-config`, y
  `agents/claude/settings.json` lo declara y activa `task-progress@agent-config`, así que
  `install.sh` lo instala como los demás plugins.
- `tests/run.sh` valida el marketplace y valida y prueba cada mod con `claude plugin` cuando
  `claude` está en el PATH; `tests/check_inventory.sh` comprueba que cada plugin del
  marketplace exista en su ruta.

## [1.1.1] - 2026-10-07

### Fixed

- Statusline: todas las sesiones abiertas muestran los mismos límites. Cada sesión solo recibe
  la lectura de su última respuesta, así que varios chats mostraban valores distintos y uno
  inactivo se quedaba con un valor viejo. Ahora comparten la lectura más reciente en
  `$XDG_CACHE_HOME/agent-config/claude-rate-limits.json`, y una sesión inactiva la toma en el
  siguiente refresco (60 s).

## [1.1.0] - 2026-10-07

### Added

- Statusline de Claude Code: tercera fila con los límites de la suscripción (ventana de 5 horas
  y semanal) con barra, porcentaje que queda y tiempo hasta el reinicio; y el nivel de esfuerzo
  junto al modelo.
- `refreshInterval` de 60 s en `statusLine`, para que la cuenta regresiva avance con la sesión
  inactiva.
- `tests/statusline_test.sh`: tests de comportamiento de la statusline, incluidos en
  `tests/run.sh`.

### Changed

- Statusline: los niveles (verde, ámbar, rojo) usan colores de 24 bits en lugar de la paleta
  del terminal, que un tema puede remapear; con un tema monocromo se veían todos grises. La
  barra de contexto usa los mismos niveles y dibuja fracciones de celda.
- Statusline: corre con `set -euo pipefail` y termina con error si no recibe el JSON de la
  sesión.

## [1.0.0] - 2026-09-30

### Added

- `global/AGENTS.md`: instrucciones globales para todos los agentes (estándares de desarrollo
  + reglas de trabajo: flujo de git, tests con cada feature, mockups para UI, vault como
  fuente de verdad, mantenimiento de esta config).
- Soporte para Claude Code, Codex, Gemini CLI, OpenCode y Pi desde un único `AGENTS.md`.
- Skills `obsidian-vault` y `new-project` (estándar Agent Skills), con sus plantillas.
- `vault-write` determinista: respeta el orden cronológico del changelog, detecta el disco
  del vault por etiqueta y encola entradas cuando el vault no está disponible.
- `install.sh` idempotente con `--check`, respaldo de archivos reemplazados, merge de JSON y
  poda de symlinks retirados.
- `docs/inventory.md` con el estado de cada skill, comando, plugin y lo retirado.
- CI con shellcheck, ruff y tests.

### Removed

- Hook `rtk-rewrite.sh` y `RTK.md` (`rtk` no estaba instalado).
- MCP servers `headroom` y `codebase-memory-mcp` (no instalado / nunca conectó).
- `vault-write` basado en Gemma vía Ollama.
