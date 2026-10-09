export type HabitTarget = {
  readonly targetDays: number
  readonly effectiveFrom: string
}

export type Habit = {
  readonly id: number
  readonly name: string
  readonly createdOn: string
  readonly completed: boolean
  readonly weeklyCompletedDays: number
  readonly rewardPoints: number
  readonly target: HabitTarget | null
  readonly latestTarget: HabitTarget | null
}

export type HabitAward = { id: string; points: number; undoUntil: string }
export type HabitCompletionResult = { habit: Habit; balance: number | null; award: HabitAward | null }
