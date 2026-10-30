import type { Habit, HabitEndReason } from './types/Habit'
import { habitActivityStatus } from './habitLists.ts'

const shortDate = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' })
const shortDateWithYear = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })

function calendarDate(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function canToggleHabit(habit: Habit): boolean {
  return habitActivityStatus(habit) === 'ACTIVE' && (habit.completed || (habit.status === 'ACTIVE'
    && (habit.completionLimit === null || habit.totalCompletions < habit.completionLimit)))
}

export function habitEndDateLabel(endDate: string, today: string): string {
  const date = calendarDate(endDate)
  const formatter = date.getFullYear() === calendarDate(today).getFullYear() ? shortDate : shortDateWithYear
  return formatter.format(date)
}

export function habitEndReasonLabel(reason: HabitEndReason): string {
  if (reason === 'ACHIEVED') return 'Osiągnięto zamierzony efekt'
  if (reason === 'ESTABLISHED') return 'Nawyk utrwalony'
  return 'Zakończono realizację'
}
