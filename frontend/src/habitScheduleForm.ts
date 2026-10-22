import type { HabitSchedule } from './types/Habit'

export type HabitEndMode = 'none' | 'date' | 'count'

export function habitEndMode(value: HabitSchedule): HabitEndMode {
  return value.endDate ? 'date' : value.completionLimit !== null ? 'count' : 'none'
}

export function scheduleWithEndMode(value: HabitSchedule, mode: HabitEndMode,
  previousEndDate: string | null): HabitSchedule {
  return {
    ...value,
    endDate: mode === 'date' ? previousEndDate : null,
    completionLimit: mode === 'count' ? 30 : null,
    completionBonusPoints: mode === 'none' ? null : value.completionBonusPoints,
    requiredSuccessPercent: null,
  }
}

export function regularityBonusExplanation(requiredSuccessPercent: number | null): string {
  return requiredSuccessPercent === null
    ? 'Premię otrzymasz po zakończeniu nawyku, jeśli zrealizujesz tygodniowy cel w wymaganym procencie tygodni.'
    : `Premię otrzymasz po zakończeniu nawyku, jeśli zrealizujesz tygodniowy cel w co najmniej ${requiredSuccessPercent}% tygodni.`
}
