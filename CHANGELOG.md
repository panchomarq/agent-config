# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) ·
Versionado: [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [1.13.0] - 2026-11-24

### Added

- Skill `security-audit`, copiada de `cloudflare/security-audit-skill` (MIT) en el commit
  `c1c8a8c`, sin cambios y con su `LICENSE`. Responde preguntas de seguridad y, con un
  pedido explícito de auditoría, corre seis fases con subagentes: reconocimiento, búsqueda
  guiada por un registro de cobertura, validación adversarial de cada candidato,
  `findings.json` validado contra un esquema, verificación independiente e informe. Solo
  lee código y no prueba nada desplegado.

## [1.12.1] - 2026-11-16

### Fixed

- `task-progress` 0.4.1: con Claude Code 2.1.326 el header de dos filas no aparecía nunca en
  las pestañas angostas. La franja arriba del prompt ahora tiene una fila por plugin y `next(e)`
  devuelve una referencia al dibujo del motor, no el árbol, así que el mod creía que otro la
  ocupaba. El header dibuja su propia fila, y cede la franja a la fila de otro mod (un comando
  retenido con Proceed y Cancel) desde un hook de `AbovePromptList`. La fila de un mod que
  pasa con `next(e)` llega como referencia al dibujo del motor y cuenta como vacía, así que no
  le quita el lugar al header. El test suma
  `isCollapsed`, que la API ahora exige, y `claude plugin validate` ya no avisa TS2741.

## [1.12.0] - 2026-11-16

### Added

- Grafo de código con [graphify](https://github.com/Graphify-Labs/graphify) 0.9.111.
  - `global/AGENTS.md`: si un repo tiene `graphify-out/graph.json`, las preguntas sobre su
    estructura empiezan por `graphify query`, `explain` o `path`, y la regla va en cada brief
    de subagente que explora código.
  - Después de cambiar código se corre `graphify update .`.
  - Todo repo con código tiene su grafo (`--code-only`): si falta, el agente lo arma antes de
    explorar. Un repo que solo tiene Markdown no lleva grafo.
- `agents/claude/settings.json`: hooks `graphify hook-guard`.
  - Los PreToolUse (`Bash|Grep`, `Read|Glob`) recuerdan el grafo antes de buscar o leer código
    y avisan si quedó viejo.
  - El SessionStart `compact` reinicia el cupo de avisos.
  - No dicen nada en un repo sin grafo ni en una máquina sin `graphify`, y nunca bloquean.
- `agents/claude/settings.json`: `GRAPHIFY_BACKEND=none`, para que graphify no mande archivos a
  ningún modelo ni gaste uso con `claude -p`.
- `global/gitignore` e `install.sh`: el instalador suma al ignore global de git las líneas que
  le faltan, empezando por `graphify-out/`. Usa `core.excludesFile` o, si no está definido,
  `~/.config/git/ignore`. Solo agrega líneas: nunca reescribe el archivo.
- `install.sh --check` avisa si falta `graphify`.

## [1.11.0] - 2026-10-23

### Changed

- `global/AGENTS.md`: un solo clon por proyecto, y los worktrees duran lo que dura su tarea.
  Ese clon y GitHub son la fuente de verdad del código; no se hacen segundos clones ni copias.
  Los agentes que cambian código en paralelo trabajan cada uno en un worktree que crea la
  propia herramienta del agente, nunca a mano en una carpeta `<proyecto>-wt/`. Al terminar la
  tarea (rama pusheada y PR abierto, o trabajo descartado), el worktree se borra con
  `git worktree remove`, que se lleva su `.next`, su `node_modules` y las demás cachés. Si git
  se niega por archivos sin guardar, se commitean o se pregunta; nunca `--force`. Reemplaza la
  regla que daba a cada subagente un worktree con `wt` que nadie borraba (29 copias, 27 GB
  según `du`).
- `global/AGENTS.md`: pnpm siempre, nunca npm, npx ni yarn. Cada worktree nuevo corre
  `pnpm install`, que comparte archivos con la caché de pnpm; un proyecto que sigue en npm pasa
  a pnpm en su propio PR (`pnpm import`).
- `agents/claude/CLAUDE.md`: Claude Code crea los worktrees con `isolation: "worktree"`,
  `claude --worktree` o `EnterWorktree` (en `.claude/worktrees/`, con `.worktreeinclude` para
  los `.env`), nunca con `ce-worktree`, `wt` ni `git worktree add` a mano. Claude Code solo
  borra por su cuenta los worktrees sin cambios: uno con commits espera días al barrido de
  `cleanupPeriodDays` y uno de `claude -p --worktree` nunca se borra. Por eso el agente lo borra
  apenas pushea su rama y revisa `git worktree list`. `cleanupPeriodDays` no se baja, porque
  también decide cuánto se guardan las transcripciones.
- `fix-issue` y `review-pr`: el ejemplo de build es `pnpm build`, no `npm run build`.
- `new-project`: el `.gitignore` inicial ignora `.claude/worktrees/`.
- `obsidian-vault`: al dejar una sesión, dónde retomar es la rama y el PR, sin worktree.

### Removed

- `wt` de las herramientas recomendadas (`global/AGENTS.md` e `install.sh --check`).

## [1.10.0] - 2026-10-15

### Changed

- `obsidian-vault`: el vault es también la memoria de largo plazo de los agentes, y el skill dice
  dónde va cada nota. Los proyectos viven en `1. Projects/<Contexto>/<Proyecto>/`, con
  `<Proyecto>.md` como nota principal y un índice `Proyectos <Contexto>.md` por contexto; los
  archivados van a `4. Archive/<Contexto>/<Proyecto>/`. Una tabla dice dónde va cada tipo de
  nota. El primer tag es el tipo de nota y el segundo el contexto; no hay tags de estado. Antes
  de trabajar en un proyecto se leen sus notas, cada decisión se anota con el motivo y lo
  descartado, y al cerrar una sesión queda dónde retomar. Las plantillas llevan el tag de
  contexto.
- `new-project` crea la nota del proyecto en su carpeta de contexto y la suma al índice.
- `global/AGENTS.md`: antes de trabajar en un proyecto se leen sus notas del vault; cada
  proyecto vive en su carpeta.
- `task-progress` 0.4.0: la columna encuentra la nota del proyecto en carpetas de contexto
  (`1. Projects/<Contexto>/<Proyecto>/`). Una carpeta que tiene una nota con su mismo nombre es
  un proyecto. La fila `| Repo |` de la nota principal ahora gana sobre el nombre.

### Fixed

- `task-progress`: con dos repos del mismo nombre en contextos distintos, la columna mostraba en
  los dos el roadmap del primero que coincidía por nombre.

## [1.9.1] - 2026-10-15

### Fixed

- `blast-radius` y `collision-guard` no se instalaban en una máquina sin clave SSH para GitHub:
  el marketplace los declaraba como `owner/repo` y Claude Code los clonaba por SSH. Ahora sus
  fuentes son URLs HTTPS, fijadas a los mismos commits.
- `install.sh` cortaba en el primer plugin que fallaba y dejaba sin instalar los siguientes.
  Ahora sigue con los demás y al final sale con código 1 nombrando los que fallaron.
- `install.sh` no actualizaba un plugin ya instalado, así que `task-progress` se quedaba en la
  versión de la primera instalación. Ahora actualiza los mods del marketplace `agent-config`
  que ya están instalados e informa el cambio de versión.

## [1.9.0] - 2026-10-15

### Changed

- `global/AGENTS.md`: los PR se mergean en el orden en que se abren, sin conflictos y sin
  avisar entre un merge y otro. Antes de abrir un PR se simula el merge de los PR abiertos en
  orden y después el nuevo; si choca con uno anterior que sigue abierto, la rama nueva parte
  de esa rama o la incluye y resuelve el conflicto. Cuando un PR anterior recibe commits, se
  mergea en las ramas siguientes. Todos siguen apuntando a `main`.

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

## [1.7.0] - 2026-10-15

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
