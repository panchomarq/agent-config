import type { Plan, Turn } from '../types'

import { countDone, currentStep, estimateLeft, weightedPercent } from './plan'

const GAUGE_CELLS = 12
const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const
const MIN_WIDTH = GAUGE_CELLS + ' 100%'.length
const MAX_WIDTH = 40

// The widest row of the status line this block sits beside, plus a gap. A narrow terminal
// shrinks this block to what is left, so the engine never has to cut the status line for it.
const RESERVED_COLUMNS = 64

// 24-bit colours, as the status line's levels are: a terminal theme can remap the 16-colour
// palette, which would make the three states look alike.
const WORKING = '#60a5fa'
const WAITING = '#facc15'
const DONE = '#4ade80'
const NO_PLAN = 'inactive'

export type Footer = {
  title: string
  glyph: string
  color: string
  isMuted: boolean
  filled: string
  empty: string
  percent: string
  detail: string
  isDetailColored: boolean
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${total % 60}s`
  }

  return `${total}s`
}

/** A rough time left: whole minutes are all an estimate is good for. */
export function formatLeft(ms: number): string {
  const minutes = Math.round(ms / 60_000)

  if (minutes < 1) {
    return '<1m'
  }

  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** "4/6", or "4/8 (+2)" once the plan has grown past its first version. */
export function stepCount(plan: Plan): string {
  const count = `${countDone(plan.steps)}/${plan.steps.length}`
  const grew = plan.steps.length - plan.firstTotal

  return grew > 0 ? `${count} (+${grew})` : count
}

/** The status line's own gauge: whole blocks, one eighth-block partial, braille remainder. */
export function gauge(percent: number): { filled: string; empty: string } {
  const eighths = Math.floor((percent * GAUGE_CELLS * 8) / 100)
  const whole = Math.floor(eighths / 8)
  const partial = PARTIAL_BLOCKS[eighths % 8] ?? ''
  const cells = whole + (partial === '' ? 0 : 1)

  return { filled: '█'.repeat(whole) + partial, empty: '⣿'.repeat(GAUGE_CELLS - cells) }
}

const truncate = (text: string, width: number): string =>
  text.length <= width ? text : `${text.slice(0, Math.max(width - 1, 0))}…`

/** The first candidate that fits the room, or the last one cut to it. */
function fit(room: number, ...candidates: string[]): string {
  const last = candidates[candidates.length - 1] ?? ''

  return candidates.find(candidate => candidate.length <= room) ?? truncate(last, room)
}

function roomFor(columns: number | undefined): number {
  if (columns === undefined) {
    return MAX_WIDTH
  }

  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, columns - RESERVED_COLUMNS))
}

function planFooter(plan: Plan, turn: Turn | null, now: number, room: number): Footer {
  const count = `${countDone(plan.steps)}/${plan.steps.length}`
  const percent = weightedPercent(plan.steps)
  const base = {
    title: truncate(plan.title, room - 2),
    isMuted: false,
    ...gauge(percent),
    percent: `${percent}%`,
  }

  if (plan.finishedAt !== null) {
    const took = formatElapsed(plan.finishedAt - plan.startedAt)
    const detail = fit(room, `${count} · listo en ${took}`, `${count} · ${took}`)

    return { ...base, glyph: '✔', color: DONE, detail, isDetailColored: false }
  }

  if (turn === null) {
    const detail = fit(room, `te necesita · en pausa (${count})`, 'te necesita')

    return { ...base, glyph: '▲', color: WAITING, detail, isDetailColored: true }
  }

  const elapsed = formatElapsed(now - plan.startedAt)
  const left = estimateLeft(plan, now)
  const time = left === null ? elapsed : `${elapsed} · ~${formatLeft(left)}`
  const step = currentStep(plan.steps)
  const grown = stepCount(plan)
  const withStep = (counted: string) =>
    step === undefined ? `${counted} · ${time}` : `${counted} · ${step.label} · ${time}`
  const detail = fit(room, withStep(grown), withStep(count), `${count} · ${time}`, `${count} · ${elapsed}`)

  return { ...base, glyph: '◆', color: WORKING, detail, isDetailColored: false }
}

/** What the footer block shows for the session's state, or null when it has nothing to say. */
export function describeFooter(
  plan: Plan | null,
  turn: Turn | null,
  now: number,
  columns: number | undefined,
): Footer | null {
  const room = roomFor(columns)

  if (plan !== null) {
    return planFooter(plan, turn, now, room)
  }

  if (turn === null) {
    return null
  }

  const tools = `${turn.tools} ${turn.tools === 1 ? 'tool' : 'tools'}`

  return {
    title: truncate('sin plan de pasos', room - 2),
    glyph: '◇',
    color: NO_PLAN,
    isMuted: true,
    ...gauge(0),
    percent: '—%',
    detail: `${tools} · ${formatElapsed(now - turn.startedAt)}`,
    isDetailColored: false,
  }
}
