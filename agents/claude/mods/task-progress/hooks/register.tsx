import type { On, Register } from 'claude-code'

import type { Plan } from '../types'

import { COLUMN_COMMAND, drawColumn } from './column'
import { formatElapsed, formatLeft, stepCount } from './format'
import {
  applyDraft,
  countDone,
  currentStep,
  estimateLeft,
  parsePlan,
  weightedPercent,
} from './plan'
import type { PlanDraft } from './plan'
import { readPlan, registerCommand, TOOL, updatePlan } from './state'
import { startTracking, trackSession } from './tracking'

const PLAN_TOOL = {
  name: 'plan',
  description:
    "Declares or updates the step plan behind the user's session column. " +
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
The user follows your work in a session column that only the ${TOOL} tool feeds with the \
task's steps, so keeping it current is part of the task.
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
Do not mention the tool or the column in your replies.`

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

function serveCommands(on: On): void {
  on('command.run', { command: 'progress' }, async $ => ({
    text: describePlan(await readPlan($), await $.clock.now()),
  }))

  on('command.run', { command: 'goal' }, async ($, e, next) => {
    const ran = await next(e)

    if (STOP_WORDS.has(e.args.trim().toLowerCase())) {
      return ran
    }

    return { ...ran, context: [...(ran.context ?? []), GOAL_NOTE] }
  })
}

function servePlanTool(on: On): void {
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
    await updatePlan($, previous => applyDraft(previous, draft, now))

    return { result: `Recorded: ${countDone(draft.steps)}/${draft.steps.length} steps done.` }
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
  on('session.start', async ($, e, next) => {
    await $.tool.register(PLAN_TOOL)
    await registerCommand($, {
      name: 'progress',
      description: 'Task progress: every step of the plan, its size and the time left',
    })
    await registerCommand($, COLUMN_COMMAND)
    await startTracking($, e.cwd)

    return next(e)
  })

  servePlanTool(on)
  serveCommands(on)
  trackSession(on)
  drawColumn(on)
  drawTranscriptRows(on)
}
