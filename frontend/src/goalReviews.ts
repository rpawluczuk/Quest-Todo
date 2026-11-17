import type { GoalReviewFrequency } from './types/Goal.ts'
import { dateFromKey } from './weekDates.ts'

export const goalReviewLabels: Record<GoalReviewFrequency, string> = {
  WEEKLY: 'Co tydzień',
  BIWEEKLY: 'Co 2 tygodnie',
  MONTHLY: 'Co miesiąc',
  QUARTERLY: 'Co 3 miesiące',
}

export function isGoalReviewFrequency(value: unknown): value is GoalReviewFrequency {
  return typeof value === 'string' && Object.hasOwn(goalReviewLabels, value)
}

export function reviewFrequencyError(value: unknown): string {
  return value === null || isGoalReviewFrequency(value) ? '' : 'Wybierz prawidłową częstotliwość przeglądów.'
}

export function formatReviewDate(value: string): string {
  // A LocalDate is a calendar day, not a UTC timestamp. Reuse local calendar parsing.
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(dateFromKey(value))
}
