import type { Habit } from './types/Habit'

export function hasReachedWeeklyTarget(habit: Habit): boolean {
  return habit.target !== null && habit.weeklyCompletedDays >= habit.target.targetDays
}

export function withOptimisticCompletion(habit: Habit, completed: boolean): Habit {
  if (habit.completed === completed) return habit
  const change = completed ? 1 : -1
  return {
    ...habit,
    completed,
    weeklyCompletedDays: Math.max(0, habit.weeklyCompletedDays + change),
    totalCompletions: Math.max(0, habit.totalCompletions + change),
  }
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
