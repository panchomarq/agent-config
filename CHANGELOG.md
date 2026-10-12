# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) ·
Versionado: [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [1.3.0] - 2026-10-12

### Added

- Skills de Google Cloud, copiadas de la colección oficial `google/skills` (Apache-2.0) en el
  commit `a39a861`: `gcloud` (resguardos para comandos `gcloud`), `google-cloud-recipe-auth`
  (autenticación e IAM), `google-cloud-recipe-onboarding` (primer proyecto y facturación),
  `cloud-run-basics` y `bigquery-basics`.
- Skill `google-tag-manager`, copiada de `thatrebeccarae/claude-marketing` (MIT) en el commit
  `a8a63ec`: auditoría de contenedores, arquitectura de tags y triggers, Consent Mode v2,
  server-side y depuración. Solo asesora: no usa la API de Tag Manager. Se le quitaron las
  secciones `Install` y `Related Tools`, que apuntaban a una skill y a un agente que este repo
  no trae.
- `docs/inventory.md`: tabla «Skills de terceros» con el origen, el commit, la licencia y los
  cambios locales de cada copia, y la lista de lo evaluado y no incluido con su motivo.
- `tests/check_skills.sh`, incluido en `tests/run.sh`: cada carpeta de `skills/` tiene un
  `SKILL.md` con un `name` igual al de la carpeta y una `description`.

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
