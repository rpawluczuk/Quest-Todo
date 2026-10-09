import type { Habit } from './types/Habit'

export function hasReachedWeeklyTarget(habit: Habit): boolean {
  return habit.target !== null && habit.weeklyCompletedDays >= habit.target.targetDays
}

// Loading an already achieved target is not an achievement event.
export function claimWeeklyAchievement(before: Habit, after: Habit, week: string, announced: Set<string>): boolean {
  const key = `${after.id}:${week}`
  const first = !announced.has(key) && !hasReachedWeeklyTarget(before) && hasReachedWeeklyTarget(after)
  if (hasReachedWeeklyTarget(after)) announced.add(key)
  return first
}
