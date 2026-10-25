export type Goal = {
  id: number
  title: string
  currentState: string | null
  desiredOutcome: string | null
  completed: boolean
  completedAt: string | null
}
