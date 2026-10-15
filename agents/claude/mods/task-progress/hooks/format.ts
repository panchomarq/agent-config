import type { Plan } from '../types'

import { countDone } from './plan'

const GAUGE_CELLS = 12
const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const

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
