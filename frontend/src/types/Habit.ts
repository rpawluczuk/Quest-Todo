export type HabitTarget = {
  readonly targetDays: number
  readonly effectiveFrom: string
}

export type HabitSchedule = { startDate: string; endDate: string | null; completionLimit: number | null }
export type HabitEndReason = 'ACHIEVED' | 'ESTABLISHED' | 'STOPPED'

export type Habit = HabitSchedule & {
  readonly totalCompletions: number
  readonly status: 'ACTIVE' | 'UPCOMING' | 'FINISHED'
  readonly id: number
  readonly name: string
  readonly description: string | null
  readonly createdOn: string
  readonly completed: boolean
  readonly weeklyCompletedDays: number
  readonly rewardPoints: number
  readonly weeklyRewardGranted: boolean
  readonly target: HabitTarget | null
  readonly latestTarget: HabitTarget | null
  readonly endedOn: string | null
  readonly endReason: HabitEndReason | null
  readonly goalTitles: string[]
}

export type HabitAward = { id: string; points: number; undoUntil: string }
export type HabitCompletionResult = { habit: Habit; balance: number | null; award: HabitAward | null }
