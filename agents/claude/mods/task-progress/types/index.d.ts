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

/** A subagent, teammate or workflow agent of this session, as the column lists it. */
export type Agent = {
  id: string
  label: string
  type: string
  startedAt: number
  finishedAt: number | null
  tools: number
  lastAction: string
}

/** What the column knows about the project the session works in. */
export type Project = {
  /** The repository's folder name, or the working directory's. */
  name: string
  /** The vault note the roadmap comes from; null when no note matches the project. */
  note: string | null
  done: number
  total: number
  /** The first unchecked roadmap items, in the note's order. */
  next: string[]
  /** The last changes merged into the repository, newest first. */
  recent: string[]
  /** Why the roadmap could not be read, in the person's words; null when it was. */
  problem: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'task-progress': {
      plan: Plan | null
      turn: Turn | null
      agents: Agent[]
      project: Project | null
      /** True once the person closed the column, so it is not opened again unasked. */
      isDismissed: boolean
    }
  }
}
