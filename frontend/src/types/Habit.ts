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
  readonly target: HabitTarget | null
  readonly latestTarget: HabitTarget | null
}
