import type { Habit } from './types/Habit'

export function hasReachedWeeklyTarget(habit: Habit): boolean {
  return habit.target !== null && habit.weeklyCompletedDays >= habit.target.targetDays
}
