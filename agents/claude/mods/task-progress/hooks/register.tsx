import { atom, read, update } from 'claude-code'
import type { On, Register, Timer } from 'claude-code'

import type { Plan, Turn } from '../types'

import { describeFooter, formatElapsed, formatLeft, stepCount } from './footer'
import { applyDraft, countDone, currentStep, estimateLeft, parsePlan, weightedPercent } from './plan'
import type { PlanDraft } from './plan'

const TOOL = 'mcp__task-progress__plan'
const TICK_MS = 1000

const plan = atom({ plugin: 'task-progress', key: 'plan' } as const, null)
const turn = atom({ plugin: 'task-progress', key: 'turn' } as const, null)

const PLAN_TOOL = {
  name: 'plan',
  description:
    "Declares or updates the step plan behind the user's progress indicator. " +
    'Always send the full ordered list of steps.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Name of the task, at most 40 characters.' },
      steps: {
        type: 'array',
        description: 'Every step of the plan, in order. An empty list clears the plan.',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'What the step does, in 2 to 5 words.' },
            status: { type: 'string', enum: ['pending', 'active', 'done'] },
            size: {
              type: 'string',
              enum: ['S', 'M', 'L'],
              description: 'How much work the step is: S small, M medium, L large. Defaults to M.',
            },
          },
          required: ['label', 'status'],
        },
      },
    },
    required: ['title', 'steps'],
  },
  isDeferred: false,
}

const INSTRUCTIONS = `# Task progress
The user follows your work on a progress indicator that only the ${TOOL} tool feeds, so \
keeping it current is part of the task.
- When a request takes three or more steps, call it first, before any other tool: a short title \
and every step in order (2 to 5 words each, in the user's language), the first one "active". \
Size each step S, M or L by how much work it is: the percent and the time left weigh them 1, 2 \
and 3. This holds when the user already listed the steps too.
- Each time a step ends, call it again with the full list: finished steps "done", the one you \
are starting "active". Send it in the same message as that step's first tool call, never as a \
message of its own.
- Mark the last step "done" only once the work is verified. If the plan changes, send the new \
list.
- Skip it for questions and one-step tasks. If the plan on record no longer matches the \
request, send an empty steps list to clear it.
Do not mention the tool or the indicator in your replies.`

// Sent once per turn, with the result of the tool call that shows the work has several steps.
const NUDGE_AFTER_TOOLS = 3
const NUDGE =
  `No step plan is on record for this task. If it takes three or more steps, declare them ` +
  `now with ${TOOL}, the finished ones as "done"; otherwise carry on.`

// Sent with /goal, whose loop can run for a long time without the person watching each turn.
const GOAL_NOTE =
  `A /goal just started. Before any other tool, declare its plan with ${TOOL}: the goal as the ` +
  `title, every step sized S, M or L. Keep it current until the goal is met.`
const STOP_WORDS = new Set(['', 'clear', 'stop', 'off', 'cancel'])

const STEP_ICONS = { done: '✔', active: '◆', pending: '○' } as const

/** The whole plan as the /progress command prints it. */
function describePlan(current: Plan | null, now: number): string {
  if (current === null) {
    return 'Sin plan de pasos en curso.'
  }

  const left = estimateLeft(current, now)
  const took = formatElapsed((current.finishedAt ?? now) - current.startedAt)
  const timing = left === null ? took : `${took} · quedan ~${formatLeft(left)}`
  const grew =
    current.steps.length > current.firstTotal
      ? [`El plan creció de ${current.firstTotal} a ${current.steps.length} pasos.`]
      : []
  const steps = current.steps.map(step => `${STEP_ICONS[step.status]} ${step.size}  ${step.label}`)

  return [
    `${current.title} · ${stepCount(current)} · ${weightedPercent(current.steps)}% · ${timing}`,
    ...grew,
    ...steps,
  ].join('\n')
}

const dropFinished = (current: Plan | null): Plan | null =>
  current !== null && current.finishedAt !== null ? null : current

const countTool = (running: Turn | null): Turn | null =>
  running === null ? null : { ...running, tools: running.tools + 1 }

function describeCall(draft: PlanDraft): string {
  if (draft.steps.length === 0) {
    return '◇ plan retirado'
  }

  const count = `${countDone(draft.steps)}/${draft.steps.length}`
  const step = currentStep(draft.steps)

  return step === undefined
    ? `✔ ${draft.title} · ${count}`
    : `◆ ${draft.title} · ${count} · ${step.label}`
}

function servePlanTool(on: On): void {
  on('session.start', async ($, e, next) => {
    await $.tool.register(PLAN_TOOL)
    // A turn cut short by a crash or a reload never reported its end.
    await update($, turn, () => null)

    try {
      await $.command.register({
        name: 'progress',
        description: 'Task progress: every step of the plan, its size and the time left',
        immediate: true,
      })
    } catch {
      // Another command took the name; the footer still shows the plan.
    }

    return next(e)
  })

  on('command.run', { command: 'progress' }, async $ => ({
    text: describePlan(await read($, plan), await $.clock.now()),
  }))

  on('command.run', { command: 'goal' }, async ($, e, next) => {
    const ran = await next(e)

    if (STOP_WORDS.has(e.args.trim().toLowerCase())) {
      return ran
    }

    return { ...ran, context: [...(ran.context ?? []), GOAL_NOTE] }
  })

  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)

    if (!e.tools.includes(TOOL)) {
      return composed
    }

    const section = {
      id: 'task-progress:instructions',
      text: INSTRUCTIONS,
      scope: 'session',
    } as const

    return { sections: [...composed.sections, section] }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    if (e.agentId !== undefined) {
      return { result: 'Ignored: only the main conversation reports the plan.' }
    }

    const parsed = parsePlan(e.title, e.steps)

    if (parsed.draft === undefined) {
      return { deny: `${$.plugin.name}: ${parsed.error}` }
    }

    const { draft } = parsed
    const now = await $.clock.now()
    await update($, plan, previous => applyDraft(previous, draft, now))

    return { result: `Recorded: ${countDone(draft.steps)}/${draft.steps.length} steps done.` }
  })
}

function trackTurns(on: On): void {
  let ticker: Timer | undefined

  on('turn.start', async ($, e, next) => {
    const startedAt = await $.clock.now()
    await update($, turn, () => ({ startedAt, tools: 0 }))
    ticker?.cancel()
    ticker = $.clock.every(TICK_MS, () => $.ui.invalidate('ui.render'))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      ticker?.cancel()
      ticker = undefined
      await update($, turn, () => null)
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined || e.tool === TOOL) {
      return next(e)
    }

    const running = await update($, turn, countTool)
    const ran = await next(e)
    const isPlanless = running?.tools === NUDGE_AFTER_TOOLS && (await read($, plan)) === null

    if (!isPlanless || ran.deny !== undefined || ran.isError === true) {
      return ran
    }

    return { ...ran, context: [...(ran.context ?? []), NUDGE] }
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, plan, dropFinished)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, plan, () => null)
    }

    return next(e)
  })
}

function drawFooter(on: On): void {
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const footer = describeFooter(
      await read($, plan),
      await read($, turn),
      await $.clock.now(),
      e.viewport?.columns,
    )

    if (footer === null) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" alignItems="flex-end" paddingRight={1}>
        <Box>
          <Text bold={!footer.isMuted} dimColor={footer.isMuted}>
            {footer.title}
          </Text>
          <Text color={footer.color}>{` ${footer.glyph}`}</Text>
        </Box>
        <Box>
          <Text color={footer.color}>{footer.filled}</Text>
          <Text color={footer.color} dimColor>
            {footer.empty}
          </Text>
          <Text color={footer.color}>{` ${footer.percent}`}</Text>
        </Box>
        {footer.isDetailColored ? (
          <Text color={footer.color}>{footer.detail}</Text>
        ) : (
          <Text dimColor>{footer.detail}</Text>
        )}
        {e.props.modes.length > 0 && <Text dimColor>{e.props.modes.join(' & ')}</Text>}
      </Box>
    )
  })
}

// One call per step would otherwise put the whole step list in the transcript each time.
function drawTranscriptRows(on: On): void {
  on('ui.render', { component: 'ToolUse', props: { tool: TOOL } }, ($, e, next) => {
    const { title, steps } = (e.props.input ?? {}) as { title?: unknown; steps?: unknown }
    const parsed = parsePlan(title, steps)

    if (parsed.draft === undefined || e.props.isErrored) {
      return next(e)
    }

    const { Text } = $.ui.resolve(e)

    return <Text dimColor>{describeCall(parsed.draft)}</Text>
  })

  on('ui.render', { component: 'ToolResult', props: { tool: TOOL } }, ($, e, next) => {
    if (e.props.isErrored) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })
}

export const register: Register = on => {
  servePlanTool(on)
  trackTurns(on)
  drawFooter(on)
  drawTranscriptRows(on)
}
