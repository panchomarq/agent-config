# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) ·
Versionado: [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [1.2.0] - 2026-10-07

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
