import type { Plan, Step, StepStatus } from '../types'

const MAX_STEPS = 30
const MAX_TEXT = 60
const STATUSES: readonly string[] = ['pending', 'active', 'done']

export type PlanDraft = { title: string; steps: Step[] }

export type ParsedPlan =
  | { draft: PlanDraft; error?: undefined }
  | { error: string; draft?: undefined }

const clean = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)

function parseStep(value: unknown, index: number): Step | string {
  if (typeof value !== 'object' || value === null) {
    return `steps[${index}] must be an object with a label and a status`
  }

  const { label, status } = value as { label?: unknown; status?: unknown }

  if (typeof label !== 'string' || clean(label) === '') {
    return `steps[${index}].label must be a non-empty string`
  }

  if (typeof status !== 'string' || !STATUSES.includes(status)) {
    return `steps[${index}].status must be one of ${STATUSES.join(', ')}`
  }

  return { label: clean(label), status: status as StepStatus }
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
    startedAt: isRevision ? previous.startedAt : now,
    finishedAt: isFinished ? now : null,
  }
}

export const countDone = (steps: readonly Step[]): number =>
  steps.filter(step => step.status === 'done').length

export const currentStep = (steps: readonly Step[]): Step | undefined =>
  steps.find(step => step.status === 'active') ?? steps.find(step => step.status === 'pending')
