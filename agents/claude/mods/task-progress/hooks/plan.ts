import type { Plan, Step, StepSize, StepStatus } from '../types'

const MAX_STEPS = 30
const MAX_TEXT = 60
const STATUSES: readonly string[] = ['pending', 'active', 'done']
const SIZES: readonly string[] = ['S', 'M', 'L']
const WEIGHTS: Record<StepSize, number> = { S: 1, M: 2, L: 3 }
// Before this many steps are done, the pace says too little to estimate the rest.
const ETA_AFTER_STEPS = 2

export type PlanDraft = { title: string; steps: Step[] }

export type ParsedPlan =
  | { draft: PlanDraft; error?: undefined }
  | { error: string; draft?: undefined }

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)

function parseStep(value: unknown, index: number): Step | string {
  if (typeof value !== 'object' || value === null) {
    return `steps[${index}] must be an object with a label and a status`
  }

  const { label, status, size } = value as { label?: unknown; status?: unknown; size?: unknown }

  if (typeof label !== 'string' || clean(label) === '') {
    return `steps[${index}].label must be a non-empty string`
  }

  if (typeof status !== 'string' || !STATUSES.includes(status)) {
    return `steps[${index}].status must be one of ${STATUSES.join(', ')}`
  }

  if (size !== undefined && (typeof size !== 'string' || !SIZES.includes(size))) {
    return `steps[${index}].size must be one of ${SIZES.join(', ')}`
  }

  return { label: clean(label), status: status as StepStatus, size: (size ?? 'M') as StepSize }
}

/** Checks the arguments the model sent; an empty step list is a valid draft that clears. */
export function parsePlan(title: unknown, steps: unknown): ParsedPlan {
  if (!Array.isArray(steps)) {
    return { error: 'steps must be an array; send an empty one to clear the plan' }
  }

  if (steps.length > MAX_STEPS) {
    return { error: `steps holds ${steps.length} entries; group them into at most ${MAX_STEPS}` }
  }

  const cleanTitle = typeof title === 'string' ? clean(title) : ''

  if (steps.length > 0 && cleanTitle === '') {
    return { error: 'title must be a non-empty string' }
  }

  const parsed: Step[] = []

  for (const [index, value] of steps.entries()) {
    const step = parseStep(value, index)

    if (typeof step === 'string') {
      return { error: step }
    }

    parsed.push(step)
  }

  return { draft: { title: cleanTitle, steps: parsed } }
}

/** The plan on record once `draft` replaces `previous`; a revision keeps the task's clock. */
export function applyDraft(previous: Plan | null, draft: PlanDraft, now: number): Plan | null {
  if (draft.steps.length === 0) {
    return null
  }

  const isRevision =
    previous !== null && previous.finishedAt === null && previous.title === draft.title
  const isFinished = draft.steps.every(step => step.status === 'done')

  return {
    title: draft.title,
    steps: draft.steps,
    firstTotal: isRevision ? previous.firstTotal : draft.steps.length,
    startedAt: isRevision ? previous.startedAt : now,
    finishedAt: isFinished ? now : null,
  }
}

const isDone = (step: Step): boolean => step.status === 'done'

export const countDone = (steps: readonly Step[]): number => steps.filter(isDone).length

export const currentStep = (steps: readonly Step[]): Step | undefined =>
  steps.find(step => step.status === 'active') ?? steps.find(step => step.status === 'pending')

// A plan recorded by 0.1.0 has no sizes; its steps count as M.
const weightOf = (steps: readonly Step[]): number =>
  steps.reduce((total, step) => total + (WEIGHTS[step.size] ?? WEIGHTS.M), 0)

/** Finished work out of the plan, with S, M and L steps counting 1, 2 and 3. */
export function weightedPercent(steps: readonly Step[]): number {
  const total = weightOf(steps)

  return total === 0 ? 0 : Math.round((weightOf(steps.filter(isDone)) * 100) / total)
}

/** Milliseconds left at this plan's own pace so far, or null while there is too little to go on. */
export function estimateLeft(plan: Plan, now: number): number | null {
  const done = plan.steps.filter(isDone)
  const doneWeight = weightOf(done)
  const total = weightOf(plan.steps)

  if (plan.finishedAt !== null || done.length < ETA_AFTER_STEPS || doneWeight >= total) {
    return null
  }

  return Math.round(((now - plan.startedAt) / doneWeight) * (total - doneWeight))
}
