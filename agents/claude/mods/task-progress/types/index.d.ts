export type StepStatus = 'pending' | 'active' | 'done'

export type Step = { label: string; status: StepStatus }

export type Plan = {
  title: string
  steps: Step[]
  startedAt: number
  finishedAt: number | null
}

export type Turn = { startedAt: number; tools: number }

declare module 'claude-code' {
  interface PluginState {
    'task-progress': { plan: Plan | null; turn: Turn | null }
  }
}
