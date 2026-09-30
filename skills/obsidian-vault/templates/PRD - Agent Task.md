---
tags: [prd, agent-task]
task-id: {task-id}
project: {proyecto}
tier: 2
status: draft
agent: {agente}
date: {{date}}
---

# {task-id}: {título}

## Proyecto

{nombre del proyecto} — `{ruta del repo}`

## Contexto

{Qué existe hoy en el área que se va a tocar. Estado actual del código relevante. 3-5 líneas máximo. Incluir archivos clave que el agente necesita entender.}

## Objetivo

{Qué tiene que cambiar. Resultado esperado, no pasos. Una oración.}

## Archivos a tocar

- `{ruta/archivo1.ext}` — {qué cambiar}
- `{ruta/archivo2.ext}` — {qué cambiar}
- `{ruta/archivo-nuevo.ext}` — crear (si aplica)

## Patrón de referencia

{Componente, archivo, o implementación existente que el agente debe usar como modelo. Ser específico: "seguir la estructura de `components/StatusBadge.tsx` para props, estilos, y exports".}

Si no hay patrón existente, escribir: "No hay patrón — seguir instrucciones explícitas abajo."

## Restricciones

- NO modificar: {archivos/módulos fuera de scope}
- NO agregar dependencias nuevas (a menos que se especifique)
- {Cualquier otra restricción específica}

## Implementación

{Pasos concretos y ordenados. Cada paso debe ser verificable. No dejar espacio a interpretación.}

1. {paso 1}
2. {paso 2}
3. {paso 3}

## Criterio de aceptación

- [ ] {condición verificable 1 — algo que se puede chequear con un comando o revisando el código}
- [ ] {condición verificable 2}
- [ ] CI pasa (tsc + build)
- [ ] No hay regresiones en funcionalidad existente

## Branch

`{agente}/{task-id}`

## Notas para el agente

{Cualquier contexto adicional que evite errores comunes. Ej: "El Sidebar es frágil — no reescribir el archivo completo, solo agregar el import y el componente en la sección indicada."}
