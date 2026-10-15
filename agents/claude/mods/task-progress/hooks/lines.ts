import type { Agent, Plan, Project, Turn } from '../types'

import { isRunning, ordered, showsAgents } from './agents'
import { formatElapsed, formatLeft, gauge, stepCount } from './format'
import { currentStep, estimateLeft, weightedPercent } from './plan'

// 24-bit colours, as the status line's levels are: a terminal theme can remap the 16-colour
// palette, which would make the states look alike.
const WORKING = '#60a5fa'
const WAITING = '#facc15'
const DONE = '#4ade80'

/** A run of text drawn in one style. */
export type Seg = { text: string; color?: string; dim?: boolean; bold?: boolean }

/** One row: `left` from the start, `right` against the end. */
export type Line = { left: Seg[]; right?: Seg[] }

/** Everything a drawing reads, at one instant. */
export type View = {
  plan: Plan | null
  turn: Turn | null
  agents: Agent[]
  project: Project | null
  now: number
}

type PlanState = { glyph: string; color: string; time: string; step: string | null }

const BLANK: Line = { left: [] }
const heading = (text: string, right?: Seg[]): Line => ({
  left: [{ text, bold: true, dim: true }],
  ...(right === undefined ? {} : { right }),
})
const dim = (text: string): Seg => ({ text, dim: true })
const tools = (count: number): string => `${count} ${count === 1 ? 'herramienta' : 'herramientas'}`

function planState(plan: Plan, turn: Turn | null, now: number): PlanState {
  if (plan.finishedAt !== null) {
    const took = formatElapsed(plan.finishedAt - plan.startedAt)

    return { glyph: '✔', color: DONE, time: `listo en ${took}`, step: null }
  }

  if (turn === null) {
    return { glyph: '▲', color: WAITING, time: 'te necesita · en pausa', step: null }
  }

  const elapsed = formatElapsed(now - plan.startedAt)
  const left = estimateLeft(plan, now)
  const time = left === null ? elapsed : `${elapsed} · ~${formatLeft(left)}`

  return { glyph: '◆', color: WORKING, time, step: currentStep(plan.steps)?.label ?? null }
}

function gaugeSegs(percent: number, color: string): Seg[] {
  const { filled, empty } = gauge(percent)

  return [
    { text: filled, color },
    { text: empty, color, dim: true },
  ]
}

function nowLines({ plan, turn, now }: View): Line[] {
  if (plan === null) {
    if (turn === null) {
      return []
    }

    return [
      heading('AHORA'),
      { left: [dim('◇ sin plan de pasos')] },
      { left: [dim(`  ${tools(turn.tools)} · ${formatElapsed(now - turn.startedAt)}`)] },
    ]
  }

  const state = planState(plan, turn, now)
  const percent = weightedPercent(plan.steps)
  const detail = state.step === null ? state.time : `${state.step} · ${state.time}`
  const isWaiting = state.color === WAITING

  return [
    heading('AHORA'),
    {
      left: [{ text: `${state.glyph} `, color: state.color }, { text: plan.title, bold: true }],
      right: [{ text: stepCount(plan), color: state.color }],
    },
    {
      left: [
        { text: '  ' },
        ...gaugeSegs(percent, state.color),
        { text: ` ${percent}%`, color: state.color },
      ],
    },
    { left: [isWaiting ? { text: `  ${detail}`, color: WAITING } : dim(`  ${detail}`)] },
  ]
}

function roadmapLines(project: Project | null): Line[] {
  if (project === null) {
    return []
  }

  if (project.problem !== null || project.note === null) {
    return [heading('SIGUE'), { left: [dim(project.problem ?? 'sin nota en el vault')] }]
  }

  if (project.total === 0) {
    return [heading('SIGUE'), { left: [dim('la nota no tiene casillas')] }]
  }

  const count = [dim(`${project.done}/${project.total} hechas`)]

  if (project.next.length === 0) {
    return [heading('SIGUE', count), { left: [{ text: '✔ ', color: DONE }, dim('roadmap al día')] }]
  }

  return [heading('SIGUE', count), ...project.next.map(item => ({ left: [dim(`○ ${item}`)] }))]
}

function recentLines(project: Project | null): Line[] {
  if (project === null || project.recent.length === 0) {
    return []
  }

  const rows = project.recent.map(change => ({
    left: [{ text: '✔ ', color: DONE }, dim(change)],
  }))

  return [heading('LO ÚLTIMO'), ...rows]
}

/** Sections with a blank row between them, empty ones left out. */
const joined = (sections: readonly Line[][]): Line[] =>
  sections
    .filter(lines => lines.length > 0)
    .flatMap((lines, index) => (index === 0 ? lines : [BLANK, ...lines]))

function boardLines(view: View): Line[] {
  const { project } = view
  const header: Line[] =
    project === null
      ? []
      : [
          {
            left: [{ text: project.name, bold: true }],
            ...(project.note === null ? {} : { right: [dim(project.note)] }),
          },
        ]

  return joined([header, nowLines(view), roadmapLines(project), recentLines(project)])
}

function agentRows(agent: Agent, now: number): Line[] {
  if (isRunning(agent)) {
    const rows: Line[] = [
      {
        left: [{ text: '◆ ', color: WORKING }, { text: agent.label, bold: true }],
        right: [dim(formatElapsed(now - agent.startedAt))],
      },
      { left: [dim(`  ${agent.type} · ${tools(agent.tools)}`)] },
    ]

    return agent.lastAction === '' ? rows : [...rows, { left: [dim(`  ⎿ ${agent.lastAction}`)] }]
  }

  const took = formatElapsed((agent.finishedAt ?? now) - agent.startedAt)

  return [
    { left: [{ text: '✔ ', color: DONE }, dim(agent.label)], right: [dim(took)] },
    { left: [dim(`  listo · ${tools(agent.tools)}`)] },
  ]
}

function agentsLines(view: View): Line[] {
  const { agents, plan, turn, now } = view
  const finished = agents.filter(agent => !isRunning(agent)).length
  const percent = Math.round((finished * 100) / agents.length)
  const header = [
    heading('AGENTES', [dim(`${finished} de ${agents.length} listos`)]),
    { left: gaugeSegs(percent, WORKING) },
  ]
  const rows = ordered(agents).map(agent => agentRows(agent, now))

  if (plan === null) {
    return joined([header, ...rows])
  }

  const state = planState(plan, turn, now)
  const task: Line = {
    left: [{ text: `${state.glyph} `, color: state.color }, dim(plan.title)],
    right: [dim(stepCount(plan))],
  }

  return joined([header, ...rows, [task]])
}

/** The column: the agents while any runs (and a moment after), else the project board. */
export const columnLines = (view: View): Line[] =>
  showsAgents(view.agents, view.now) ? agentsLines(view) : boardLines(view)

function taskRow({ plan, turn, now }: View): Line | null {
  if (plan !== null) {
    const state = planState(plan, turn, now)

    return {
      left: [
        { text: `${state.glyph} `, color: state.color },
        { text: `${plan.title} `, bold: true },
        ...gaugeSegs(weightedPercent(plan.steps), state.color),
        { text: ` ${stepCount(plan)}`, color: state.color },
      ],
      right: [state.color === WAITING ? { text: state.time, color: WAITING } : dim(state.time)],
    }
  }

  if (turn === null) {
    return null
  }

  return {
    left: [dim(`◇ trabajando · ${tools(turn.tools)}`)],
    right: [dim(formatElapsed(now - turn.startedAt))],
  }
}

function agentsRow(agents: readonly Agent[]): Line {
  const finished = agents.filter(agent => !isRunning(agent)).length
  const names = ordered(agents).flatMap(agent =>
    isRunning(agent)
      ? [{ text: ' ◆ ', color: WORKING }, { text: agent.label }]
      : [{ text: ' ✔ ', color: DONE }, dim(agent.label)],
  )

  return {
    left: [dim('agentes'), ...names],
    right: [dim(`${finished} de ${agents.length} listos`)],
  }
}

function projectRow(project: Project): Line | null {
  if (project.problem !== null) {
    return { left: [dim(`${project.name} · ${project.problem}`)] }
  }

  const count = project.total > 0 ? { right: [dim(`${project.done}/${project.total}`)] } : {}

  if (project.next.length > 0) {
    return { left: [dim(`sigue ○ ${project.next.slice(0, 2).join(' · ○ ')}`)], ...count }
  }

  const latest = project.recent[0]

  return latest === undefined ? null : { left: [dim(`último ✔ ${latest}`)], ...count }
}

/** The header of a tab too narrow for the column: at most `maxRows` rows, often two. */
export function bandLines(view: View, maxRows: number): Line[] {
  const second = showsAgents(view.agents, view.now)
    ? agentsRow(view.agents)
    : view.project === null
      ? null
      : projectRow(view.project)
  const rows = [taskRow(view), second].filter((row): row is Line => row !== null)

  return rows.slice(0, Math.max(0, maxRows))
}

const length = (segs: readonly Seg[]): number =>
  segs.reduce((total, seg) => total + seg.text.length, 0)

/** The line cut to `width` cells: the right part kept whole, the left part cut with an ellipsis. */
export function fitLine(line: Line, width: number): Line {
  const right = line.right ?? []
  const room = Math.max(0, width - (right.length === 0 ? 0 : length(right) + 1))

  if (length(line.left) <= room) {
    return line
  }

  const left: Seg[] = []
  const budget = Math.max(0, room - 1)
  let used = 0

  for (const seg of line.left) {
    const rest = budget - used

    if (seg.text.length > rest) {
      left.push({ ...seg, text: `${seg.text.slice(0, rest)}…` })
      break
    }

    left.push(seg)
    used += seg.text.length
  }

  return { ...line, left }
}
