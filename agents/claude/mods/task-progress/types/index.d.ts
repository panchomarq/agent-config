export type StepStatus = 'pending' | 'active' | 'done'

export type StepSize = 'S' | 'M' | 'L'

export type Step = { label: string; status: StepStatus; size: StepSize }

export type Plan = {
  title: string
  steps: Step[]
  /** How many steps the first version of the plan had, to tell when the plan grew. */
  firstTotal: number
  startedAt: number
  finishedAt: number | null
}

export type Turn = { startedAt: number; tools: number }

declare module 'claude-code' {
  interface PluginState {
    'task-progress': { plan: Plan | null; turn: Turn | null }
  }
}
