import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Agent, Plan, Project, Turn } from '../types'

import type { View } from './lines'

export const TOOL = 'mcp__task-progress__plan'

// The session's state, named only here: the other modules read and write it through the
// functions below, so every reference the engine checks is in this one module.
const plan = atom({ plugin: 'task-progress', key: 'plan' } as const, null)
const turn = atom({ plugin: 'task-progress', key: 'turn' } as const, null)
const agents = atom({ plugin: 'task-progress', key: 'agents' } as const, [])
const project = atom({ plugin: 'task-progress', key: 'project' } as const, null)
const isDismissed = atom({ plugin: 'task-progress', key: 'isDismissed' } as const, false)

type Change<T> = (current: T) => T

// Function declarations, not arrows: the engine follows `$` past an import only into those.
export function readPlan($: EngineInterface): Promise<Plan | null> {
  return read($, plan)
}

export function readTurn($: EngineInterface): Promise<Turn | null> {
  return read($, turn)
}

export function readAgents($: EngineInterface): Promise<Agent[]> {
  return read($, agents)
}

export function readDismissed($: EngineInterface): Promise<boolean> {
  return read($, isDismissed)
}

export function updatePlan($: EngineInterface, change: Change<Plan | null>) {
  return update($, plan, change)
}

export function updateTurn($: EngineInterface, change: Change<Turn | null>) {
  return update($, turn, change)
}

export function updateAgents($: EngineInterface, change: Change<Agent[]>) {
  return update($, agents, change)
}

export function setProject($: EngineInterface, loaded: Project) {
  return update($, project, () => loaded)
}

export function setDismissed($: EngineInterface, value: boolean) {
  return update($, isDismissed, () => value)
}

/** Everything the column and the header draw from, read at one instant. */
export async function viewOf($: EngineInterface): Promise<View> {
  return {
    plan: await read($, plan),
    turn: await read($, turn),
    agents: await read($, agents),
    project: await read($, project),
    now: await $.clock.now(),
  }
}

/** Registers a slash command; a name another command already holds is said in the log. */
export async function registerCommand(
  $: EngineInterface,
  spec: { name: string; description: string },
): Promise<void> {
  try {
    await $.command.register({ ...spec, immediate: true })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    $.ui.log(`task-progress: /${spec.name} is not available: ${reason}`)
  }
}
