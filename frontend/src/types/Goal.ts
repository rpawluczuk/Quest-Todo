export type GoalReviewFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'

export type Goal = {
  id: number
  title: string
  currentState: string | null
  desiredOutcome: string | null
  completed: boolean
  completedAt: string | null
  reviewFrequency: GoalReviewFrequency | null
  readonly nextReviewDate: string | null
  readonly reviewDue: boolean
}
