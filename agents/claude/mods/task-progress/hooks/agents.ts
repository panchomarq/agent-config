import type { Agent } from '../types'

// After the last agent ends, the column keeps showing them this long before going back to the
// project board, so a finished fleet can be read.
export const LINGER_MS = 10_000

const ACTION_ARGS = ['file_path', 'command', 'pattern', 'path', 'url', 'query', 'description']
const ACTION_ARG_LENGTH = 60

export const isRunning = (agent: Agent): boolean => agent.finishedAt === null

/** The list once `agent` started; a respawn under the same id replaces the old row. */
export const startAgent = (list: readonly Agent[], agent: Agent): Agent[] => [
  ...list.filter(other => other.id !== agent.id),
  agent,
]

/** One more tool call by agent `id`; a teammate that wakes for it runs again. */
export const recordTool = (list: readonly Agent[], id: string, action: string): Agent[] =>
  list.map(agent =>
    agent.id === id
      ? { ...agent, tools: agent.tools + 1, lastAction: action, finishedAt: null }
      : agent,
  )

export const finishAgent = (list: readonly Agent[], id: string, now: number): Agent[] =>
  list.map(agent => (agent.id === id && isRunning(agent) ? { ...agent, finishedAt: now } : agent))

/** Agents stay listed while any runs; once all are done the next prompt clears them. */
export const dropFinished = (list: readonly Agent[]): Agent[] =>
  list.some(isRunning) ? [...list] : []

/** True while an agent runs, and for LINGER_MS after the last one ended. */
export function showsAgents(list: readonly Agent[], now: number): boolean {
  if (list.some(isRunning)) {
    return true
  }

  const lastEnd = Math.max(0, ...list.map(agent => agent.finishedAt ?? 0))

  return list.length > 0 && now - lastEnd < LINGER_MS
}

/** Running agents first in the order they started, then the finished ones, latest first. */
export function ordered(list: readonly Agent[]): Agent[] {
  const running = list.filter(isRunning).sort((a, b) => a.startedAt - b.startedAt)
  const finished = list
    .filter(agent => !isRunning(agent))
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))

  return [...running, ...finished]
}

const lastPart = (path: string): string => path.split('/').filter(Boolean).pop() ?? path

/** A tool call as one short line: the tool's name and the argument that says what it touched. */
export function describeAction(tool: string, input: Readonly<Record<string, unknown>>): string {
  const name = ACTION_ARGS.find(key => typeof input[key] === 'string' && input[key] !== '')

  if (name === undefined) {
    return tool
  }

  const value = String(input[name]).split('\n')[0] ?? ''
  const shown = name === 'file_path' || name === 'path' ? lastPart(value) : value

  return `${tool} ${shown.slice(0, ACTION_ARG_LENGTH)}`
}
