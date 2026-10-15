import type { EngineInterface, On, Timer } from 'claude-code'

import type { Agent, Plan, Turn } from '../types'

import {
  describeAction,
  dropFinished,
  finishAgent,
  recordTool,
  showsAgents,
  startAgent,
} from './agents'
import { loadProject } from './project'
import {
  readAgents,
  readPlan,
  readTurn,
  setProject,
  TOOL,
  updateAgents,
  updatePlan,
  updateTurn,
} from './state'

const TICK_MS = 1000

// Sent once per turn, with the result of the tool call that shows the work has several steps.
const NUDGE_AFTER_TOOLS = 3
const NUDGE =
  `No step plan is on record for this task. If it takes three or more steps, declare them ` +
  `now with ${TOOL}, the finished ones as "done"; otherwise carry on.`

const dropFinishedPlan = (current: Plan | null): Plan | null =>
  current !== null && current.finishedAt !== null ? null : current

const countTool = (running: Turn | null): Turn | null =>
  running === null ? null : { ...running, tools: running.tools + 1 }

// The module's own: a reload drops both and the session.start it raises sets them again.
let ticker: Timer | undefined
let cwd = ''

/**
 * Times, tool counts and agent states move on their own: redraw every second while the main
 * turn or an agent runs, and stop once neither does and the agents' linger is over.
 */
function keepTicking($: EngineInterface): void {
  if (ticker !== undefined) {
    return
  }

  ticker = $.clock.every(TICK_MS, async () => {
    $.ui.invalidate('ui.render')
    const isIdle = (await readTurn($)) === null
    const now = await $.clock.now()

    if (isIdle && !showsAgents(await readAgents($), now)) {
      ticker?.cancel()
      ticker = undefined
    }
  })
}

/** Reads the project's roadmap and merges once the dispatch that asked for it has ended. */
function refreshProject($: EngineInterface): void {
  $.clock.after(0, async () => {
    const loaded = await loadProject($, cwd)
    await setProject($, loaded)
  })
}

/** What the session's start resets and reads: called from the module's one session.start hook. */
export async function startTracking($: EngineInterface, sessionCwd: string): Promise<void> {
  cwd = sessionCwd
  ticker?.cancel()
  ticker = undefined
  // A turn cut short by a crash or a reload never reported its end.
  await updateTurn($, () => null)
  refreshProject($)
}

function trackAgents(on: On): void {
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)

    if (started.agentId === undefined) {
      return started
    }

    const agent: Agent = {
      id: started.agentId,
      label: e.description.trim() === '' ? e.subagentType : e.description.trim(),
      type: e.subagentType,
      startedAt: await $.clock.now(),
      finishedAt: null,
      tools: 0,
      lastAction: '',
    }
    await updateAgents($, list => startAgent(list, agent))
    keepTicking($)

    return started
  }).catch(($, e, next) => next(e))
}

export function trackSession(on: On): void {
  trackAgents(on)

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const startedAt = await $.clock.now()
      await updateTurn($, () => ({ startedAt, tools: 0 }))
      keepTicking($)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const { agentId } = e

    if (agentId === undefined) {
      await updateTurn($, () => null)
      refreshProject($)
    } else {
      const now = await $.clock.now()
      await updateAgents($, list => finishAgent(list, agentId, now))
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const { agentId } = e

    if (e.tool === TOOL) {
      return next(e)
    }

    if (agentId !== undefined) {
      const action = describeAction(e.tool, e as unknown as Readonly<Record<string, unknown>>)
      await updateAgents($, list => recordTool(list, agentId, action))

      return next(e)
    }

    const running = await updateTurn($, countTool)
    const ran = await next(e)
    const isPlanless = running?.tools === NUDGE_AFTER_TOOLS && (await readPlan($)) === null

    if (!isPlanless || ran.deny !== undefined || ran.isError === true) {
      return ran
    }

    return { ...ran, context: [...(ran.context ?? []), NUDGE] }
  })

  on('prompt.submit', async ($, e, next) => {
    await updatePlan($, dropFinishedPlan)
    await updateAgents($, dropFinished)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await updatePlan($, () => null)
      await updateAgents($, () => [])
    }

    return next(e)
  })
}
