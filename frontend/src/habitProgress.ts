import type { Habit } from './types/Habit'

export function hasReachedWeeklyTarget(habit: Habit): boolean {
  return habit.target !== null && habit.weeklyCompletedDays >= habit.target.targetDays
}

export type HabitDayGroup = 'PENDING' | 'COMPLETED_TODAY' | 'TARGET_REACHED'

export function habitDayGroup(habit: Habit): HabitDayGroup {
  if (hasReachedWeeklyTarget(habit)) return 'TARGET_REACHED'
  if (habit.completed) return 'COMPLETED_TODAY'
  return 'PENDING'
}

function completionGroup(habit: Habit): number {
  const group = habitDayGroup(habit)
  if (group === 'TARGET_REACHED') return 2
  if (group === 'COMPLETED_TODAY') return 1
  return 0
}

export function sortHabitsForDay(habits: readonly Habit[]): Habit[] {
  return [...habits].sort((left, right) =>
    completionGroup(left) - completionGroup(right)
    || (right.target?.targetDays ?? 0) - (left.target?.targetDays ?? 0)
    || left.id - right.id,
  )
}
