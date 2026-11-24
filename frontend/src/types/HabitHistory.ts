/** GET /api/habits/{id}/history?year=YYYY. ISO strings represent calendar days. */
export type HabitHistoryDay = {
  readonly date: string
  readonly completed: boolean
  readonly status: 'ACTIVE' | 'INACTIVE' | 'FUTURE'
}

export type HabitHistoryWeek = {
  readonly weekStart: string
  readonly completedDays: number
  readonly targetDays: number | null
  readonly requiredDays: number | null
  readonly status: 'MET' | 'MISSED' | 'IN_PROGRESS' | 'NEUTRAL'
}

export type HabitHistory = {
  readonly id: number
  readonly name: string
  readonly year: number
  readonly today: string
  readonly days: readonly HabitHistoryDay[]
  readonly weeks: readonly HabitHistoryWeek[]
}
