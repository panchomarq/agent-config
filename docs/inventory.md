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
| `gcloud` | activo | Resguardos para comandos `gcloud`: `gcloud help` del comando exacto antes de proponerlo, `--dry-run` cuando existe, y autorización explícita para IAM, borrados, facturación y habilitar APIs |
| `google-cloud-recipe-auth` | activo | Autenticación e IAM en Google Cloud: ADC, impersonación de cuentas de servicio en lugar de claves, IAP, Workload Identity Federation |
| `google-cloud-recipe-onboarding` | activo | Primer proyecto de Google Cloud: verificar `gcloud`, autenticar, elegir o crear el proyecto y vincular la facturación, con confirmación antes de crear |
| `cloud-run-basics` | activo | Cloud Run: servicios, jobs y worker pools; despliegue desde imagen o desde código, IAM, redes y Terraform |
| `bigquery-basics` | activo | BigQuery: datasets, tablas y consultas con `bq`, librerías cliente, IAM y Terraform |
| `google-tag-manager` | activo | Google Tag Manager, solo asesora (no usa la API): auditoría de contenedores, arquitectura de tags, triggers y variables, Consent Mode v2, server-side y depuración |

Skills externas que **no** gestiona este repo: `omarchy` (la instala Omarchy en
`~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills` y `~/.pi/agent/skills`).

### Skills de terceros

Las de Google Cloud y `google-tag-manager` son copias de repositorios ajenos, fijadas a un
commit. Se copian, en lugar de instalarse como plugin o descargarse al instalar, para que
lleguen a todos los agentes y para que lo instalado sea lo que se revisó: no cambia hasta que
alguien actualiza la copia. Para actualizar una, volver a copiar su carpeta desde el commit
nuevo, leer el diff y cambiar el commit en esta tabla.

| Skill | Origen | Commit | Licencia | Cambios locales |
|---|---|---|---|---|
| `gcloud` | [`google/skills`](https://github.com/google/skills), `skills/cloud/gcloud` | `a39a861` (2026-10-12) | Apache-2.0 | Ninguno |
| `google-cloud-recipe-auth` | `google/skills`, `skills/cloud/google-cloud-recipe-auth` | `a39a861` (2026-10-12) | Apache-2.0 | Ninguno |
| `google-cloud-recipe-onboarding` | `google/skills`, `skills/cloud/google-cloud-recipe-onboarding` | `a39a861` (2026-10-12) | Apache-2.0 | Ninguno |
| `cloud-run-basics` | `google/skills`, `skills/cloud/cloud-run-basics` | `a39a861` (2026-10-12) | Apache-2.0 | Ninguno |
| `bigquery-basics` | `google/skills`, `skills/cloud/bigquery-basics` | `a39a861` (2026-10-12) | Apache-2.0 | Ninguno |
| `google-tag-manager` | [`thatrebeccarae/claude-marketing`](https://github.com/thatrebeccarae/claude-marketing), `skills/google-tag-manager` | `a8a63ec` (2026-05-14) | MIT | `SKILL.md` sin las secciones `Install` y `Related Tools`: apuntaban a una skill y a un agente que este repo no trae |

La licencia de `google/skills` está en `docs/third-party-licenses/google-skills-LICENSE.txt`;
la de `google-tag-manager`, en su carpeta.

Dos cosas que hacen las skills de Google y conviene saber:

- `cloud-run-basics` usa `--allow-unauthenticated` (servicio público) en su ejemplo de
  despliegue, y habilita APIs y asigna un rol de IAM con `--quiet`. La skill `gcloud` pide
  autorización explícita para los cambios de IAM y para habilitar APIs.
- `bigquery-basics` pide anteponer `CLOUDSDK_METRICS_REQUEST_ATTRIBUTION` a cada comando
  `gcloud`, para que Google atribuya el uso a la skill (nombre y versión, sin datos del
  usuario). La misma skill indica omitirlo si el usuario lo pide.

Evaluado el 2026-10-12 y no incluido:

| Qué | Motivo |
|---|---|
| Skill `finding-google-skills` (`google/skills`) | Se activa en cualquier decisión de stack, aunque no se nombre a Google, y hace que el agente descargue instrucciones y las siga |
| Skill `retrieving-developer-knowledge` (`google/skills`) | Sin el MCP Developer Knowledge, `gcloud` autenticado o una API key solo puede responder que le falta una credencial |
| Plugin `google-cloud-developer@google-plugins` | Solo llega a Claude Code, y trae las dos skills anteriores y un MCP que exige `DEVELOPERKNOWLEDGE_API_KEY` |
| Skills de `firebase/agent-skills` | No hay uso de Firebase |
| MCP de Tag Manager con escritura (`stape-io/google-tag-manager-mcp-server`, `paolobietolini/gtm-mcp-server`) y la skill de Stape | Pueden publicar un contenedor a producción y lo único que lo frena es una instrucción al modelo; la skill de Stape solo sirve con su MCP |

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
| `task-progress@agent-config` | activo | 2026-10-07 | Mod propio (`agents/claude/mods/task-progress`): progreso de la tarea junto a la statusline |
| `github@claude-plugins-official` | desactivado | 2026-08-05 | Sin uso en 130 arranques; `gh` cubre lo mismo |
| `skill-creator@claude-plugins-official` | desactivado | 2026-08-05 | Sin uso |
| `context7@claude-plugins-official` | desactivado | 2026-08-05 | Sin uso |
| `frontend-design@claude-plugins-official` | desactivado | 2026-08-05 | Un solo uso |
| `chrome-devtools-mcp@claude-plugins-official` | desactivado | 2026-08-05 | Se superpone con `playwright` |

## Retirados

| Qué | Fecha | Motivo |
|---|---|---|
| Plugin `claude-mem@thedotmack` | 2026-07-25 | Dejaba cientos de procesos huérfanos (`chroma-mcp`, workers de `bun`) |
| Hook `rtk-rewrite.sh` + `RTK.md` | 2026-09-30 | `rtk` no estaba instalado: el hook no hacía nada y la doc describía una herramienta inexistente |
| MCP `headroom` | 2026-09-30 | El binario no estaba instalado |
| MCP `codebase-memory-mcp` | 2026-09-30 | Nunca llegó a conectar; estaba declarado en `settings.json`, que no es donde Claude Code registra MCP servers |
| `vault-write` con Gemma/Ollama | 2026-09-30 | Reemplazado por la versión determinista: la anterior apuntaba a un punto de montaje viejo y escribía el changelog en orden inverso |
