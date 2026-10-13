import type { Habit } from './types/Habit'

export function hasReachedWeeklyTarget(habit: Habit): boolean {
  return habit.target !== null && habit.weeklyCompletedDays >= habit.target.targetDays
}

function completionGroup(habit: Habit): number {
  if (hasReachedWeeklyTarget(habit)) return 2
  if (habit.completed) return 1
  return 0
}

export function sortHabitsForDay(habits: readonly Habit[]): Habit[] {
  return [...habits].sort((left, right) =>
    completionGroup(left) - completionGroup(right)
    || (right.target?.targetDays ?? 0) - (left.target?.targetDays ?? 0)
    || left.id - right.id,
  )
}
